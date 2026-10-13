import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootstrapAdmin, buildApp, type AppContext } from "../src/app.js";
import { loadConfig, type Config } from "../src/config.js";
import { createPool } from "../src/db.js";
import { Client } from "./helpers.js";

/**
 * Authentification OpenID Connect face à un fournisseur d'identité de test (découverte, autorisation,
 * jeton d'identité signé RS256, JWKS), dont les réponses sont contrôlées par chaque test.
 */
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? `postgres://${os.userInfo().username}@localhost/postgres?host=/var/run/postgresql`;
const DB_NAME = `beffroi_oidc_${randomBytes(4).toString("hex")}`;
const ADMIN_PW = "Initial-Admin-Pw-2026";

// ─────────── fournisseur d'identité de test ───────────

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test", alg: "RS256", use: "sig" };
const b64 = (v: object | Buffer) => (Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v))).toString("base64url");
const jwt = (claims: object) => {
  const input = `${b64({ alg: "RS256", kid: "test", typ: "JWT" })}.${b64(claims)}`;
  return `${input}.${b64(sign("RSA-SHA256", Buffer.from(input), privateKey))}`;
};

/** Identité et comportement du fournisseur pour la prochaine authentification. */
const op = {
  identity: { sub: "sub-alice", preferred_username: "alice.sso", name: "Alice Martin", email: "alice@example.org" } as Record<string, string>,
  acr: "mfa",
  tamperNonce: false,
  codes: new Map<string, { nonce: string; challenge: string }>(),
};
let opBase = "";
const opServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", opBase);
  const sendJson = (status: number, body: object) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/.well-known/openid-configuration") {
    return sendJson(200, {
      issuer: opBase,
      authorization_endpoint: `${opBase}/authorize`,
      token_endpoint: `${opBase}/token`,
      jwks_uri: `${opBase}/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    });
  }
  if (url.pathname === "/jwks") return sendJson(200, { keys: [jwk] });
  if (url.pathname === "/authorize") {
    // Authentification immédiate de l'identité configurée.
    const code = randomBytes(16).toString("hex");
    op.codes.set(code, { nonce: url.searchParams.get("nonce") ?? "", challenge: url.searchParams.get("code_challenge") ?? "" });
    const back = new URL(url.searchParams.get("redirect_uri") ?? "");
    back.searchParams.set("code", code);
    back.searchParams.set("state", url.searchParams.get("state") ?? "");
    res.writeHead(302, { location: back.href });
    return res.end();
  }
  if (url.pathname === "/token" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    // Authentification du client : client_secret_basic ou client_secret_post, comme les fournisseurs usuels.
    const basic = Buffer.from((req.headers.authorization ?? "").replace(/^Basic /, ""), "base64").toString();
    const auth = basic.includes(":") ? basic : `${params.get("client_id")}:${params.get("client_secret")}`;
    const grant = op.codes.get(params.get("code") ?? "");
    op.codes.delete(params.get("code") ?? "");
    const verifier = params.get("code_verifier") ?? "";
    if (auth !== "beffroi:secret-de-test" || !grant || createHash("sha256").update(verifier).digest("base64url") !== grant.challenge) {
      return sendJson(400, { error: "invalid_grant" });
    }
    const t = Math.floor(Date.now() / 1000);
    return sendJson(200, {
      access_token: randomBytes(16).toString("hex"),
      token_type: "Bearer",
      expires_in: 300,
      id_token: jwt({ iss: opBase, aud: "beffroi", iat: t, exp: t + 300, nonce: op.tamperNonce ? "autre" : grant.nonce, acr: op.acr, ...op.identity }),
    });
  }
  sendJson(404, { error: "not_found" });
});

// ─────────── application ───────────

let server: http.Server;
let base = "";
let ctx: AppContext;
let config: Config;

beforeAll(async () => {
  opServer.listen(0, "127.0.0.1");
  await new Promise((r) => opServer.once("listening", r));
  opBase = `http://127.0.0.1:${(opServer.address() as AddressInfo).port}`;

  const adminDb = new pg.Client({ connectionString: ADMIN_URL });
  await adminDb.connect();
  await adminDb.query(`CREATE DATABASE ${DB_NAME}`);
  await adminDb.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${DB_NAME}`;

  server = http.createServer();
  server.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  config = {
    ...loadConfig({}),
    databaseUrl: url.toString(),
    dataDir: path.join(os.tmpdir(), DB_NAME),
    bootstrapAdminPassword: ADMIN_PW,
    logLevel: "error",
    oidc: {
      issuer: opBase,
      clientId: "beffroi",
      clientSecret: "secret-de-test",
      redirectUri: `${base}/api/auth/oidc/callback`,
      scopes: "openid profile email",
      label: "Connexion SSO",
      autoCreate: true,
      acrValues: "mfa",
      allowHttp: true,
    },
  };
  const built = await buildApp(config, { db: createPool({ connectionString: config.databaseUrl, max: 4 }) });
  ctx = built.ctx;
  server.on("request", built.app);
  await bootstrapAdmin(ctx);
});

afterAll(async () => {
  await new Promise((r) => server?.close(r));
  await new Promise((r) => opServer.close(r));
  await ctx?.db.end();
  const adminDb = new pg.Client({ connectionString: ADMIN_URL });
  await adminDb.connect();
  await adminDb.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  await adminDb.end();
});

/** Suit le parcours complet navigateur ↔ Beffroi RM ↔ fournisseur ; renvoie le cookie de session et la redirection finale. */
async function ssoLogin(): Promise<{ cookie: string; location: string; callback: string }> {
  const start = await fetch(`${base}/api/auth/oidc/login`, { redirect: "manual" });
  expect(start.status).toBe(302);
  const authorize = await fetch(start.headers.get("location") as string, { redirect: "manual" });
  const callback = authorize.headers.get("location") as string;
  const done = await fetch(callback, { redirect: "manual" });
  const sid = done.headers.getSetCookie().find((c) => c.startsWith("beffroi_sid="));
  return { cookie: sid ? sid.split(";")[0] : "", location: done.headers.get("location") ?? "", callback };
}

const me = async (cookie: string) => (await (await fetch(`${base}/api/auth/me`, { headers: { cookie } })).json()) as { user: Record<string, unknown> | null; auth: unknown };

const ADMIN_NEW = "Veilleur-Tour-Nord-2026";
let adminSession: Client | null = null;
/** Session administrateur : mot de passe initial changé et second facteur enrôlé au premier appel. */
async function adminClient(): Promise<string> {
  if (!adminSession) {
    adminSession = new Client(() => base);
    await adminSession.login("admin", ADMIN_PW);
    await adminSession.req("POST", "/api/auth/password", { current: ADMIN_PW, next: ADMIN_NEW });
    await adminSession.enrollMfa(ADMIN_NEW);
  }
  return adminSession.cookie;
}

describe("authentification OpenID Connect", () => {
  it("annonce le mode de connexion au client", async () => {
    expect((await me("")).auth).toEqual({ localLogin: true, oidc: { label: "Connexion SSO" } });
  });

  it("crée le compte à la première connexion puis le reconnaît", async () => {
    const first = await ssoLogin();
    expect(first.location).toBe("/");
    const u1 = (await me(first.cookie)).user;
    expect(u1).toMatchObject({ username: "alice.sso", displayName: "Alice Martin", role: "user", authSource: "oidc", mustChange: false });
    const studies = await fetch(`${base}/api/studies`, { headers: { cookie: first.cookie } });
    expect(studies.status).toBe(200);

    op.identity = { ...op.identity, name: "Alice Martin-Durand" };
    const second = await ssoLogin();
    const u2 = (await me(second.cookie)).user;
    expect(u2?.id).toBe(u1?.id);
    expect(u2?.displayName).toBe("Alice Martin-Durand");
  });

  it("refuse la connexion par mot de passe d'un compte OIDC (réponse identique à un échec ordinaire)", async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-beffroi-csrf": "1" },
      body: JSON.stringify({ username: "alice.sso", password: "!" }),
    });
    expect(r.status).toBe(401);
  });

  it("n'impose pas de second facteur local aux comptes OIDC (délégué au fournisseur)", async () => {
    const { cookie } = await ssoLogin();
    expect((await me(cookie)).user).toMatchObject({ mustEnrollMfa: false, authSource: "oidc" });
  });

  it("rejette le rejeu d'une réponse (state à usage unique)", async () => {
    const { callback } = await ssoLogin();
    const replay = await fetch(callback, { redirect: "manual" });
    expect(replay.headers.get("location")).toMatch(/^\/connexion\?erreur=/);
    expect(replay.headers.getSetCookie().some((c) => c.startsWith("beffroi_sid="))).toBe(false);
  });

  it("rejette un jeton dont le nonce ne correspond pas", async () => {
    op.tamperNonce = true;
    const r = await ssoLogin();
    op.tamperNonce = false;
    expect(r.cookie).toBe("");
    expect(decodeURIComponent(r.location)).toMatch(/invalide/);
  });

  it("exige le niveau d'authentification demandé (MFA)", async () => {
    op.acr = "pwd";
    const r = await ssoLogin();
    op.acr = "mfa";
    expect(r.cookie).toBe("");
    expect(decodeURIComponent(r.location)).toMatch(/multifacteur/);
  });

  it("sans création automatique, n'accepte que les comptes pré-créés par l'administrateur", async () => {
    config.oidc!.autoCreate = false;
    op.identity = { sub: "sub-zoe", preferred_username: "zoe", name: "Zoé Leroy", email: "zoe@example.org" };
    const refused = await ssoLogin();
    expect(refused.cookie).toBe("");
    expect(decodeURIComponent(refused.location)).toMatch(/contactez l'administrateur/);

    const admin = await adminClient();
    const created = await fetch(`${base}/api/admin/users`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-beffroi-csrf": "1", cookie: admin },
      body: JSON.stringify({ username: "zoe", displayName: "Zoé", authSource: "oidc" }),
    });
    expect(created.status).toBe(200);
    expect(((await created.json()) as { temporaryPassword?: string }).temporaryPassword).toBeUndefined();

    const accepted = await ssoLogin();
    expect((await me(accepted.cookie)).user).toMatchObject({ username: "zoe", authSource: "oidc" });
    config.oidc!.autoCreate = true;
  });

  it("LOCAL_LOGIN=false : mot de passe refusé aux analystes, accès de secours conservé pour l'administrateur", async () => {
    const admin = await adminClient();
    const created = (await (
      await fetch(`${base}/api/admin/users`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-beffroi-csrf": "1", cookie: admin },
        body: JSON.stringify({ username: "marc", displayName: "Marc" }),
      })
    ).json()) as { temporaryPassword: string };
    const login = (username: string, password: string) =>
      fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", "x-beffroi-csrf": "1" }, body: JSON.stringify({ username, password }) });
    config.localLogin = false;
    expect((await login("marc", created.temporaryPassword)).status).toBe(401);
    const adminLogin = await login("admin", ADMIN_NEW);
    expect(adminLogin.status).toBe(200);
    expect(await adminLogin.json()).toEqual({ mfaRequired: true });
    config.localLogin = true;
    expect((await login("marc", created.temporaryPassword)).status).toBe(200);
  });

  it("journalise les connexions et les refus", async () => {
    const { rows } = await ctx.db.query<{ action: string; details: string }>("SELECT action, details FROM audit_log WHERE action LIKE 'auth.login.%' OR action = 'user.oidc_link'");
    expect(rows.some((r) => r.action === "auth.login.success" && r.details.includes('"oidc"'))).toBe(true);
    expect(rows.some((r) => r.action === "auth.login.failure" && r.details.includes("multifacteur"))).toBe(true);
    expect(rows.some((r) => r.action === "user.oidc_link")).toBe(true);
    expect((await ctx.audit.verify()).ok).toBe(true);
  });
});
