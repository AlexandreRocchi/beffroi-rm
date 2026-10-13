import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, buildApp, type AppContext } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { sha256 } from "../src/crypto.js";
import { createPool } from "../src/db.js";
import { Client, newUser, tempDatabase } from "./helpers.js";

/** Tests de l'API sur un vrai serveur PostgreSQL (base jetable), politique MFA par défaut (obligatoire). */
const ADMIN_PW = "Initial-Admin-Pw-2026";
const ADMIN_NEW = "Veilleur-Tour-Nord-2026";

let server: Server;
let base = "";
const b = () => base;
let ctx: AppContext;
let dropDb: () => Promise<void>;

const admin = new Client(b);
let alice: Client;
let bob: Client;
let bobId: string;

beforeAll(async () => {
  const db = await tempDatabase("beffroi_test");
  dropDb = db.drop;
  const config = {
    ...loadConfig({}),
    databaseUrl: db.url,
    dataDir: path.join(os.tmpdir(), db.name),
    bootstrapAdminPassword: ADMIN_PW,
    maxFailedLogins: 3,
    // Tous les tests viennent de la même adresse : la limitation par IP est testée séparément.
    loginRateLimitPerMinute: 1000,
    logLevel: "error" as const,
  };
  let app;
  ({ app, ctx } = await buildApp(config, { db: createPool({ connectionString: config.databaseUrl, max: 4 }) }));
  await bootstrapAdmin(ctx);
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await admin.login("admin", ADMIN_PW);
  expect((await admin.req("POST", "/api/auth/password", { current: ADMIN_PW, next: ADMIN_NEW })).statusCode).toBe(200);
  await admin.enrollMfa(ADMIN_NEW);
  alice = (await newUser(admin, b, "alice", "Horizon-Cloche-7q!")).client;
  const bb = await newUser(admin, b, "bob", "Ardoise-Marine-58");
  bob = bb.client;
  bobId = bb.id;
}, 60_000);

afterAll(async () => {
  await new Promise((r) => server?.close(r));
  await ctx?.db.end();
  await dropDb?.();
});

