import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { AuditLog } from "./audit.js";
import { actor, HttpError, sessionCookieName, Sessions, toSessionUser } from "./auth.js";
import type { Config } from "./config.js";
import { generatePassword, Passwords } from "./crypto.js";
import { createPool, grantAppRole, migrate, now, one, privilegeWarnings, type DB } from "./db.js";
import { APP_VERSION, createLogger, type AppContext } from "./http.js";
import { Keyring, Sealer } from "./keys.js";
import { rewrap } from "./maintenance.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { studyRoutes } from "./routes/studies.js";
import { OidcClient } from "./oidc.js";
import { StudyStore } from "./studies.js";
import { requestGuards, securityHeaders } from "./web-security.js";

export { APP_VERSION, type AppContext };

/** Limitation de débit par adresse IP (fenêtre d'une minute), en mémoire de l'instance. */
function rateLimiter(perMinute: number) {
  const hits = new Map<string, { start: number; n: number }>();
  return (ip: string): boolean => {
    const t = Date.now();
    if (hits.size > 50_000) for (const [k, v] of hits) if (t - v.start > 60_000) hits.delete(k);
    const h = hits.get(ip);
    if (!h || t - h.start > 60_000) {
      hits.set(ip, { start: t, n: 1 });
      return true;
    }
    h.n++;
    return h.n <= perMinute;
  };
}

