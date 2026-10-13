import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { PROTECTION_MARKS } from "@beffroi/shared";
import type { AuditLog } from "./audit.js";
import { HttpError, type Sessions } from "./auth.js";
import type { Config } from "./config.js";
import type { Passwords } from "./crypto.js";
import type { DB } from "./db.js";
import type { Keyring, Sealer } from "./keys.js";
import type { OidcClient } from "./oidc.js";
import type { StudyStore } from "./studies.js";

export const APP_VERSION = "1.1.0";

export interface AppContext {
  db: DB;
  audit: AuditLog;
  sessions: Sessions;
  store: StudyStore;
  config: Config;
  log: Logger;
  oidc: OidcClient | null;
  keys: Keyring;
  sealer: Sealer;
  passwords: Passwords;
}

export interface Logger {
  error(msg: string, err?: unknown): void;
  warn(msg: string): void;
  info(msg: string): void;
}

export function createLogger(level: Config["logLevel"]): Logger {
  const rank = { error: 0, warn: 1, info: 2 }[level];
  const line = (lvl: string, msg: string) => `${new Date().toISOString()} ${lvl} ${msg}`;
  return {
    error: (msg, err) => console.error(line("ERROR", msg), err instanceof Error ? err.stack : (err ?? "")),
    warn: (msg) => rank >= 1 && console.warn(line("WARN", msg)),
    info: (msg) => rank >= 2 && console.log(line("INFO", msg)),
  };
}

/** Valide une entrée (corps, paramètres) ; toute non-conformité donne une erreur 400 explicite. */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new HttpError(400, `Requête invalide : ${i?.path.join(".") || "corps"} — ${i?.message}`);
  }
  return r.data;
}

/** Gestionnaire asynchrone dont la valeur de retour est envoyée en JSON (les erreurs vont au gestionnaire global). */
export function json(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out);
  };
}

export const idParam = (req: Request) => parse(z.object({ id: z.string().min(1).max(100) }), req.params).id;

export const protection = z.enum(PROTECTION_MARKS.map((m) => m.id) as [string, ...string[]]);

/** Modification partielle des métadonnées : seuls les champs fournis sont modifiés (pas de valeur par défaut). */
export const studyMetaPatch = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  reference: z.string().trim().max(100).optional(),
  organisation: z.string().trim().max(300).optional(),
  protection: protection.optional(),
});

export const studyMetaInput = z.object({
  name: z.string().trim().min(1).max(300),
  reference: z.string().trim().max(100).default(""),
  organisation: z.string().trim().max(300).default(""),
  protection,
});