describe("authentification", () => {
  it("refuse un mauvais mot de passe et verrouille le compte", async () => {
    await newUser(admin, b, "carol", "Carillon-Guet-2026", { mfa: false });
    const c = new Client(b);
    for (let i = 0; i < 3; i++) expect((await c.login("carol", "Mauvais-Mot-2026")).statusCode).toBe(401);
    expect((await c.login("carol", "Carillon-Guet-2026")).statusCode).toBe(423);
    // Pendant le verrouillage, un mauvais mot de passe ne révèle pas l'état du compte.
    expect((await c.login("carol", "Mauvais-Mot-2026")).statusCode).toBe(401);
    const users = (await admin.req("GET", "/api/admin/users")).json();
    const carol = users.find((u: { username: string }) => u.username === "carol");
    expect(carol.locked).toBe(true);
    await admin.req("PATCH", `/api/admin/users/${carol.id}`, { unlock: true });
    expect((await c.login("carol", "Carillon-Guet-2026")).statusCode).toBe(200);
  });

  it("ne révèle pas l'existence d'un compte", async () => {
    const c = new Client(b);
    const unknown = await c.login("personne", "Nimporte-Quoi-2026");
    const wrong = await c.login("alice", "Nimporte-Quoi-2026");
    expect(unknown.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json().error).toBe(wrong.json().error);
  });

  it("impose le changement du mot de passe initial", async () => {
    const r = await admin.req("POST", "/api/admin/users", { username: "dave", displayName: "Dave" });
    const c = new Client(b);
    await c.login("dave", r.json().temporaryPassword);
    expect((await c.req("GET", "/api/studies")).statusCode).toBe(403);
    expect((await c.req("POST", "/api/auth/password", { current: r.json().temporaryPassword, next: "short" })).statusCode).toBe(400);
  });

  it("refuse les mots de passe prévisibles et la réutilisation", async () => {
    const { client } = await newUser(admin, b, "erwan", "Grenier-Phare-2026", { mfa: false });
    for (const weak of ["Motdepasse2026!", "P@ssw0rd-2026", "Azerty123456!", "Erwan-Beffroi-99", "Abcd1234efgh!!", "Aaaaaaaaaaaa1!"]) {
      const r = await client.req("POST", "/api/auth/password", { current: "Grenier-Phare-2026", next: weak });
      expect(r.statusCode, weak).toBe(400);
    }
    expect((await client.req("POST", "/api/auth/password", { current: "Grenier-Phare-2026", next: "Colline-Brume-41" })).statusCode).toBe(200);
    const reuse = await client.req("POST", "/api/auth/password", { current: "Colline-Brume-41", next: "Grenier-Phare-2026" });
    expect(reuse.statusCode).toBe(400);
    expect(reuse.json().error).toMatch(/déjà été utilisé/);
  });

  it("stocke des empreintes poivrées au format courant", async () => {
    const { rows } = await ctx.db.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE username = 'alice'");
    expect(rows[0].password_hash).toMatch(new RegExp(`^scrypt2\\$${ctx.keys.current.id}\\$131072\\$8\\$1\\$`));
  });

  it("exige l'en-tête anti-CSRF sur les requêtes modifiantes", async () => {
    const r = await alice.req("POST", "/api/studies", { name: "x", protection: "NP" }, { csrf: false });
    expect(r.statusCode).toBe(403);
  });

  it("refuse les requêtes inter-sites, d'une autre origine ou d'un autre format", async () => {
    expect((await alice.req("GET", "/api/studies", undefined, { headers: { "sec-fetch-site": "cross-site" } })).statusCode).toBe(403);
    expect((await alice.req("POST", "/api/studies", { name: "x", protection: "NP" }, { headers: { origin: "https://attaquant.example" } })).statusCode).toBe(403);
    const r = await fetch(`${base}/api/studies`, { method: "POST", headers: { "content-type": "text/plain", "x-beffroi-csrf": "1", cookie: alice.cookie }, body: "{}" });
    expect(r.status).toBe(415);
  });

  it("pose des en-têtes de sécurité", async () => {
    const r = await alice.req("GET", "/api/auth/me");
    const csp = r.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("cross-origin-embedder-policy")).toBe("require-corp");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-powered-by")).toBeNull();
  });

  it("ne divulgue pas la version aux visiteurs non authentifiés", async () => {
    const anon = (await new Client(b).req("GET", "/api/auth/me")).json();
    expect(anon.version).toBeUndefined();
    expect((await new Client(b).req("GET", "/api/health")).json()).toEqual({ ok: true });
    expect((await alice.req("GET", "/api/auth/me")).json().version).toBe("1.1.0");
  });
});

