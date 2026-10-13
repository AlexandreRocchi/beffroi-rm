/** Codes TOTP (RFC 6238, SHA-1, 30 s, 6 chiffres) pour les parcours de test dans le navigateur. */
import { createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(s) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of s.toUpperCase().replace(/[\s=-]/g, "")) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const off = h[h.length - 1] & 15;
  return String((((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]) % 1e6).padStart(6, "0");
}

/** Générateur de codes pour un secret : jamais deux fois le même pas (le serveur refuse le rejeu). */
export function authenticator(secretBase32) {
  const secret = base32Decode(secretBase32);
  let last = 0;
  return () => {
    const now = Math.floor(Date.now() / 30000);
    const step = Math.max(now, last + 1);
    if (step > now + 1) throw new Error("Plus de code disponible avant le prochain pas de 30 s.");
    last = step;
    return hotp(secret, step);
  };
}

/** Enrôlement du second facteur depuis la page /securite/mfa ; renvoie le générateur de codes. */
export async function enrollMfa(page, password) {
  await page.waitForURL(/securite\/mfa/);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Continuer")');
  const secret = (await page.locator("code.mono").textContent()).replace(/\s/g, "");
  const next = authenticator(secret);
  await page.fill('input[autocomplete="one-time-code"]', next());
  await page.click('button:has-text("Activer")');
  await page.waitForSelector('[data-testid="recovery-codes"]');
  const codes = await page.locator('[data-testid="recovery-codes"] li').allTextContents();
  await page.click('label:has-text("J\'ai conservé ces codes")');
  await page.click('button:has-text("Terminer")');
  await page.waitForTimeout(400);
  return { next, codes };
}
