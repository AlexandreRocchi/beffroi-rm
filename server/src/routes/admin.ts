import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { actor, HttpError, requireAdmin, toSessionUser, type UserRow } from "../auth.js";
import { csvCell, generatePassword } from "../crypto.js";
import { all, now, one, tx, type Queryable } from "../db.js";
import { idParam, json, parse, type AppContext } from "../http.js";

export function adminRoutes(ctx: AppContext): Router {
  const { db, audit, sessions, passwords, config } = ctx;
  const r = Router();
  const getUser = (id: string, q: Queryable = db) => one<UserRow>(q, "SELECT * FROM users WHERE id = $1", [id]);

  const userOut = async (u: UserRow) => ({
    ...toSessionUser(u, config.mfaPolicy),
    mfaEnabledAt: u.mfa_enabled_at,
    disabled: u.disabled,
    locked: u.locked_until > Date.now(),
    lastLogin: u.last_login,
    linked: !!u.oidc_sub,
    createdAt: u.created_at,
    groups: await all(db, "SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = $1 ORDER BY g.name", [u.id]),
  });

  // ─────────── comptes ───────────

  r.get(
    "/admin/users",
    json(async (req) => {
      requireAdmin(req);
      const users = await all<UserRow>(db, "SELECT * FROM users ORDER BY role, display_name");
      return Promise.all(users.map(userOut));
    }),
  );

  r.post(
    "/admin/users",
    json(async (req) => {
      requireAdmin(req);
      const body = parse(
        z.object({
          username: z.string().trim().min(2).max(100).regex(/^[A-Za-z0-9._@-]+$/, "caractères autorisés : lettres, chiffres, . _ @ -"),
          displayName: z.string().trim().min(1).max(200),
          email: z.string().trim().max(200).default(""),
          function: z.string().trim().max(200).default(""),
          role: z.enum(["admin", "user"]).default("user"),
          canCreate: z.boolean().default(true),
          /** « oidc » : compte rattaché à la première connexion par le fournisseur d'identité (pas de mot de passe). */
          authSource: z.enum(["local", "oidc"]).default("local"),
        }),
        req.body,
      );
      if (body.authSource === "oidc" && body.role === "admin") throw new HttpError(400, "Le compte administrateur est toujours un compte local.");
      if (await one(db, "SELECT 1 FROM users WHERE lower(username) = lower($1)", [body.username])) throw new HttpError(409, "Cet identifiant existe déjà.");
      const oidcAccount = body.authSource === "oidc";
      const password = oidcAccount ? undefined : generatePassword();
      const id = randomUUID();
      const t = now();
      await db.query(
        `INSERT INTO users (id, username, display_name, email, function, role, can_create, password_hash, must_change, auth_source, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
        [id, body.username, body.displayName, body.email, body.function, body.role, body.canCreate, password ? await passwords.hash(password) : "!", !oidcAccount, body.authSource, t],
      );
      await audit.write(actor(req), "user.create", "user", id, { username: body.username, role: body.role, source: body.authSource });
      return { user: await userOut((await getUser(id)) as UserRow), temporaryPassword: password };
    }),
  );

  r.patch(
    "/admin/users/:id",
    json(async (req) => {
      const admin = requireAdmin(req);
      const id = idParam(req);
      const body = parse(
        z.object({
          displayName: z.string().trim().min(1).max(200).optional(),
          email: z.string().trim().max(200).optional(),
          function: z.string().trim().max(200).optional(),
          canCreate: z.boolean().optional(),
          disabled: z.boolean().optional(),
          unlock: z.boolean().optional(),
          resetPassword: z.boolean().optional(),
          /** Réinitialise le second facteur (téléphone perdu) : l'utilisateur devra en enrôler un nouveau. */
          resetMfa: z.boolean().optional(),
          groupIds: z.array(z.string().max(100)).max(500).optional(),
        }),
        req.body,
      );
      const u = await getUser(id);
      if (!u) throw new HttpError(404, "Utilisateur introuvable.");
      if (body.disabled && u.id === admin.id) throw new HttpError(400, "Vous ne pouvez pas désactiver votre propre compte.");
      if (body.resetMfa && u.id === admin.id) throw new HttpError(400, "Vous ne pouvez pas réinitialiser votre propre second facteur.");
      if (body.resetPassword && u.auth_source === "oidc") throw new HttpError(400, "Ce compte s'authentifie auprès du fournisseur d'identité : pas de mot de passe local.");
      if (body.groupIds?.length && u.role === "admin") throw new HttpError(400, "Le compte administrateur ne peut pas appartenir à un groupe d'analystes.");
      let temporaryPassword: string | undefined;
      await tx(db, async (c) => {
        await c.query(
          `UPDATE users SET display_name = COALESCE($1, display_name), email = COALESCE($2, email), function = COALESCE($3, function),
             can_create = COALESCE($4, can_create), disabled = COALESCE($5, disabled), updated_at = $6 WHERE id = $7`,
          [body.displayName ?? null, body.email ?? null, body.function ?? null, body.canCreate ?? null, body.disabled ?? null, now(), id],
        );
        if (body.unlock) await c.query("UPDATE users SET failed_attempts = 0, locked_until = 0 WHERE id = $1", [id]);
        if (body.resetPassword) {
          temporaryPassword = generatePassword();
          await c.query("UPDATE users SET password_hash = $1, must_change = TRUE WHERE id = $2", [await passwords.hash(temporaryPassword), id]);
        }
        if (body.resetMfa) {
          await c.query("UPDATE users SET mfa_secret = NULL, mfa_pending = NULL, mfa_recovery = '[]', mfa_last_step = 0, mfa_enabled_at = NULL WHERE id = $1", [id]);
        }
        if (body.groupIds) {
          await c.query("DELETE FROM group_members WHERE user_id = $1", [id]);
          await c.query("INSERT INTO group_members (group_id, user_id) SELECT g.id, $1 FROM groups g WHERE g.id = ANY($2::text[])", [id, body.groupIds]);
        }
      });
      if (body.disabled || body.resetPassword || body.resetMfa) await sessions.destroyForUser(id);
      if (body.resetMfa) await audit.write(actor(req), "user.mfa_reset", "user", id);
      if (body.unlock) await audit.write(actor(req), "user.unlock", "user", id);
      if (body.resetPassword) await audit.write(actor(req), "user.reset_password", "user", id);
      await audit.write(actor(req), "user.update", "user", id, { fields: Object.keys(body) });
      return { user: await userOut((await getUser(id)) as UserRow), temporaryPassword };
    }),
  );

  r.delete(
    "/admin/users/:id",
    json(async (req) => {
      const admin = requireAdmin(req);
      const id = idParam(req);
      if (id === admin.id) throw new HttpError(400, "Vous ne pouvez pas supprimer votre propre compte.");
      const u = await getUser(id);
      if (!u) throw new HttpError(404, "Utilisateur introuvable.");
      const owned = await one<{ n: number }>(db, "SELECT count(*) AS n FROM study_acl WHERE principal_type = 'user' AND principal_id = $1 AND access = 'owner'", [id]);
      if ((owned?.n ?? 0) > 0) throw new HttpError(409, "Cet utilisateur est propriétaire d'études : transférez-les ou désactivez le compte.");
      await tx(db, async (c) => {
        await c.query("DELETE FROM study_acl WHERE principal_type = 'user' AND principal_id = $1", [id]);
        await c.query("DELETE FROM users WHERE id = $1", [id]);
      });
      await audit.write(actor(req), "user.delete", "user", id, { username: u.username });
      return { ok: true };
    }),
  );

  // ─────────── groupes ───────────

  r.get(
    "/admin/groups",
    json(async (req) => {
      requireAdmin(req);
      const groups = await all<{ id: string }>(db, `SELECT id, name, description, created_at AS "createdAt" FROM groups ORDER BY name`);
      return Promise.all(
        groups.map(async (g) => ({
          ...g,
          members: await all(db, `SELECT u.id, u.display_name AS "displayName", u.username FROM users u JOIN group_members m ON m.user_id = u.id WHERE m.group_id = $1 ORDER BY u.display_name`, [g.id]),
        })),
      );
    }),
  );

  r.post(
    "/admin/groups",
    json(async (req) => {
      requireAdmin(req);
      const body = parse(z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().max(1000).default("") }), req.body);
      if (await one(db, "SELECT 1 FROM groups WHERE lower(name) = lower($1)", [body.name])) throw new HttpError(409, "Ce groupe existe déjà.");
      const id = randomUUID();
      await db.query("INSERT INTO groups (id, name, description, created_at) VALUES ($1,$2,$3,$4)", [id, body.name, body.description, now()]);
      await audit.write(actor(req), "group.create", "group", id, { name: body.name });
      return { id };
    }),
  );

  r.patch(
    "/admin/groups/:id",
    json(async (req) => {
      requireAdmin(req);
      const id = idParam(req);
      const body = parse(
        z.object({ name: z.string().trim().min(1).max(200).optional(), description: z.string().trim().max(1000).optional(), memberIds: z.array(z.string().max(100)).max(5000).optional() }),
        req.body,
      );
      if (!(await one(db, "SELECT 1 FROM groups WHERE id = $1", [id]))) throw new HttpError(404, "Groupe introuvable.");
      await tx(db, async (c) => {
        await c.query("UPDATE groups SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3", [body.name ?? null, body.description ?? null, id]);
        if (body.memberIds) {
          await c.query("DELETE FROM group_members WHERE group_id = $1", [id]);
          // Seuls les analystes peuvent être membres (le compte administrateur n'accède pas aux analyses).
          await c.query("INSERT INTO group_members (group_id, user_id) SELECT $1, u.id FROM users u WHERE u.id = ANY($2::text[]) AND u.role = 'user'", [id, body.memberIds]);
        }
      });
      await audit.write(actor(req), "group.update", "group", id, { fields: Object.keys(body) });
      return { ok: true };
    }),
  );

  r.delete(
    "/admin/groups/:id",
    json(async (req) => {
      requireAdmin(req);
      const id = idParam(req);
      await tx(db, async (c) => {
        await c.query("DELETE FROM study_acl WHERE principal_type = 'group' AND principal_id = $1", [id]);
        await c.query("DELETE FROM groups WHERE id = $1", [id]);
      });
      await audit.write(actor(req), "group.delete", "group", id);
      return { ok: true };
    }),
  );

  // ─────────── journal d'audit ───────────

  const auditQuery = z.object({
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    action: z.string().max(100).optional(),
    user: z.string().max(100).optional(),
    target: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(5000).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  });

  r.get(
    "/admin/audit",
    json(async (req) => {
      requireAdmin(req);
      const q = parse(auditQuery, req.query);
      await audit.write(actor(req), "audit.read", "audit", "", q);
      return audit.query(q);
    }),
  );

  r.get("/admin/audit/export", async (req, res) => {
    requireAdmin(req);
    const q = parse(auditQuery, req.query);
    const { rows } = await audit.query({ ...q, limit: 5000 });
    await audit.write(actor(req), "audit.export", "audit", "", { count: rows.length });
    const csv = ["seq;horodatage;utilisateur;ip;action;type_cible;cible;details;hash", ...rows.map((x) => [x.seq, x.ts, x.username, x.ip, x.action, x.target_type, x.target_id, x.details, x.hash].map(csvCell).join(";"))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("﻿" + csv);
  });

  r.get(
    "/admin/audit/verify",
    json(async (req) => {
      requireAdmin(req);
      const v = await audit.verify();
      await audit.write(actor(req), "audit.verify", "audit", "", v);
      return v;
    }),
  );

  r.post(
    "/admin/audit/purge",
    json(async (req) => {
      requireAdmin(req);
      const body = parse(z.object({ before: z.string().min(10).max(40) }), req.body);
      const limit = new Date(Date.now() - 365 * 24 * 3600_000).toISOString();
      if (body.before > limit) throw new HttpError(400, "Seules les entrées de plus d'un an peuvent être purgées.");
      return { deleted: await audit.purge(actor(req), body.before) };
    }),
  );

  return r;
}