describe("authentification multifacteur", () => {
  it("impose l'enrôlement avant tout accès (politique « required »)", async () => {
    const { client } = await newUser(admin, b, "fanny", "Tilleul-Verger-63", { mfa: false });
    const r = await client.req("GET", "/api/studies");
    expect(r.statusCode).toBe(403);
    expect(r.json().mustEnrollMfa).toBe(true);
    expect((await client.req("POST", "/api/auth/mfa/setup", { password: "faux" })).statusCode).toBe(400);
    await client.enrollMfa("Tilleul-Verger-63");
    expect((await client.req("GET", "/api/studies")).statusCode).toBe(200);
    expect(client.recoveryCodes).toHaveLength(10);
    const { rows } = await ctx.db.query<{ mfa_secret: Buffer; mfa_recovery: unknown }>("SELECT mfa_secret, mfa_recovery FROM users WHERE username = 'fanny'");
    // Secret chiffré en base, codes de secours conservés sous forme d'empreintes.
    expect(rows[0].mfa_secret[0]).toBe(2);
    expect(JSON.stringify(rows[0].mfa_recovery)).not.toContain(client.recoveryCodes[0]);
  });

  it("demande le second facteur, refuse un code faux ou rejoué", async () => {
    const c = new Client(b);
    const step1 = await c.req("POST", "/api/auth/login", { username: "alice", password: "Horizon-Cloche-7q!" });
    expect(step1.json()).toEqual({ mfaRequired: true });
    // Pas d'accès entre les deux étapes.
    expect((await c.req("GET", "/api/studies")).statusCode).toBe(401);
    expect((await c.req("POST", "/api/auth/login/mfa", { code: "000000" })).statusCode).toBe(401);
    const code = await alice.totp();
    expect((await c.req("POST", "/api/auth/login/mfa", { code })).statusCode).toBe(200);
    expect((await c.req("GET", "/api/studies")).statusCode).toBe(200);
    const again = new Client(b);
    await again.req("POST", "/api/auth/login", { username: "alice", password: "Horizon-Cloche-7q!" });
    expect((await again.req("POST", "/api/auth/login/mfa", { code })).statusCode).toBe(401);
  });

  it("accepte chaque code de secours une seule fois", async () => {
    const recovery = alice.recoveryCodes[0];
    const c = new Client(b);
    await c.req("POST", "/api/auth/login", { username: "alice", password: "Horizon-Cloche-7q!" });
    const ok = await c.req("POST", "/api/auth/login/mfa", { recoveryCode: recovery.toUpperCase() });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().notice.recoveryCodesLeft).toBe(9);
    const d = new Client(b);
    await d.req("POST", "/api/auth/login", { username: "alice", password: "Horizon-Cloche-7q!" });
    expect((await d.req("POST", "/api/auth/login/mfa", { recoveryCode: recovery })).statusCode).toBe(401);
  });

  it("l'étape du second facteur expire sans mot de passe", async () => {
    const c = new Client(b);
    const r = await c.req("POST", "/api/auth/login/mfa", { code: "123456" });
    expect(r.statusCode).toBe(401);
    expect(r.json().restart).toBe(true);
  });

  it("réinitialisation par l'administrateur : sessions fermées, nouvel enrôlement exigé", async () => {
    const { client, id } = await newUser(admin, b, "gael", "Moulin-Estuaire-27");
    expect((await client.req("GET", "/api/studies")).statusCode).toBe(200);
    expect((await admin.req("PATCH", `/api/admin/users/${id}`, { resetMfa: true })).statusCode).toBe(200);
    expect((await client.req("GET", "/api/studies")).statusCode).toBe(401);
    client.totpSecret = null;
    await client.login("gael", "Moulin-Estuaire-27");
    expect((await client.req("GET", "/api/studies")).json().mustEnrollMfa).toBe(true);
  });
});

describe("sessions", () => {
  it("liste et révoque les sessions de l'utilisateur", async () => {
    const other = new Client(b);
    await other.req("POST", "/api/auth/login", { username: "bob", password: "Ardoise-Marine-58" });
    expect((await other.req("POST", "/api/auth/login/mfa", { code: await bob.totp() })).statusCode).toBe(200);
    const list = (await bob.req("GET", "/api/auth/sessions")).json();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    const target = list.find((s: { current: boolean }) => !s.current);
    expect((await bob.req("DELETE", `/api/auth/sessions/${target.id}`)).statusCode).toBe(200);
    expect((await other.req("GET", "/api/studies")).statusCode).toBe(401);
    expect((await bob.req("GET", "/api/studies")).statusCode).toBe(200);
  });

  it("la déconnexion (requête sans corps) détruit la session côté serveur", async () => {
    const c = new Client(b);
    await c.req("POST", "/api/auth/login", { username: "bob", password: "Ardoise-Marine-58" });
    await c.req("POST", "/api/auth/login/mfa", { code: await bob.totp() });
    const stolen = c.cookie;
    const out = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { "x-beffroi-csrf": "1", cookie: stolen } });
    expect(out.status).toBe(200);
    // Le jeton ne sert plus, même rejoué tel quel.
    expect((await fetch(`${base}/api/studies`, { headers: { cookie: stolen } })).status).toBe(401);
  });

  it("informe de la connexion précédente et des échecs depuis", async () => {
    const c = new Client(b);
    await c.req("POST", "/api/auth/login", { username: "alice", password: "Mauvais-Mot-2026" });
    await c.req("POST", "/api/auth/login", { username: "alice", password: "Horizon-Cloche-7q!" });
    const r = await c.req("POST", "/api/auth/login/mfa", { code: await alice.totp() });
    expect(r.statusCode).toBe(200);
    expect(r.json().notice.previousLogin).toBeTruthy();
    expect(r.json().notice.failuresSinceLastLogin).toBeGreaterThanOrEqual(1);
  });
});