export async function buildApp(config: Config, opts: { db?: DB } = {}): Promise<{ app: Express; ctx: AppContext }> {
  const log = createLogger(config.logLevel);
  const poolOpts = { ssl: config.databaseSsl, sslCa: config.databaseSslCa };
  const db = opts.db ?? createPool({ connectionString: config.databaseUrl, max: config.databasePoolSize, ...poolOpts });

  // Migrations par le rôle propriétaire du schéma, puis droits minimaux pour le rôle applicatif.
  if (config.databaseMigrationUrl) {
    const owner = createPool({ connectionString: config.databaseMigrationUrl, max: 1, ...poolOpts });
    try {
      await migrate(owner);
      const appRole = (await one<{ u: string }>(db, "SELECT current_user AS u"))!.u;
      const ownerRole = (await one<{ u: string }>(owner, "SELECT current_user AS u"))!.u;
      if (appRole !== ownerRole) await grantAppRole(owner, appRole);
    } finally {
      await owner.end();
    }
  } else {
    try {
      await migrate(db);
    } catch (e) {
      throw new Error(`Migration du schéma impossible avec le rôle applicatif (${(e as Error).message}) : lancez « server.js --migrate » avec le rôle propriétaire (DATABASE_MIGRATION_URL).`);
    }
  }
  for (const w of await privilegeWarnings(db)) log.warn(`Base de données : ${w}.`);

  fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  const keys = Keyring.load(config.dataDir, config.masterKey, config.previousMasterKeys);
  const sealer = new Sealer(keys);
  const passwords = new Passwords(keys, { allowLegacy: config.allowLegacyPasswordHashes });
  const audit = new AuditLog(db, keys, { stdout: config.auditStdout });
  const sessions = new Sessions(db, config);
  const store = new StudyStore(db, sealer);
  const oidc = config.oidc ? new OidcClient(config.oidc, db) : null;
  const ctx: AppContext = { db, audit, sessions, store, config, log, oidc, keys, sealer, passwords };

  await audit.upgradeLegacy();
  const report = await rewrap(db, keys, sealer, store);
  if (report.studies || report.versions || report.mfa) {
    log.info(`Chiffrement mis à niveau : ${report.studies} étude(s), ${report.versions} version(s), ${report.mfa} secret(s) MFA.`);
    await audit.write({ userId: null, username: "system", ip: "" }, "crypto.rewrap", "app", "", { ...report, keyId: keys.current.id });
  }
  if (report.stalePasswords && config.previousMasterKeys.length) {
    log.warn(`${report.stalePasswords} mot(s) de passe encore liés à une clé précédente : conservez-la jusqu'à la reconnexion de ces comptes (ou réinitialisez-les).`);
  }
  if (report.legacyPasswords && !config.allowLegacyPasswordHashes) {
    log.warn(
      `${report.legacyPasswords} compte(s) local(aux) ont encore un mot de passe de l'ancien format (sans poivre), désormais refusé : ces utilisateurs ne peuvent plus se connecter. ` +
        "Activez temporairement ALLOW_LEGACY_PASSWORD_HASHES=true le temps de leur reconnexion (leur mot de passe est alors renouvelé), ou faites réinitialiser leur mot de passe par un administrateur.",
    );
  } else if (report.legacyPasswords) {
    log.warn(`ALLOW_LEGACY_PASSWORD_HASHES=true : ${report.legacyPasswords} compte(s) local(aux) restent à renouveler (mot de passe de l'ancien format, renouvelé à la prochaine connexion).`);
  } else if (config.allowLegacyPasswordHashes) {
    log.warn("ALLOW_LEGACY_PASSWORD_HASHES=true alors qu'aucun mot de passe de l'ancien format ne subsiste : retirez ce réglage.");
  }
  if (config.mfaPolicy !== "required") log.warn(`Authentification multifacteur non exigée pour tous les comptes locaux (MFA_POLICY=${config.mfaPolicy}).`);
  if (!config.cookieSecure) log.warn("Cookies sans attribut Secure : servez Beffroi RM en HTTPS (TLS_CERT/TLS_KEY) ou derrière un reverse proxy HTTPS avec COOKIE_SECURE=true.");

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.set("etag", false);
  app.use(securityHeaders(config.cookieSecure));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => log.info(`${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${Date.now() - start} ms`));
    next();
  });

  // ─────────── API ───────────
  const api = express.Router();
  const allow = rateLimiter(config.rateLimitPerMinute);
  const cookieName = sessionCookieName(config);
  api.use((req, _res, next) => {
    if (!allow(req.ip ?? "")) throw new HttpError(429, "Trop de requêtes : patientez une minute.");
    next();
  });
  // Exception : le retour du fournisseur d'identité (navigation de premier niveau).
  api.use(requestGuards((req) => req.method === "GET" && req.get("sec-fetch-mode") === "navigate" && req.path.startsWith("/auth/oidc/")));
  api.use(express.json({ limit: "20mb", strict: true }));
  api.use(cookieParser());
  // Résolution de la session.
  api.use(async (req, res, next) => {
    req.user = null;
    req.sessionHash = null;
    const s = await sessions.resolve(req.cookies?.[cookieName]);
    // Un compte doté d'un second facteur n'est jamais servi par une session ouverte sans lui.
    if (s && !s.expired && s.user.mfa_secret && !s.mfa) {
      await sessions.destroy(s.hash);
      res.clearCookie(cookieName, { path: "/" });
    } else if (s && !s.expired) {
      req.user = toSessionUser(s.user, config.mfaPolicy);
      req.sessionHash = s.hash;
    } else if (s?.expired) {
      await audit.write({ userId: s.user.id, username: s.user.username, ip: req.ip ?? "" }, "auth.session_expired");
    }
    next();
  });
  api.use(authRoutes(ctx));
  api.use(adminRoutes(ctx));
  api.use(studyRoutes(ctx));
  api.get("/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true });
  });
  api.use(() => {
    throw new HttpError(404, "Ressource inconnue.");
  });
  app.use("/api", api);

  // ─────────── client web ───────────
  const staticDir = config.staticDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  const index = path.join(staticDir, "index.html");
  if (fs.existsSync(index)) {
    app.use(express.static(staticDir, { index: "index.html", dotfiles: "ignore", maxAge: "1h" }));
    app.get("/{*chemin}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(index);
    });
  }

  // ─────────── erreurs ───────────
  app.use(async (err: Error & { status?: number; type?: string }, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      if ((err.status === 403 || err.status === 404) && req.user) {
        await audit.write(actor(req), "access.denied", "url", req.originalUrl.slice(0, 200), { status: err.status }).catch((e) => log.error("journal", e));
      }
      res.status(err.status).json({ error: err.message, ...err.extra });
      return;
    }
    if (err.type === "entity.parse.failed") return void res.status(400).json({ error: "Corps de requête JSON invalide." });
    if (err.type === "entity.too.large") return void res.status(413).json({ error: "Requête trop volumineuse." });
    if (err.status && err.status < 500) return void res.status(err.status).json({ error: "Requête invalide." });
    log.error(`${req.method} ${req.originalUrl.split("?")[0]}`, err);
    res.status(500).json({ error: "Erreur interne du serveur." });
  });

  return { app, ctx };
}

/** Crée le compte administrateur au premier démarrage. */
export async function bootstrapAdmin(ctx: AppContext): Promise<string | null> {
  const count = await one<{ n: number }>(ctx.db, "SELECT count(*) AS n FROM users WHERE role = 'admin'");
  if ((count?.n ?? 0) > 0) return null;
  const password = ctx.config.bootstrapAdminPassword ?? generatePassword();
  const id = randomUUID();
  const t = now();
  await ctx.db.query(
    "INSERT INTO users (id, username, display_name, role, can_create, password_hash, must_change, created_at, updated_at) VALUES ($1,'admin','Administrateur','admin',FALSE,$2,TRUE,$3,$3)",
    [id, await ctx.passwords.hash(password), t],
  );
  await ctx.audit.write({ userId: null, username: "system", ip: "" }, "user.create", "user", id, { username: "admin", role: "admin", bootstrap: true });
  return password;
}
