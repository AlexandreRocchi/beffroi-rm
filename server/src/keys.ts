import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";

/** Usages des sous-clés : une clé distincte par usage, dérivée de la clé maître (HKDF-SHA256). */
export type KeyPurpose = "study-data" | "study-meta" | "mfa-secret" | "audit-mac" | "password-pepper" | "recovery-code";

interface MasterKey {
  /** Identifiant public de la clé (8 caractères hexadécimaux), stocké avec chaque chiffré. */
  id: string;
  raw: Buffer;
}

function decodeKey(b64: string, label: string): Buffer {
  const raw = Buffer.from(b64.trim(), "base64");
  if (raw.length !== 32) throw new Error(`${label} : la clé doit faire 32 octets encodés en base64.`);
  return raw;
}

const keyId = (raw: Buffer) => createHash("sha256").update("beffroi-key-id").update(raw).digest("hex").slice(0, 8);

/**
 * Trousseau de clés : clé maître courante et clés précédentes (rotation).
 * Les chiffrés et les empreintes portent l'identifiant de la clé qui les a produits ; les données
 * produites avec une clé précédente restent lisibles puis sont rechiffrées avec la clé courante.
 */
export class Keyring {
  readonly current: MasterKey;
  private readonly keys = new Map<string, MasterKey>();
  private readonly cache = new Map<string, Buffer>();

  constructor(current: Buffer, previous: Buffer[] = []) {
    this.current = { id: keyId(current), raw: current };
    for (const k of [current, ...previous]) {
      const mk = { id: keyId(k), raw: k };
      if (!this.keys.has(mk.id)) this.keys.set(mk.id, mk);
    }
  }

  /**
   * Charge la clé courante (variable BEFFROI_MASTER_KEY, sinon fichier DATA_DIR/master.key créé en 0600)
   * et les clés précédentes (BEFFROI_PREVIOUS_MASTER_KEYS, séparées par des virgules).
   */
  static load(dataDir: string, envKey?: string, previous: string[] = []): Keyring {
    let current: Buffer;
    if (envKey) current = decodeKey(envKey, "BEFFROI_MASTER_KEY");
    else {
      const file = path.join(dataDir, "master.key");
      if (!fs.existsSync(file)) fs.writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
      current = decodeKey(fs.readFileSync(file, "utf8"), file);
    }
    return new Keyring(current, previous.filter(Boolean).map((k, i) => decodeKey(k, `clé précédente n° ${i + 1}`)));
  }

  has(id: string): boolean {
    return this.keys.has(id);
  }

  /** Clés maîtres brutes (format de chiffrement v1, antérieur aux sous-clés). */
  rawKeys(): Buffer[] {
    return [...this.keys.values()].map((k) => k.raw);
  }

  /** Sous-clé de 32 octets pour un usage donné, dérivée de la clé `id` (courante par défaut). */
  subkey(purpose: KeyPurpose, id = this.current.id): Buffer {
    const k = this.keys.get(id);
    if (!k) throw new Error(`Clé ${id} absente du trousseau : fournissez-la dans BEFFROI_PREVIOUS_MASTER_KEYS.`);
    const cacheKey = `${id}:${purpose}`;
    let sub = this.cache.get(cacheKey);
    if (!sub) {
      sub = Buffer.from(hkdfSync("sha256", k.raw, "beffroi/v2", purpose, 32));
      this.cache.set(cacheKey, sub);
    }
    return sub;
  }

  /** HMAC-SHA256 avec la sous-clé d'un usage (empreintes : journal, codes de secours, poivre). */
  mac(purpose: KeyPurpose, data: string | Buffer, id = this.current.id): string {
    return createHmac("sha256", this.subkey(purpose, id)).update(data).digest("hex");
  }
}

const V1 = 1;
const V2 = 2;

/**
 * Chiffrement authentifié AES-256-GCM avec données associées (AAD) : un chiffré ne peut pas être
 * déplacé vers une autre ligne (l'AAD désigne l'enregistrement). Format v2 :
 * [0x02][identifiant de clé, 4 octets][IV, 12][tag, 16][données compressées chiffrées].
 */
export class Sealer {
  constructor(readonly keys: Keyring) {}

  seal(purpose: KeyPurpose, plaintext: string, aad: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.keys.subkey(purpose), iv);
    cipher.setAAD(Buffer.from(`${purpose}|${aad}`));
    const body = Buffer.concat([cipher.update(deflateRawSync(Buffer.from(plaintext, "utf8"))), cipher.final()]);
    return Buffer.concat([Buffer.from([V2]), Buffer.from(this.keys.current.id, "hex"), iv, cipher.getAuthTag(), body]);
  }

  open(purpose: KeyPurpose, blob: Uint8Array, aad: string): string {
    const buf = Buffer.from(blob);
    if (buf[0] === V2) {
      const id = buf.subarray(1, 5).toString("hex");
      const decipher = createDecipheriv("aes-256-gcm", this.keys.subkey(purpose, id), buf.subarray(5, 17));
      decipher.setAAD(Buffer.from(`${purpose}|${aad}`));
      decipher.setAuthTag(buf.subarray(17, 33));
      return inflateRawSync(Buffer.concat([decipher.update(buf.subarray(33)), decipher.final()])).toString("utf8");
    }
    if (buf[0] === V1) return this.openV1(buf, aad);
    throw new Error("Format de chiffré inconnu.");
  }

  /** Format v1 (ancien format, antérieur à Beffroi RM 1.0.0) : clé maître utilisée directement, sans identifiant de clé. */
  private openV1(buf: Buffer, aad: string): string {
    for (const key of this.keys.rawKeys()) {
      try {
        const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(1, 13));
        decipher.setAAD(Buffer.from(aad));
        decipher.setAuthTag(buf.subarray(13, 29));
        return inflateRawSync(Buffer.concat([decipher.update(buf.subarray(29)), decipher.final()])).toString("utf8");
      } catch {
        /* clé suivante */
      }
    }
    throw new Error("Déchiffrement impossible : clé maître inconnue ou donnée altérée.");
  }

  /** Vrai si le chiffré n'est pas au format courant avec la clé courante (à rechiffrer). */
  isStale(blob: Uint8Array): boolean {
    const buf = Buffer.from(blob);
    return buf[0] !== V2 || buf.subarray(1, 5).toString("hex") !== this.keys.current.id;
  }
}