describe("études", () => {
  let studyId = "";

  it("l'administrateur n'a pas accès aux analyses", async () => {
    expect((await admin.req("GET", "/api/studies")).statusCode).toBe(403);
    expect((await admin.req("POST", "/api/studies", { name: "x", protection: "NP" })).statusCode).toBe(403);
  });

  it("crée une étude à partir de l'exemple ANSSI", async () => {
    const r = await alice.req("POST", "/api/studies", { name: "BioTech", reference: "REF-42", organisation: "Laboratoire Nord", protection: "DR", template: "example" });
    expect(r.statusCode).toBe(200);
    studyId = r.json().id;
    expect(r.json()).toMatchObject({ major: 1, name: "BioTech", reference: "REF-42", organisation: "Laboratoire Nord" });
    expect(r.json().stats.risks).toEqual({ "2": 3, "3": 2 });
  });

  it("chiffre les documents et les métadonnées au repos", async () => {
    const { rows } = await ctx.db.query<{ data: Buffer; summary: string }>("SELECT data, summary FROM study_versions WHERE study_id = $1", [studyId]);
    const text = rows[0].data.toString("latin1");
    expect(text).not.toContain("vaccin");
    expect(text).not.toContain("Prestataire");
    expect(rows[0].data[0]).toBe(2);
    expect(rows[0].summary).toBe("");
    const s = (await ctx.db.query<{ name: string; reference: string; organisation: string; meta_enc: Buffer }>("SELECT name, reference, organisation, meta_enc FROM studies WHERE id = $1", [studyId])).rows[0];
    expect([s.name, s.reference, s.organisation]).toEqual(["", "", ""]);
    expect(s.meta_enc.toString("latin1")).not.toContain("BioTech");
    // Un chiffré lié à une étude ne peut pas être transposé sur une autre ligne.
    expect(() => ctx.store.openNames({ id: "autre", name: "", reference: "", organisation: "", meta_enc: s.meta_enc })).toThrow();
  });

  it("ne consigne pas le nom des analyses dans le journal (lu par l'administrateur)", async () => {
    const { rows } = await ctx.db.query<{ details: string }>("SELECT details FROM audit_log WHERE target_id = $1", [studyId]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !r.details.includes("BioTech"))).toBe(true);
  });

  it("applique le besoin d'en connaître", async () => {
    expect((await bob.req("GET", `/api/studies/${studyId}/data`)).statusCode).toBe(404);
    expect((await bob.req("GET", "/api/studies")).json()).toHaveLength(0);
  });

  it("partage en lecture puis en écriture", async () => {
    const acl = (await alice.req("GET", `/api/studies/${studyId}/acl`)).json();
    const owner = acl[0];
    await alice.req("PUT", `/api/studies/${studyId}/acl`, [
      { principalType: owner.principalType, principalId: owner.principalId, access: "owner" },
      { principalType: "user", principalId: bobId, access: "read" },
    ]);
    const got = await bob.req("GET", `/api/studies/${studyId}/data`);
    expect(got.statusCode).toBe(200);
    const put = await bob.req("PUT", `/api/studies/${studyId}/data`, { rev: got.json().meta.rev, data: got.json().data });
    expect(put.statusCode).toBe(403);
    // Un lecteur ne peut pas modifier les droits (ni s'octroyer la propriété).
    const grab = await bob.req("PUT", `/api/studies/${studyId}/acl`, [{ principalType: "user", principalId: bobId, access: "owner" }]);
    expect(grab.statusCode).toBe(403);

    const g = await admin.req("POST", "/api/admin/groups", { name: "Équipe SSI" });
    await admin.req("PATCH", `/api/admin/groups/${g.json().id}`, { memberIds: [bobId] });
    await alice.req("PUT", `/api/studies/${studyId}/acl`, [
      { principalType: owner.principalType, principalId: owner.principalId, access: "owner" },
      { principalType: "group", principalId: g.json().id, access: "write" },
    ]);
    const put2 = await bob.req("PUT", `/api/studies/${studyId}/data`, { rev: got.json().meta.rev, data: got.json().data });
    expect(put2.statusCode).toBe(200);
  });

  it("détecte les conflits d'édition", async () => {
    const got = (await alice.req("GET", `/api/studies/${studyId}/data`)).json();
    const ok = await alice.req("PUT", `/api/studies/${studyId}/data`, { rev: got.meta.rev, data: got.data });
    expect(ok.statusCode).toBe(200);
    const conflict = await bob.req("PUT", `/api/studies/${studyId}/data`, { rev: got.meta.rev, data: got.data });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().conflict).toBe(true);
  });

  it("sérialise les enregistrements simultanés (un seul passe le contrôle de révision)", async () => {
    const got = (await alice.req("GET", `/api/studies/${studyId}/data`)).json();
    const results = await Promise.all(Array.from({ length: 6 }, () => alice.req("PUT", `/api/studies/${studyId}/data`, { rev: got.meta.rev, data: got.data })));
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(5);
  });

  it("rejette un corps JSON malformé", async () => {
    const r = await fetch(`${base}/api/studies`, { method: "POST", headers: { "content-type": "application/json", "x-beffroi-csrf": "1", cookie: alice.cookie }, body: "{ pas du json" });
    expect(r.status).toBe(400);
  });

  it("refuse un document invalide ou incohérent", async () => {
    const got = (await alice.req("GET", `/api/studies/${studyId}/data`)).json();
    const bad = { ...got.data, riskSources: [] };
    const r = await alice.req("PUT", `/api/studies/${studyId}/data`, { rev: got.meta.rev, data: bad });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toMatch(/incohérent/);
    const r2 = await alice.req("PUT", `/api/studies/${studyId}/data`, { rev: got.meta.rev, data: { schemaVersion: 2 } });
    expect(r2.statusCode).toBe(400);
  });

  it("gère les versions x.y et leur synthèse", async () => {
    const got = (await alice.req("GET", `/api/studies/${studyId}/data`)).json();
    const v1 = await alice.req("POST", `/api/studies/${studyId}/versions`, { changeType: "operational", summary: "Mise à jour annuelle", workshops: [4] });
    expect(v1.json()).toMatchObject({ major: 1, minor: 1 });
    const data = got.data;
    data.fearedEvents[0].gravity = 4;
    const cur = (await alice.req("GET", `/api/studies/${studyId}`)).json();
    expect((await alice.req("PUT", `/api/studies/${studyId}/data`, { rev: cur.rev, data })).statusCode).toBe(200);
    const v2 = await alice.req("POST", `/api/studies/${studyId}/versions`, { changeType: "strategic", summary: "Revue triennale", workshops: [1, 2, 3, 4, 5] });
    expect(v2.json()).toMatchObject({ major: 2, minor: 0 });
    const versions = (await alice.req("GET", `/api/studies/${studyId}/versions`)).json();
    expect(versions.map((v: { major: number; minor: number }) => `${v.major}.${v.minor}`)).toEqual(["2.0", "1.1", "1.0"]);
    expect(versions.map((v: { summary: string }) => v.summary)).toEqual(["Revue triennale", "Mise à jour annuelle", "Version initiale"]);
    expect(versions[1].diff).toContainEqual({ workshop: 1, activity: "Événements redoutés", added: 0, modified: 1, removed: 0 });
    const old = await alice.req("GET", `/api/studies/${studyId}/data?version=${versions[2].id}`);
    expect(old.json().meta.frozen).toBe(true);
  });

  it("modifie les métadonnées chiffrées", async () => {
    const r = await alice.req("PATCH", `/api/studies/${studyId}`, { organisation: "Laboratoire Sud" });
    expect(r.json()).toMatchObject({ name: "BioTech", reference: "REF-42", organisation: "Laboratoire Sud" });
  });

  it("importe et duplique une étude", async () => {
    const got = (await alice.req("GET", `/api/studies/${studyId}/data`)).json();
    const imp = await alice.req("POST", "/api/studies/import", { name: "Import", protection: "NP", data: got.data });
    expect(imp.statusCode).toBe(200);
    const dup = await alice.req("POST", `/api/studies/${imp.json().id}/duplicate`, {});
    expect(dup.json().name).toBe("Import (copie)");
    expect((await alice.req("DELETE", `/api/studies/${dup.json().id}`)).statusCode).toBe(200);
  });
});

