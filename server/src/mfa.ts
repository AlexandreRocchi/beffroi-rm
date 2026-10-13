import { createHmac, randomBytes } from "node:crypto";
import qrcode from "qrcode-generator";
import { safeEqual } from "./crypto.js";

/**
 * Authentification multifacteur par mot de passe à usage unique fondé sur le temps (TOTP, RFC 6238) :
 * HMAC-SHA1, pas de 30 secondes, 6 chiffres — paramètres compris par toutes les applications
 * d'authentification (FreeOTP, Aegis, applications des éditeurs de coffres-forts…).
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Tolérance de dérive d'horloge : un pas avant et un pas après. */
const WINDOW = 1;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error("Secret base32 invalide.");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => randomBytes(20);

export const currentStep = (t = Date.now()) => Math.floor(t / 1000 / STEP_SECONDS);

/** Code HOTP (RFC 4226) pour un compteur donné. */
export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Vérifie un code TOTP ; renvoie le pas accepté, ou null. Un pas déjà utilisé (inférieur ou égal
 * à `lastStep`) est refusé : un code intercepté ne peut pas être rejoué.
 */
export function verifyTotp(secret: Buffer, code: string, lastStep: number, t = Date.now()): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = currentStep(t);
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const step = now + d;
    if (step > lastStep && safeEqual(hotp(secret, step), c)) return step;
  }
  return null;
}

export function otpauthUri(secret: Buffer, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${base32Encode(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** QR code en SVG (chemin unique, sans style en ligne), généré sur le serveur : aucun service tiers. */
export function qrSvg(text: string): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const m = 4;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  const size = n + 2 * m;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/** Alphabet de 32 caractères sans ambiguïté (tirage uniforme) : 10 codes de 12 caractères, soit 60 bits chacun. */
const RC = "abcdefghjkmnpqrstuvwxyz123456789".split("");
export function newRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const b = randomBytes(12);
    const s = Array.from(b, (x) => RC[x & 31]).join("");
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
  });
}

export const normalizeRecoveryCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
