import { createCipheriv, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { deflateRawSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exampleStudy } from "@beffroi/shared";
import { bootstrapAdmin, buildApp, type AppContext } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { csvCell, Passwords, passwordPolicyError } from "../src/crypto.js";
import { createPool, privilegeWarnings } from "../src/db.js";
import { Keyring, Sealer } from "../src/keys.js";
import { rewrap } from "../src/maintenance.js";
import { base32Decode, base32Encode, hotp, verifyTotp } from "../src/mfa.js";
import { StudyStore } from "../src/studies.js";
import { ADMIN_URL, Client, tempDatabase } from "./helpers.js";

const key = () => randomBytes(32);

describe("TOTP (RFC 6238)", () => {
  // Vecteurs de l'annexe B de la RFC 6238 (SHA-1, secret ASCII « 12345678901234567890 ») : 6 derniers chiffres.
  const secret = Buffer.from("12345678901234567890");
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("t = %i s → %s", (t, expected) => {
    expect(hotp(secret, Math.floor(t / 30))).toBe(expected);
    expect(verifyTotp(secret, expected, 0, t * 1000)).toBe(Math.floor(t / 30));
  });

  it("refuse le rejeu et les codes hors fenêtre", () => {
    const t = 1_700_000_000_000;
    const step = Math.floor(t / 30_000);
    const code = hotp(secret, step);
    expect(verifyTotp(secret, code, step, t)).toBeNull();
    expect(verifyTotp(secret, hotp(secret, step - 2), 0, t)).toBeNull();
    expect(verifyTotp(secret, "12345", 0, t)).toBeNull();
  });

  it("encode et décode le base32 des applications d'authentification", () => {
    const b = randomBytes(20);
    expect(base32Decode(base32Encode(b))).toEqual(b);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });
});

describe("chiffrement et trousseau de clés", () => {
  it("lie chaque chiffré à son usage et à son enregistrement", () => {
    const s = new Sealer(new Keyring(key()));
    const c = s.seal("study-data", "secret", "study-version:A");
    expect(s.open("study-data", c, "study-version:A")).toBe("secret");
    expect(() => s.open("study-data", c, "study-version:B")).toThrow();
    expect(() => s.open("study-meta", c, "study-version:A")).toThrow();
    const tampered = Buffer.from(c);
    tampered[tampered.length - 1] ^= 1;
    expect(() => s.open("study-data", tampered, "study-version:A")).toThrow();
  });

  it("rotation : l'ancienne clé reste lisible, les chiffrés sont signalés à renouveler", () => {
    const oldKey = key();
    const before = new Sealer(new Keyring(oldKey));
    const blob = before.seal("mfa-secret", "abc", "mfa:u1");
    const after = new Sealer(new Keyring(key(), [oldKey]));
    expect(after.open("mfa-secret", blob, "mfa:u1")).toBe("abc");
    expect(after.isStale(blob)).toBe(true);
    expect(after.isStale(after.seal("mfa-secret", "abc", "mfa:u1"))).toBe(false);
    expect(() => new Sealer(new Keyring(key())).open("mfa-secret", blob, "mfa:u1")).toThrow(/absente du trousseau/);
  });

  it("lit le format de la version 1.0 (clé maître directe)", () => {
    const raw = key();
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", raw, iv);
    c.setAAD(Buffer.from("study-version:V"));
    const body = Buffer.concat([c.update(deflateRawSync(Buffer.from("héritage"))), c.final()]);
    const v1 = Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), body]);
    const s = new Sealer(new Keyring(raw));
    expect(s.open("study-data", v1, "study-version:V")).toBe("héritage");
    expect(s.isStale(v1)).toBe(true);
  });

  it("refuse une clé maître mal formée", () => {
    expect(() => Keyring.load(os.tmpdir(), "trop-courte")).toThrow(/32 octets/);
  });
});

