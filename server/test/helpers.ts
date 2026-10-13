import { randomBytes, scryptSync } from "node:crypto";
import os from "node:os";
import pg from "pg";
import { expect } from "vitest";
import { base32Decode, currentStep, hotp } from "../src/mfa.js";

/**
 * Connexion autorisée à créer des bases (défaut : socket Unix local, utilisateur courant, base « postgres »).
 * Chaque fichier de test crée une base jetable puis la supprime.
 */
export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? `postgres://${os.userInfo().username}@localhost/postgres?host=/var/run/postgresql`;

export async function tempDatabase(prefix: string): Promise<{ name: string; url: string; drop: () => Promise<void> }> {
  const name = `${prefix}_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return {
    name,
    url: url.toString(),
    drop: async () => {
      const c = new pg.Client({ connectionString: ADMIN_URL });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}

/** Empreinte de l'ancien format (antérieur à Beffroi RM 1.0.0 : scrypt$N$r$p$sel$empreinte, sans poivre). */
export function legacyHash(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export type Res ={ statusCode: number; json: () => any; headers: Headers };

/**
 * Client HTTP de test : conserve les cookies (session, étape MFA), pose l'en-tête anti-CSRF et
 * calcule les codes TOTP du compte enrôlé (sans réutiliser un pas déjà consommé).
 */
export class Client {
  cookies = new Map<string, string>();
  totpSecret: Buffer | null = null;
  recoveryCodes: string[] = [];
  private lastStep = 0;

  constructor(private readonly base: () => string) {}

  get cookie() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async req(method: string, url: string, body?: unknown, opts: { csrf?: boolean; headers?: Record<string, string> } = {}): Promise<Res> {
    const r = await fetch(this.base() + url, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.cookies.size ? { cookie: this.cookie } : {}),
        ...(opts.csrf === false ? {} : { "x-beffroi-csrf": "1" }),
        ...opts.headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const c of r.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const [k, v] = pair.split("=");
      const expired = attrs.some((a) => /expires=Thu, 01 Jan 1970/i.test(a)) || v === "";
      if (expired) this.cookies.delete(k.trim());
      else this.cookies.set(k.trim(), v);
    }
    const text = await r.text();
    return { statusCode: r.status, json: () => JSON.parse(text), headers: r.headers };
  }

  /**
   * Code TOTP valide et jamais utilisé : le plus ancien pas encore admis par le serveur (fenêtre
   * de ±1 pas). Si les trois codes de la fenêtre ont déjà servi, attend le pas suivant, comme le
   * ferait un utilisateur : le serveur refuse tout code rejoué.
   */
  async totp(): Promise<string> {
    if (!this.totpSecret) throw new Error("compte non enrôlé");
    while (this.lastStep + 1 > currentStep() + 1) {
      const next = (currentStep() + 1) * 30_000;
      await new Promise((r) => setTimeout(r, next - Date.now() + 50));
    }
    const step = Math.max(currentStep() - 1, this.lastStep + 1);
    this.lastStep = step;
    return hotp(this.totpSecret, step);
  }

  /** Connexion complète : mot de passe puis, si demandé, second facteur. */
  async login(username: string, password: string): Promise<Res> {
    const r = await this.req("POST", "/api/auth/login", { username, password });
    if (r.statusCode === 200 && r.json().mfaRequired && this.totpSecret) return this.req("POST", "/api/auth/login/mfa", { code: await this.totp() });
    return r;
  }

  /** Enrôlement TOTP (après changement du mot de passe initial). */
  async enrollMfa(password: string): Promise<void> {
    const setup = await this.req("POST", "/api/auth/mfa/setup", { password });
    expect(setup.statusCode).toBe(200);
    this.totpSecret = base32Decode(setup.json().secret);
    this.lastStep = 0;
    const act = await this.req("POST", "/api/auth/mfa/activate", { code: await this.totp() });
    expect(act.statusCode).toBe(200);
    this.recoveryCodes = act.json().recoveryCodes;
  }
}

/** Compte analyste prêt à l'emploi : créé par l'administrateur, mot de passe changé, second facteur enrôlé. */
export async function newUser(admin: Client, base: () => string, username: string, pw: string, opts: { mfa?: boolean } = {}) {
  const r = await admin.req("POST", "/api/admin/users", { username, displayName: username.toUpperCase() });
  expect(r.statusCode).toBe(200);
  const c = new Client(base);
  await c.login(username, r.json().temporaryPassword);
  const ch = await c.req("POST", "/api/auth/password", { current: r.json().temporaryPassword, next: pw });
  expect(ch.statusCode).toBe(200);
  if (opts.mfa !== false) await c.enrollMfa(pw);
  return { client: c, id: r.json().user.id as string };
}
