import type { Request, Response } from "express";
import type { AuditActor } from "./audit.js";
import type { Config } from "./config.js";
import { randomToken, sha256 } from "./crypto.js";
import { all, one, type DB } from "./db.js";

export const CSRF_HEADER = "x-beffroi-csrf";

/**
 * Nom du cookie de session : préfixe « __Host- » en HTTPS (cookie lié à l'hôte exact, sans domaine
 * ni sous-chemin, impossible à poser depuis un sous-domaine ou en HTTP).
 */
export const sessionCookieName = (config: Pick<Config, "cookieSecure">) => (config.cookieSecure ? "__Host-beffroi_sid" : "beffroi_sid");
/** Cookie de l'étape « second facteur » de la connexion (5 minutes). */
export const mfaCookieName = (config: Pick<Config, "cookieSecure">) => (config.cookieSecure ? "__Host-beffroi_mfa" : "beffroi_mfa");

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  email: string;
  function: string;
  role: "admin" | "user";
  can_create: boolean;
  password_hash: string;
  must_change: boolean;
  failed_attempts: number;
  locked_until: number;
  disabled: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  previous_login: string | null;
  auth_source: "local" | "oidc";
  oidc_issuer: string | null;
  oidc_sub: string | null;
  password_history: string[];
  mfa_secret: Buffer | null;
  mfa_pending: Buffer | null;
  mfa_last_step: number;
  mfa_recovery: { k: string; m: string }[];
  mfa_enabled_at: string | null;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  function: string;
  role: "admin" | "user";
  canCreate: boolean;
  mustChange: boolean;
  /** Origine de l'authentification : mot de passe local ou fournisseur OpenID Connect. */
  authSource: "local" | "oidc";
  mfaEnabled: boolean;
  /** Authentification multifacteur exigée par la politique mais pas encore activée. */
  mustEnrollMfa: boolean;
  /** Connexion précédente (information de l'utilisateur, détection d'un usage frauduleux). */
  previousLogin: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: SessionUser | null;
      sessionHash: string | null;
    }
  }
}

/** La politique impose-t-elle un second facteur à ce compte ? (comptes locaux uniquement) */
export function mfaRequired(u: Pick<UserRow, "role" | "auth_source">, policy: Config["mfaPolicy"]): boolean {
  if (u.auth_source !== "local") return false;
  return policy === "required" || (policy === "admin" && u.role === "admin");
}

export function toSessionUser(u: UserRow, policy: Config["mfaPolicy"]): SessionUser {
  const mfaEnabled = !!u.mfa_secret;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    email: u.email,
    function: u.function,
    role: u.role,
    canCreate: u.role === "user" && u.can_create,
    mustChange: u.must_change,
    authSource: u.auth_source,
    mfaEnabled,
    mustEnrollMfa: !mfaEnabled && mfaRequired(u, policy),
    previousLogin: u.previous_login,
  };
}

export interface SessionInfo {
  id: string;
  createdAt: number;
  lastSeen: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
  mfa: boolean;
  current: boolean;
}

export class Sessions {
  constructor(
    private readonly db: DB,
    private readonly config: Config,
  ) {}

  private idleMs(role: UserRow["role"]) {
    return (role === "admin" ? this.config.adminSessionIdleMinutes : this.config.sessionIdleMinutes) * 60_000;
  }

  /** Jeton aléatoire de 256 bits ; seule son empreinte est conservée en base. */
  async create(userId: string, ip: string, userAgent: string, mfa: boolean): Promise<string> {
    const token = randomToken(32);
    const t = Date.now();
    await this.db.query(
      "INSERT INTO sessions (token_hash, user_id, created_at, last_seen, expires_at, ip, user_agent, mfa) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [sha256(token), userId, t, t, t + this.config.sessionMaxHours * 3600_000, ip, userAgent.slice(0, 300), mfa],
    );
    return token;
  }