describe("mots de passe", () => {
  it("poivre : une empreinte n'est vérifiable qu'avec la clé", async () => {
    const k = new Keyring(key());
    const p = new Passwords(k);
    const h = await p.hash("Colline-Brume-41");
    expect(await p.verify("Colline-Brume-41", h)).toEqual({ ok: true, stale: false });
    expect((await p.verify("Colline-Brume-42", h)).ok).toBe(false);
    expect((await new Passwords(new Keyring(key())).verify("Colline-Brume-41", h)).ok).toBe(false);
  });

  it("accepte l'ancien format (sans poivre) et demande son renouvellement", async () => {
    const { scryptSync } = await import("node:crypto");
    const salt = randomBytes(16);
    const legacy = `scrypt$32768$8$1$${salt.toString("base64")}$${scryptSync("Ancien-Format-2025", salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("base64")}`;
    expect(await new Passwords(new Keyring(key())).verify("Ancien-Format-2025", legacy)).toEqual({ ok: true, stale: true });
  });

  it("politique : longueur, diversité, mots courants, identité, suites", () => {
    expect(passwordPolicyError("Colline-Brume-41")).toBeNull();
    expect(passwordPolicyError("correct horse battery Staple 9")).toBeNull();
    expect(passwordPolicyError("Court-1!")).toMatch(/12 caractères/);
    expect(passwordPolicyError("toutenminuscule")).toMatch(/trois types/);
    expect(passwordPolicyError("Motdepasse2026!")).toMatch(/courant/);
    expect(passwordPolicyError("B3ff r0i-2026!!")).toMatch(/courant/);
    expect(passwordPolicyError("Jmartin-Cloche-9", ["jmartin", "Jeanne Martin"])).toMatch(/identifiant/);
    expect(passwordPolicyError("Cloche-12345-Nord")).toMatch(/suite/);
  });
});

describe("exports", () => {
  it("neutralise l'injection de formules dans les CSV", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvCell("texte ordinaire")).toBe(`"texte ordinaire"`);
  });
});

describe("base de données au moindre privilège", () => {
  const role = `beffroi_app_${randomBytes(3).toString("hex")}`;
  const password = randomBytes(18).toString("base64url");
  let db: Awaited<ReturnType<typeof tempDatabase>>;
  let ctx: AppContext;
  let appPool: pg.Pool;
  let server: Server;
  let base = "";
  const superuser = () => new pg.Client({ connectionString: ADMIN_URL });

  beforeAll(async () => {
    db = await tempDatabase("beffroi_priv");
    const su = superuser();
    await su.connect();
    await su.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
    await su.end();
    // Même serveur que la connexion d'administration (TEST_DATABASE_URL), mais en TCP : le rôle
    // jetable ne peut pas s'authentifier par le socket Unix (méthode « peer »).
    const u = new URL(ADMIN_URL);
    const viaSocket = !u.hostname || u.hostname.startsWith("%2F") || (u.searchParams.get("host") ?? "").startsWith("/");
    u.searchParams.delete("host");
    if (viaSocket || u.hostname === "localhost") u.hostname = "127.0.0.1";
    u.username = role;
    u.password = password;
    u.pathname = `/${db.name}`;
    const appUrl = u.toString();
    appPool = createPool({ connectionString: appUrl, max: 3 });
    const config = {
      ...loadConfig({}),
      databaseUrl: appUrl,
      databaseMigrationUrl: db.url,
      dataDir: path.join(os.tmpdir(), db.name),
      bootstrapAdminPassword: "Initial-Admin-Pw-2026",
      logLevel: "error" as const,
      loginRateLimitPerMinute: 3,
      rateLimitPerMinute: 50,
    };
    let app;
    ({ app, ctx } = await buildApp(config, { db: appPool }));
    await bootstrapAdmin(ctx);
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    await new Promise((r) => server?.close(r));
    await appPool?.end();
    await db?.drop();
    const su = superuser();
    await su.connect();
    await su.query(`DROP ROLE IF EXISTS ${role}`);
    await su.end();
  });

  it("le rôle applicatif n'est ni super-utilisateur ni propriétaire du schéma", async () => {
    expect(await privilegeWarnings(appPool)).toEqual([]);
    await expect(appPool.query("CREATE TABLE intrus (x int)")).rejects.toThrow(/permission denied/);
    await expect(appPool.query("ALTER TABLE users ADD COLUMN x int")).rejects.toThrow(/owner|propriétaire|must be owner/);
  });

  it("le journal est en ajout seul pour le rôle applicatif", async () => {
    await ctx.audit.write({ userId: null, username: "test", ip: "" }, "test.entry");
    await expect(appPool.query("UPDATE audit_log SET details = 'x'")).rejects.toThrow(/permission denied/);
    await expect(appPool.query("DELETE FROM audit_log")).rejects.toThrow(/permission denied/);
    await expect(appPool.query("SELECT beffroi_audit_purge(now())")).rejects.toThrow(/plus d'un an/);
    expect(Number((await appPool.query("SELECT beffroi_audit_purge(now() - interval '400 days') AS n")).rows[0].n)).toBe(0);
    expect((await ctx.audit.verify()).ok).toBe(true);
  });

  it("limite les tentatives de connexion par adresse IP", async () => {
    const c = new Client(() => base);
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await c.login("inconnu", "Nimporte-Quoi-2026")).statusCode);
    expect(codes).toEqual([401, 401, 401, 429, 429]);
  });

  it("limite le débit global de l'API par adresse IP", async () => {
    const c = new Client(() => base);
    const codes = await Promise.all(Array.from({ length: 60 }, () => c.req("GET", "/api/health").then((r) => r.statusCode)));
    expect(codes).toContain(429);
  });
});

