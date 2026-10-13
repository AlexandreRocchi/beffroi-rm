import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Keyring } from "./keys.js";

/** Paramètres scrypt (recommandation OWASP : N = 2^17, r = 8, p = 1, soit 128 Mio par calcul). */
const SCRYPT = { N: 1 << 17, r: 8, p: 1 };

function scryptAsync(input: string | Buffer, salt: Buffer, keylen: number, p: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(input, salt, keylen, { ...p, maxmem: 256 * p.N * p.r }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/**
 * Empreintes de mots de passe : scrypt sur un HMAC du mot de passe avec une sous-clé secrète
 * (« poivre »). Une copie de la base seule ne permet donc pas d'attaquer les empreintes hors ligne.
 * Format : scrypt2$<identifiant de clé>$N$r$p$<sel>$<empreinte>. Les empreintes de l'ancien format
 * (antérieur à Beffroi RM 1.0.0 : scrypt$N$r$p$sel$empreinte, sans poivre) sont refusées par défaut :
 * une personne qui écrit dans la base pourrait en forger pour contourner le poivre. Elles ne sont
 * acceptées (et remplacées à la connexion) que pendant une migration, avec `allowLegacy`.
 */
export class Passwords {
  private readonly dummy: Promise<string>;
  private readonly allowLegacy: boolean;

  constructor(
    private readonly keys: Keyring,
    options: { allowLegacy?: boolean } = {},
  ) {
    this.allowLegacy = options.allowLegacy ?? false;
    this.dummy = this.hash(randomBytes(12).toString("hex"));
  }

  private pepper(password: string, keyId: string): Buffer {
    return Buffer.from(this.keys.mac("password-pepper", password.normalize("NFKC"), keyId), "hex");
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const id = this.keys.current.id;
    const key = await scryptAsync(this.pepper(password, id), salt, 32, SCRYPT);
    return `scrypt2$${id}$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
  }

  /** `stale` : empreinte correcte mais à recalculer (ancien format, ancienne clé ou coût inférieur). */
  async verify(password: string, stored: string): Promise<{ ok: boolean; stale: boolean }> {
    const parts = stored.split("$");
    let input: string | Buffer;
    let params: { N: number; r: number; p: number };
    let rest: string[];
    let stale: boolean;
    if (parts[0] === "scrypt2" && parts.length === 7 && this.keys.has(parts[1])) {
      input = this.pepper(password, parts[1]);
      rest = parts.slice(2);
      stale = parts[1] !== this.keys.current.id;
    } else if (parts[0] === "scrypt" && parts.length === 6) {
      if (!this.allowLegacy) {
        // Refus sans calcul sur l'empreinte, mais avec la même durée qu'un identifiant inconnu (burn) :
        // le temps de réponse ne doit pas révéler les comptes restés à l'ancien format. Pas de récursion :
        // l'empreinte factice est au format scrypt2 avec la clé courante.
        await this.burn(password);
        return { ok: false, stale: false };
      }
      input = password.normalize("NFKC");
      rest = parts.slice(1);
      stale = true;
    } else return { ok: false, stale: false };
    params = { N: Number(rest[0]), r: Number(rest[1]), p: Number(rest[2]) };
    if (![params.N, params.r, params.p].every((n) => Number.isInteger(n) && n > 0) || params.N > 1 << 20) return { ok: false, stale: false };
    const expected = Buffer.from(rest[4], "base64");
    const key = await scryptAsync(input, Buffer.from(rest[3], "base64"), expected.length, params);
    const ok = key.length === expected.length && timingSafeEqual(key, expected);
    return { ok, stale: ok && (stale || params.N < SCRYPT.N || params.r < SCRYPT.r) };
  }

  /** Vérification factice : même durée de réponse pour un identifiant inconnu. */
  async burn(password: string): Promise<void> {
    await this.verify(password, await this.dummy);
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Comparaison à durée constante de deux chaînes. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function generatePassword(): string {
  // 20 caractères tirés sans biais parmi 64 symboles sans ambiguïté visuelle (120 bits d'entropie).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_!.:+=";
  return Array.from(randomBytes(20), (b) => alphabet[b & 63]).join("");
}

/**
 * Racines de mots de passe courants (listes publiques de mots de passe divulgués, mots usuels
 * français) : un mot de passe qui se réduit à l'une d'elles, une fois chiffres et symboles
 * retirés, est refusé même s'il respecte la longueur et la complexité (ex. « Motdepasse2026! »).
 */
const COMMON_ROOTS = new Set(
  (
    "password passwort motdepasse motdepass mdp azerty azertyuiop qwerty qwertyuiop abc abcdef abcdefgh " +
    "admin administrateur administrator root user utilisateur test testeur demo guest invite welcome bienvenue " +
    "bonjour salut coucou soleil lune etoile amour jetaime iloveyou loveyou chocolat princesse doudou " +
    "football foot rugby tennis marseille paris lyon lille toulouse bordeaux nantes france french " +
    "janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre " +
    "printemps ete automne hiver lundi mardi mercredi jeudi vendredi samedi dimanche " +
    "changeme changemoi secret secure securite security letmein trustno monkey dragon master shadow " +
    "beffroi ebios ebiosrm anssi risque risques analyse cyber cybersecurite entreprise societe"
  ).split(" "),
);

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i" };

function reduce(pw: string): string {
  const lower = pw.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const letters = lower.replace(/^[^a-z]+|[^a-z]+$/g, "");
  return [...letters].map((c) => LEET[c] ?? c).join("").replace(/[^a-z]/g, "");
}

/**
 * Politique de mot de passe (guide ANSSI « Recommandations relatives à l'authentification
 * multifacteur et aux mots de passe ») : longueur, diversité, et refus des mots de passe
 * prévisibles (mots courants, identité de l'utilisateur, répétitions et suites).
 */
export function passwordPolicyError(pw: string, identity: string[] = []): string | null {
  if (pw.length < 12) return "Le mot de passe doit contenir au moins 12 caractères.";
  if (pw.length > 256) return "Le mot de passe est trop long.";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return "Le mot de passe doit combiner au moins trois types de caractères (minuscules, majuscules, chiffres, caractères spéciaux).";
  if (new Set(pw).size < 6) return "Le mot de passe comporte trop de caractères répétés.";
  const lower = pw.toLowerCase();
  if (/(.)\1{3,}/.test(lower) || /(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|azer|wxcv)/.test(lower)) {
    return "Le mot de passe contient une suite ou une répétition trop prévisible.";
  }
  const root = reduce(pw);
  if (root.length < 4 || COMMON_ROOTS.has(root) || [...COMMON_ROOTS].some((w) => w.length >= 6 && root === w + w)) {
    return "Ce mot de passe est trop courant ou trop prévisible : choisissez une phrase de passe ou une suite de mots sans lien.";
  }
  for (const part of identity.flatMap((s) => s.toLowerCase().split(/[\s.@_-]+/)).filter((s) => s.length >= 4)) {
    if (lower.includes(part)) return "Le mot de passe ne doit pas contenir votre identifiant ni votre nom.";
  }
  return null;
}

/**
 * Cellule CSV sûre : guillemets doublés et neutralisation des formules (injection CSV) — une valeur
 * commençant par = + - @ ou une tabulation serait interprétée comme formule par un tableur.
 */
export function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
