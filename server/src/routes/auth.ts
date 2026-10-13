import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  actor,
  HttpError,
  mfaCookieName,
  mfaRequired,
  requireAnalyst,
  requireSession,
  requireUser,
  sessionCookieName,
  setSessionCookie,
  toSessionUser,
  type UserRow,
} from "../auth.js";
import { passwordPolicyError, randomToken, safeEqual, sha256 } from "../crypto.js";
import { all, now, one, tx } from "../db.js";
import { newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, otpauthUri, qrSvg, verifyTotp } from "../mfa.js";
import type { OidcIdentity } from "../oidc.js";
import { APP_VERSION, json, parse, type AppContext } from "../http.js";

/** Délai de saisie du second facteur après un mot de passe correct. */
const MFA_CHALLENGE_MS = 5 * 60_000;
/** Nombre d'anciens mots de passe interdits à la réutilisation. */
const PASSWORD_HISTORY = 5;

const code = z.string().trim().max(40);

export function authRoutes(ctx: AppContext): Router {
  const { db, audit, sessions, config, oidc, passwords, sealer, keys } = ctx;
  const r = Router();
  const getUser = (id: string) => one<UserRow>(db, "SELECT * FROM users WHERE id = $1", [id]);
  const sessionUser = (u: UserRow) => toSessionUser(u, config.mfaPolicy);

  const openSession = async (req: Request, res: Response, user: UserRow, method: "password" | "oidc", mfa: boolean) => {
    const ip = req.ip ?? "";
    await db.query("UPDATE users SET failed_attempts = 0, locked_until = 0, previous_login = last_login, last_login = $1 WHERE id = $2", [now(), user.id]);
    const token = await sessions.create(user.id, ip, String(req.headers["user-agent"] ?? ""), mfa);
    setSessionCookie(res, token, config);
    await audit.write({ userId: user.id, username: user.username, ip }, "auth.login.success", "user", user.id, { method, mfa });
    // Information de l'utilisateur : connexion précédente et échecs depuis (détection d'un usage frauduleux).
    const failures = await one<{ n: number }>(
      db,
      "SELECT count(*) AS n FROM audit_log WHERE user_id = $1 AND action IN ('auth.login.failure', 'auth.mfa.failure') AND ts > COALESCE($2::timestamptz, 'epoch')",
      [user.id, user.last_login],
    );
    return { previousLogin: user.last_login, failuresSinceLastLogin: failures?.n ?? 0 };
  };

  /** Échec d'authentification : compteur par compte et verrouillage temporaire. */
  const recordFailure = async (user: UserRow, ip: string, action: string, reason: string) => {
    const attempts = user.failed_attempts + 1;
    const lock = attempts >= config.maxFailedLogins;
    await db.query("UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3", [lock ? 0 : attempts, lock ? Date.now() + config.lockoutMinutes * 60_000 : 0, user.id]);
    await audit.write({ userId: user.id, username: user.username, ip }, action, "user", user.id, { reason });
    if (lock) await audit.write({ userId: user.id, username: user.username, ip }, "auth.lockout", "user", user.id, { minutes: config.lockoutMinutes });
  };

  // Limitation par adresse IP (20 tentatives par minute par défaut), en complément du verrouillage par compte.
  const loginAttempts = new Map<string, number[]>();
  const throttle = (ip: string) => {
    const t = Date.now();
    if (loginAttempts.size > 10_000) for (const [k, ts] of loginAttempts) if (!ts.some((x) => t - x < 60_000)) loginAttempts.delete(k);
    const w = loginAttempts.get(ip)?.filter((x) => t - x < 60_000) ?? [];
    if (w.length >= config.loginRateLimitPerMinute) throw new HttpError(429, "Trop de tentatives, réessayez dans une minute.");
    w.push(t);
    loginAttempts.set(ip, w);
  };

  r.post(
    "/auth/login",
    json(async (req, res) => {
      const body = parse(z.object({ username: z.string().max(200), password: z.string().max(300) }), req.body);
      const ip = req.ip ?? "";
      throttle(ip);
      const generic = new HttpError(401, "Identifiant ou mot de passe incorrect.");
      const user = await one<UserRow>(db, "SELECT * FROM users WHERE lower(username) = lower($1)", [body.username.trim()]);
      // Même réponse et même durée pour un compte inconnu, désactivé ou sans mot de passe local :
      // la réponse ne révèle pas l'existence d'un compte.
      const passwordLogin = user && !user.disabled && user.auth_source === "local" && (user.role === "admin" || config.localLogin);
      if (!user || !passwordLogin) {
        await passwords.burn(body.password);
        await audit.write({ userId: user?.id ?? null, username: body.username.slice(0, 100), ip }, "auth.login.failure", "user", user?.id ?? "", {
          reason: !user ? "unknown_user" : user.disabled ? "disabled" : "password_login_disabled",
        });
        throw generic;
      }
      const check = await passwords.verify(body.password, user.password_hash);
      if (user.locked_until > Date.now()) {
        await audit.write({ userId: user.id, username: user.username, ip }, "auth.login.failure", "user", user.id, { reason: "locked" });
        // Le verrouillage n'est signalé qu'à qui connaît le mot de passe.
        if (check.ok) throw new HttpError(423, "Compte temporairement verrouillé suite à des échecs d'authentification.");
        throw generic;
      }
      if (!check.ok) {
        await recordFailure(user, ip, "auth.login.failure", "bad_password");
        throw generic;
      }
      // Empreinte recalculée avec les paramètres et la clé courants.
      if (check.stale) await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await passwords.hash(body.password), user.id]);

      if (user.mfa_secret) {
        const token = randomToken(32);
        await db.query("DELETE FROM mfa_challenges WHERE user_id = $1", [user.id]);
        await db.query("INSERT INTO mfa_challenges (token_hash, user_id, created_at) VALUES ($1, $2, $3)", [sha256(token), user.id, Date.now()]);
        res.cookie(mfaCookieName(config), token, { httpOnly: true, sameSite: "strict", secure: config.cookieSecure, path: "/", maxAge: MFA_CHALLENGE_MS });
        await audit.write({ userId: user.id, username: user.username, ip }, "auth.mfa.challenge", "user", user.id);
        return { mfaRequired: true };
      }
      const notice = await openSession(req, res, user, "password", false);
      return { user: sessionUser(user), notice };
    }),
  );

  /** Second facteur : code TOTP (anti-rejeu) ou code de secours à usage unique. */
  r.post(
    "/auth/login/mfa",
    json(async (req, res) => {
      const body = parse(z.object({ code: code.optional(), recoveryCode: code.optional() }), req.body);
      const ip = req.ip ?? "";
      throttle(ip);
      const token = req.cookies?.[mfaCookieName(config)];
      const expired = new HttpError(401, "Session de connexion expirée : saisissez à nouveau votre mot de passe.", { restart: true });
      if (!token || typeof token !== "string" || token.length > 100) throw expired;
      const ch = await one<{ user_id: string; created_at: number; attempts: number }>(db, "SELECT user_id, created_at, attempts FROM mfa_challenges WHERE token_hash = $1", [sha256(token)]);
      if (!ch || Date.now() - ch.created_at > MFA_CHALLENGE_MS || ch.attempts >= 5) throw expired;
      const user = await getUser(ch.user_id);
      if (!user || user.disabled || !user.mfa_secret) throw expired;
      if (user.locked_until > Date.now()) throw new HttpError(423, "Compte temporairement verrouillé suite à des échecs d'authentification.");

      let ok = false;
      let method = "totp";
      if (body.code) {
        const secret = Buffer.from(sealer.open("mfa-secret", user.mfa_secret, `mfa:${user.id}`), "base64");
        const step = verifyTotp(secret, body.code, user.mfa_last_step);
        // Mise à jour conditionnelle : deux requêtes simultanées ne peuvent pas consommer le même code.
        if (step !== null) ok = ((await db.query("UPDATE users SET mfa_last_step = $1 WHERE id = $2 AND mfa_last_step < $1", [step, user.id])).rowCount ?? 0) > 0;
      } else if (body.recoveryCode) {
        method = "recovery";
        ok = await consumeRecoveryCode(user, body.recoveryCode);
      }
      if (!ok) {
        await db.query("UPDATE mfa_challenges SET attempts = attempts + 1 WHERE token_hash = $1", [sha256(token)]);
        await recordFailure(user, ip, "auth.mfa.failure", method === "recovery" ? "bad_recovery_code" : "bad_code");
        throw new HttpError(401, "Code incorrect ou déjà utilisé.");
      }
      await db.query("DELETE FROM mfa_challenges WHERE user_id = $1", [user.id]);
      res.clearCookie(mfaCookieName(config), { path: "/" });
      if (method === "recovery") await audit.write({ userId: user.id, username: user.username, ip }, "auth.mfa.recovery_used", "user", user.id);
      const notice = await openSession(req, res, user, "password", true);
      const remaining = method === "recovery" ? ((await getUser(user.id))?.mfa_recovery.length ?? 0) : undefined;
      return { user: sessionUser(user), notice: { ...notice, recoveryCodesLeft: remaining } };
    }),
  );

  const consumeRecoveryCode = async (user: UserRow, input: string): Promise<boolean> => {
    const n = normalizeRecoveryCode(input);
    if (n.length !== 12) return false;
    return tx(db, async (c) => {
      const u = await one<{ mfa_recovery: { k: string; m: string }[] }>(c, "SELECT mfa_recovery FROM users WHERE id = $1 FOR UPDATE", [user.id]);
      const list = u?.mfa_recovery ?? [];
      const i = list.findIndex((x) => keys.has(x.k) && safeEqual(keys.mac("recovery-code", `${user.id}:${n}`, x.k), x.m));
      if (i < 0) return false;
      await c.query("UPDATE users SET mfa_recovery = $1 WHERE id = $2", [JSON.stringify(list.filter((_, j) => j !== i)), user.id]);
      return true;
    });
  };

  const sealRecoveryCodes = (userId: string, codes: string[]) =>
    JSON.stringify(codes.map((c) => ({ k: keys.current.id, m: keys.mac("recovery-code", `${userId}:${normalizeRecoveryCode(c)}`) })));

  /** Ré-authentification par mot de passe avant une opération sensible (comptes locaux). */
  const stepUp = async (req: Request, u: UserRow, password: string | undefined) => {
    if (u.auth_source !== "local") throw new HttpError(400, "Ce compte s'authentifie auprès du fournisseur d'identité de l'organisation.");
    const ok = password ? (await passwords.verify(password, u.password_hash)).ok : false;
    if (!ok) {
      await recordFailure(u, req.ip ?? "", "auth.reauth.failure", "bad_password");
      throw new HttpError(400, "Mot de passe incorrect.");
    }
  };

  const verifyUserCode = async (u: UserRow, input: string | undefined): Promise<boolean> => {
    if (!u.mfa_secret || !input) return false;
    const secret = Buffer.from(sealer.open("mfa-secret", u.mfa_secret, `mfa:${u.id}`), "base64");
    const step = verifyTotp(secret, input, u.mfa_last_step);
    return step !== null && ((await db.query("UPDATE users SET mfa_last_step = $1 WHERE id = $2 AND mfa_last_step < $1", [step, u.id])).rowCount ?? 0) > 0;
  };

  // ─────────── enrôlement du second facteur ───────────

  r.post(
    "/auth/mfa/setup",
    json(async (req) => {
      const su = requireSession(req);
      const body = parse(z.object({ password: z.string().max(300) }), req.body);
      const u = (await getUser(su.id)) as UserRow;
      await stepUp(req, u, body.password);
      if (u.mfa_secret) throw new HttpError(409, "L'authentification multifacteur est déjà active.");
      const secret = newTotpSecret();
      await db.query("UPDATE users SET mfa_pending = $1 WHERE id = $2", [sealer.seal("mfa-secret", secret.toString("base64"), `mfa-pending:${u.id}`), u.id]);
      const uri = otpauthUri(secret, u.username, "Beffroi RM");
      await audit.write(actor(req), "auth.mfa.setup", "user", u.id);
      return {
        uri,
        secret: uri.match(/secret=([A-Z2-7]+)/)![1].replace(/(.{4})/g, "$1 ").trim(),
        qr: `data:image/svg+xml;base64,${Buffer.from(qrSvg(uri)).toString("base64")}`,
      };
    }),
  );

  r.post(
    "/auth/mfa/activate",
    json(async (req, res) => {
      const su = requireSession(req);
      const body = parse(z.object({ code }), req.body);
      const u = (await getUser(su.id)) as UserRow;
      if (u.mfa_secret) throw new HttpError(409, "L'authentification multifacteur est déjà active.");
      if (!u.mfa_pending) throw new HttpError(400, "Aucun enrôlement en cours.");
      const secretB64 = sealer.open("mfa-secret", u.mfa_pending, `mfa-pending:${u.id}`);
      const step = verifyTotp(Buffer.from(secretB64, "base64"), body.code, 0);
      if (step === null) {
        await audit.write(actor(req), "auth.mfa.failure", "user", u.id, { reason: "enrolment_bad_code" });
        throw new HttpError(400, "Code incorrect : vérifiez l'heure de votre téléphone et saisissez le code affiché.");
      }
      const codes = newRecoveryCodes();
      await db.query(
        "UPDATE users SET mfa_secret = $1, mfa_pending = NULL, mfa_last_step = $2, mfa_recovery = $3, mfa_enabled_at = $4, updated_at = $4 WHERE id = $5",
        [sealer.seal("mfa-secret", secretB64, `mfa:${u.id}`), step, sealRecoveryCodes(u.id, codes), now(), u.id],
      );
      // Élévation du niveau d'authentification : nouvelle session, toutes les autres sont fermées.
      await sessions.destroyForUser(u.id);
      setSessionCookie(res, await sessions.create(u.id, req.ip ?? "", String(req.headers["user-agent"] ?? ""), true), config);
      await audit.write(actor(req), "auth.mfa.enable", "user", u.id);
      return { user: sessionUser((await getUser(u.id)) as UserRow), recoveryCodes: codes };
    }),
  );

  r.post(
    "/auth/mfa/recovery-codes",
    json(async (req) => {
      const su = requireUser(req);
      const body = parse(z.object({ password: z.string().max(300), code }), req.body);
      const u = (await getUser(su.id)) as UserRow;
      await stepUp(req, u, body.password);
      if (!(await verifyUserCode(u, body.code))) throw new HttpError(400, "Code incorrect ou déjà utilisé.");
      const codes = newRecoveryCodes();
      await db.query("UPDATE users SET mfa_recovery = $1 WHERE id = $2", [sealRecoveryCodes(u.id, codes), u.id]);
      await audit.write(actor(req), "auth.mfa.recovery_regenerated", "user", u.id);
      return { recoveryCodes: codes };
    }),
  );

  r.post(
    "/auth/mfa/disable",
    json(async (req) => {
      const su = requireUser(req);
      const body = parse(z.object({ password: z.string().max(300), code }), req.body);
      const u = (await getUser(su.id)) as UserRow;
      if (mfaRequired(u, config.mfaPolicy)) throw new HttpError(403, "L'authentification multifacteur est obligatoire pour ce compte.");
      await stepUp(req, u, body.password);
      if (!(await verifyUserCode(u, body.code))) throw new HttpError(400, "Code incorrect ou déjà utilisé.");
      await db.query("UPDATE users SET mfa_secret = NULL, mfa_pending = NULL, mfa_recovery = '[]', mfa_enabled_at = NULL WHERE id = $1", [u.id]);
      await sessions.destroyForUser(u.id, req.sessionHash ?? undefined);
      await audit.write(actor(req), "auth.mfa.disable", "user", u.id);
      return { user: sessionUser((await getUser(u.id)) as UserRow) };
    }),
  );

  // ─────────── sessions de l'utilisateur ───────────

  r.get("/auth/sessions", json(async (req) => sessions.list(requireSession(req).id, req.sessionHash)));

  r.delete(
    "/auth/sessions/:sid",
    json(async (req) => {
      const u = requireSession(req);
      const sid = parse(z.object({ sid: z.string().regex(/^[0-9a-f]{16}$/) }), req.params).sid;
      if (!(await sessions.revoke(u.id, sid))) throw new HttpError(404, "Session introuvable.");
      await audit.write(actor(req), "auth.session_revoke", "user", u.id, { session: sid });
      return { ok: true };
    }),
  );

  r.post(
    "/auth/sessions/revoke-others",
    json(async (req) => {
      const u = requireSession(req);
      await sessions.destroyForUser(u.id, req.sessionHash ?? undefined);
      await audit.write(actor(req), "auth.session_revoke", "user", u.id, { others: true });
      return { ok: true };
    }),
  );

  // ─────────── OpenID Connect ───────────

  /** Compte correspondant à l'identité fournie : déjà lié, pré-créé par l'administrateur, ou créé à la volée. */
  const oidcAccount = async (id: OidcIdentity, ip: string): Promise<UserRow> => {
    const linked = await one<UserRow>(db, "SELECT * FROM users WHERE oidc_issuer = $1 AND oidc_sub = $2", [id.issuer, id.sub]);
    if (linked) {
      await db.query("UPDATE users SET display_name = $1, email = $2, updated_at = $3 WHERE id = $4", [id.displayName, id.email || linked.email, now(), linked.id]);
      return { ...linked, display_name: id.displayName, email: id.email || linked.email };
    }
    // Rattachement d'un compte « OIDC » créé par l'administrateur (jamais d'un compte à mot de passe local).
    const preProvisioned = await one<UserRow>(
      db,
      `UPDATE users SET oidc_issuer = $1, oidc_sub = $2, display_name = $3, email = COALESCE(NULLIF($4, ''), email), updated_at = $5
       WHERE id = (SELECT id FROM users WHERE auth_source = 'oidc' AND oidc_sub IS NULL AND lower(username) = lower($6) LIMIT 1) RETURNING *`,
      [id.issuer, id.sub, id.displayName, id.email, now(), id.username],
    );
    if (preProvisioned) {
      await audit.write({ userId: preProvisioned.id, username: preProvisioned.username, ip }, "user.oidc_link", "user", preProvisioned.id, { issuer: id.issuer });
      return preProvisioned;
    }
    if (!oidc?.settings.autoCreate) throw new HttpError(403, "Aucun compte Beffroi RM n'est associé à cette identité : contactez l'administrateur.");
    const created = await tx(db, async (c) => {
      let username = id.username;
      for (let i = 2; await one(c, "SELECT 1 FROM users WHERE lower(username) = lower($1)", [username]); i++) username = `${id.username}-${i}`;
      const t = now();
      return one<UserRow>(
        c,
        `INSERT INTO users (id, username, display_name, email, role, can_create, password_hash, must_change, auth_source, oidc_issuer, oidc_sub, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'user',TRUE,'!',FALSE,'oidc',$5,$6,$7,$7) RETURNING *`,
        [randomUUID(), username, id.displayName, id.email, id.issuer, id.sub, t],
      );
    });
    await audit.write({ userId: created!.id, username: created!.username, ip }, "user.create", "user", created!.id, { username: created!.username, role: "user", source: "oidc" });
    return created as UserRow;
  };

  r.get("/auth/oidc/login", async (_req, res) => {
    if (!oidc) throw new HttpError(404, "Authentification unique non configurée.");
    res.redirect(302, await oidc.start());
  });

  r.get("/auth/oidc/callback", async (req, res) => {
    if (!oidc) throw new HttpError(404, "Authentification unique non configurée.");
    const ip = req.ip ?? "";
    try {
      const identity = await oidc.finish(new URLSearchParams(req.originalUrl.split("?")[1] ?? ""));
      const user = await oidcAccount(identity, ip);
      if (user.disabled) throw new HttpError(403, "Ce compte est désactivé.");
      if (user.role !== "user") throw new HttpError(403, "Le compte administrateur se connecte uniquement par mot de passe local.");
      // Le second facteur relève du fournisseur d'identité (niveau exigé par OIDC_ACR_VALUES).
      await openSession(req, res, user, "oidc", !!config.oidc?.acrValues);
      res.redirect(302, "/");
    } catch (e) {
      const message = e instanceof HttpError ? e.message : "Échec de l'authentification unique.";
      if (!(e instanceof HttpError)) ctx.log.error("OIDC", e);
      await audit.write({ userId: null, username: "", ip }, "auth.login.failure", "oidc", "", { method: "oidc", reason: message.slice(0, 200) });
      res.redirect(302, `/connexion?erreur=${encodeURIComponent(message)}`);
    }
  });

  r.post(
    "/auth/logout",
    json(async (req, res) => {
      if (req.sessionHash) {
        await sessions.destroy(req.sessionHash);
        await audit.write(actor(req), "auth.logout", "user", req.user?.id ?? "");
      }
      res.clearCookie(sessionCookieName(config), { path: "/" });
      res.clearCookie(mfaCookieName(config), { path: "/" });
      return { ok: true };
    }),
  );

  r.get(
    "/auth/me",
    json(async (req) => ({
      user: req.user ?? null,
      // Version et paramètres de session communiqués uniquement aux utilisateurs connectés.
      ...(req.user ? { version: APP_VERSION, sessionIdleMinutes: req.user.role === "admin" ? config.adminSessionIdleMinutes : config.sessionIdleMinutes, mfaPolicy: config.mfaPolicy } : {}),
      auth: { localLogin: config.localLogin, oidc: oidc ? { label: oidc.settings.label } : null },
    })),
  );

  r.post(
    "/auth/password",
    json(async (req) => {
      if (!req.user) throw new HttpError(401, "Non authentifié.");
      const body = parse(z.object({ current: z.string().max(300), next: z.string().max(300) }), req.body);
      const u = (await getUser(req.user.id)) as UserRow;
      if (u.auth_source === "oidc") throw new HttpError(400, "Ce compte s'authentifie auprès du fournisseur d'identité de l'organisation.");
      if (!(await passwords.verify(body.current, u.password_hash)).ok) {
        await recordFailure(u, req.ip ?? "", "auth.password_change.failure", "bad_password");
        throw new HttpError(400, "Mot de passe actuel incorrect.");
      }
      const err = passwordPolicyError(body.next, [u.username, u.display_name, u.email]);
      if (err) throw new HttpError(400, err);
      if (body.next === body.current) throw new HttpError(400, "Le nouveau mot de passe doit être différent de l'actuel.");
      for (const old of u.password_history ?? []) {
        if ((await passwords.verify(body.next, old)).ok) throw new HttpError(400, `Ce mot de passe a déjà été utilisé : choisissez-en un différent des ${PASSWORD_HISTORY} précédents.`);
      }
      const history = [u.password_hash, ...(u.password_history ?? [])].filter((h) => h !== "!").slice(0, PASSWORD_HISTORY);
      await db.query("UPDATE users SET password_hash = $1, password_history = $2, must_change = FALSE, updated_at = $3 WHERE id = $4", [
        await passwords.hash(body.next),
        JSON.stringify(history),
        now(),
        u.id,
      ]);
      await sessions.destroyForUser(u.id, req.sessionHash ?? undefined);
      await audit.write(actor(req), "auth.password_change", "user", u.id);
      return { user: sessionUser({ ...u, must_change: false }) };
    }),
  );

  r.patch(
    "/auth/profile",
    json(async (req) => {
      const u = requireUser(req);
      const body = parse(z.object({ displayName: z.string().trim().min(1).max(200), email: z.string().trim().max(200), function: z.string().trim().max(200) }), req.body);
      await db.query("UPDATE users SET display_name = $1, email = $2, function = $3, updated_at = $4 WHERE id = $5", [body.displayName, body.email, body.function, now(), u.id]);
      await audit.write(actor(req), "user.profile_update", "user", u.id);
      return { user: { ...u, displayName: body.displayName, email: body.email, function: body.function } };
    }),
  );

  // Annuaire pour le partage des études.
  r.get(
    "/directory",
    json(async (req) => {
      requireAnalyst(req);
      const users = await all(db, `SELECT id, username, display_name AS "displayName", function FROM users WHERE role = 'user' AND NOT disabled ORDER BY display_name`);
      const groups = await all(db, "SELECT id, name, description FROM groups ORDER BY name");
      return { users, groups };
    }),
  );

  return r;
}