describe("mise à niveau des données de la version 1.0 et rotation de clé", () => {
  let db: Awaited<ReturnType<typeof tempDatabase>>;
  let pool: pg.Pool;

  beforeAll(async () => {
    db = await tempDatabase("beffroi_rewrap");
    pool = createPool({ connectionString: db.url, max: 2 });
  });
  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("chiffre les métadonnées en clair puis rechiffre tout avec la nouvelle clé", async () => {
    const dataDir = path.join(os.tmpdir(), db.name);
    const oldKey = randomBytes(32).toString("base64");
    const base = { ...loadConfig({}), databaseUrl: db.url, dataDir, logLevel: "error" as const, bootstrapAdminPassword: "Initial-Admin-Pw-2026" };
    const first = await buildApp({ ...base, masterKey: oldKey }, { db: pool });
    await bootstrapAdmin(first.ctx);
    await pool.query("INSERT INTO users (id, username, display_name, role, password_hash, must_change) VALUES ('u1', 'ana', 'Ana', 'user', '!', FALSE)");
    const meta = await first.ctx.store.create(
      { id: "u1", username: "ana", displayName: "Ana", email: "", function: "", role: "user", canCreate: true, mustChange: false, authSource: "local", mfaEnabled: false, mustEnrollMfa: false, previousLogin: null },
      { name: "Étude sensible", reference: "R1", organisation: "Org", protection: "DR" },
      exampleStudy(),
    );
    // Simulation d'une base de la version 1.0 : métadonnées en clair.
    await pool.query("UPDATE studies SET name = 'Étude sensible', reference = 'R1', organisation = 'Org', meta_enc = NULL WHERE id = $1", [meta.id]);

    // Redémarrage avec une nouvelle clé maître, l'ancienne passée en clé précédente.
    const newKey = randomBytes(32).toString("base64");
    const second = await buildApp({ ...base, masterKey: newKey, previousMasterKeys: [oldKey] }, { db: pool });
    const row = (await pool.query("SELECT name, meta_enc FROM studies WHERE id = $1", [meta.id])).rows[0];
    expect(row.name).toBe("");
    expect(second.ctx.sealer.isStale(row.meta_enc)).toBe(false);
    const v = (await pool.query("SELECT data FROM study_versions WHERE study_id = $1", [meta.id])).rows[0];
    expect(second.ctx.sealer.isStale(v.data)).toBe(false);
    expect((await rewrap(pool, second.ctx.keys, second.ctx.sealer, second.ctx.store)).versions).toBe(0);

    // L'ancienne clé peut alors être retirée : tout reste lisible avec la seule nouvelle clé.
    const keysOnly = new Keyring(Buffer.from(newKey, "base64"));
    const store = new StudyStore(pool, new Sealer(keysOnly));
    expect(store.openNames({ id: meta.id, name: "", reference: "", organisation: "", meta_enc: row.meta_enc }).name).toBe("Étude sensible");
    // Le journal reste vérifiable avec le trousseau complet (entrées signées par l'ancienne et la nouvelle clé).
    expect((await second.ctx.audit.verify()).ok).toBe(true);
  });
});