describe("journal d'audit", () => {
  it("trace les événements et vérifie la chaîne scellée", async () => {
    const log = (await admin.req("GET", "/api/admin/audit?limit=1000")).json();
    const actions = new Set(log.rows.map((r: { action: string }) => r.action));
    for (const a of [
      "auth.login.success",
      "auth.login.failure",
      "auth.lockout",
      "auth.mfa.enable",
      "auth.mfa.failure",
      "auth.mfa.recovery_used",
      "user.mfa_reset",
      "auth.session_revoke",
      "user.create",
      "study.create",
      "study.read",
      "study.write",
      "study.version_create",
      "study.acl_update",
      "access.denied",
    ]) {
      expect(actions).toContain(a);
    }
    expect(log.rows.every((r: { alg: string }) => r.alg === "hmac-sha256")).toBe(true);
    const v = (await admin.req("GET", "/api/admin/audit/verify")).json();
    expect(v.ok).toBe(true);
  });

  it("interdit en base la modification et la suppression du journal", async () => {
    await expect(ctx.db.query("UPDATE audit_log SET details = 'falsifié' WHERE seq = 3")).rejects.toThrow(/ajout seul/);
    await expect(ctx.db.query("DELETE FROM audit_log WHERE seq = 3")).rejects.toThrow(/ajout seul/);
    await expect(ctx.db.query("TRUNCATE audit_log")).rejects.toThrow(/ajout seul/);
    const purge = await admin.req("POST", "/api/admin/audit/purge", { before: new Date().toISOString() });
    expect(purge.statusCode).toBe(400);
  });

  it("détecte une altération, même en recalculant les empreintes sans la clé", async () => {
    // Attaquant disposant des droits du propriétaire de la base (déclencheurs désactivés).
    await ctx.db.query("ALTER TABLE audit_log DISABLE TRIGGER audit_log_guard");
    try {
      await ctx.db.query("UPDATE audit_log SET details = 'falsifié' WHERE seq = 3");
      let v = (await admin.req("GET", "/api/admin/audit/verify")).json();
      expect(v).toMatchObject({ ok: false, brokenAt: 3 });

      // Rétrogradation : réécriture complète du journal en SHA-256 simple (calculable sans la clé).
      const { rows } = await ctx.db.query("SELECT * FROM audit_log ORDER BY seq");
      let prev = "0".repeat(64);
      for (const r of rows) {
        const h = sha256([prev, r.ts, r.user_id ?? "", r.username, r.ip, r.action, r.target_type, r.target_id, r.details].join("␟"));
        await ctx.db.query("UPDATE audit_log SET alg = 'sha256', key_id = '', prev_hash = $1, hash = $2 WHERE seq = $3", [prev, h, r.seq]);
        prev = h;
      }
      v = (await admin.req("GET", "/api/admin/audit/verify")).json();
      expect(v.ok).toBe(false);
    } finally {
      await ctx.db.query("ALTER TABLE audit_log ENABLE TRIGGER audit_log_guard");
    }
  });
});