  /** Renvoie l'utilisateur de la session si elle est valide (inactivité et durée maximale). */
  async resolve(token: string | undefined): Promise<{ user: UserRow; hash: string; expired: boolean; mfa: boolean } | null> {
    if (!token || token.length > 100) return null;
    const hash = sha256(token);
    const row = await one<{ user_id: string; last_seen: number; expires_at: number; mfa: boolean }>(this.db, "SELECT user_id, last_seen, expires_at, mfa FROM sessions WHERE token_hash = $1", [hash]);
    if (!row) return null;
    const t = Date.now();
    const user = await one<UserRow>(this.db, "SELECT * FROM users WHERE id = $1", [row.user_id]);
    if (!user || user.disabled || t > row.expires_at || t - row.last_seen > this.idleMs(user.role)) {
      await this.destroy(hash);
      return user ? { user, hash, expired: true, mfa: row.mfa } : null;
    }
    if (t - row.last_seen > 15_000) await this.db.query("UPDATE sessions SET last_seen = $1 WHERE token_hash = $2", [t, hash]);
    return { user, hash, expired: false, mfa: row.mfa };
  }

  async destroy(hash: string): Promise<void> {
    await this.db.query("DELETE FROM sessions WHERE token_hash = $1", [hash]);
  }

  async destroyForUser(userId: string, exceptHash?: string): Promise<void> {
    if (exceptHash) await this.db.query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [userId, exceptHash]);
    else await this.db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  }

  /** Sessions actives d'un utilisateur ; l'identifiant exposé est un préfixe de l'empreinte du jeton. */
  async list(userId: string, currentHash: string | null): Promise<SessionInfo[]> {
    const rows = await all<{ token_hash: string; created_at: number; last_seen: number; expires_at: number; ip: string; user_agent: string; mfa: boolean }>(
      this.db,
      "SELECT token_hash, created_at, last_seen, expires_at, ip, user_agent, mfa FROM sessions WHERE user_id = $1 ORDER BY last_seen DESC",
      [userId],
    );
    return rows.map((r) => ({
      id: r.token_hash.slice(0, 16),
      createdAt: r.created_at,
      lastSeen: r.last_seen,
      expiresAt: r.expires_at,
      ip: r.ip,
      userAgent: r.user_agent,
      mfa: r.mfa,
      current: r.token_hash === currentHash,
    }));
  }

  async revoke(userId: string, id: string): Promise<boolean> {
    const r = await this.db.query("DELETE FROM sessions WHERE user_id = $1 AND left(token_hash, 16) = $2", [userId, id]);
    return (r.rowCount ?? 0) > 0;
  }

  async purgeExpired(): Promise<void> {
    const t = Date.now();
    await this.db.query("DELETE FROM sessions WHERE expires_at < $1 OR last_seen < $2", [t, t - this.config.sessionIdleMinutes * 60_000]);
    await this.db.query("DELETE FROM mfa_challenges WHERE created_at < $1", [t - 5 * 60_000]);
    await this.db.query("DELETE FROM oidc_requests WHERE created_at < $1", [t - 10 * 60_000]);
  }
}

export function actor(req: Request): AuditActor {
  return { userId: req.user?.id ?? null, username: req.user?.username ?? "", ip: req.ip ?? "" };
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Session ouverte, mot de passe provisoire remplacé (étape d'enrôlement MFA admise). */
export function requireSession(req: Request): SessionUser {
  if (!req.user) throw new HttpError(401, "Authentification requise.");
  if (req.user.mustChange) throw new HttpError(403, "Vous devez changer votre mot de passe.", { mustChange: true });
  return req.user;
}

export function requireUser(req: Request): SessionUser {
  const u = requireSession(req);
  if (u.mustEnrollMfa) throw new HttpError(403, "Vous devez activer l'authentification multifacteur.", { mustEnrollMfa: true });
  return u;
}

export function requireAdmin(req: Request): SessionUser {
  const u = requireUser(req);
  if (u.role !== "admin") throw new HttpError(403, "Réservé à l'administrateur.");
  return u;
}

export function requireAnalyst(req: Request): SessionUser {
  const u = requireUser(req);
  if (u.role !== "user") throw new HttpError(403, "Le compte administrateur n'a pas accès aux analyses de risques.");
  return u;
}

export function setSessionCookie(res: Response, token: string, config: Config): void {
  res.cookie(sessionCookieName(config), token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
    maxAge: config.sessionMaxHours * 3600_000,
  });
}
