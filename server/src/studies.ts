import { randomUUID } from "node:crypto";
import {
  diffStudies,
  syncRisks,
  type DiffEntry,
  type StudyData,
  type StudyMeta,
  type VersionInfo,
} from "@beffroi/shared";
import { HttpError, type SessionUser } from "./auth.js";
import type { Sealer } from "./keys.js";
import { all, now, one, tx, type DB, type Queryable } from "./db.js";
import { computeStats, parseStudyData, type StudyStats } from "./study-data.js";

export { computeStats, parseStudyData, type StudyStats };

export type Access = "read" | "write" | "owner";
const RANK: Record<Access, number> = { read: 1, write: 2, owner: 3 };

interface StudyRow {
  id: string;
  name: string;
  reference: string;
  organisation: string;
  protection: string;
  owner_id: string;
  current_version_id: string;
  created_at: string;
  updated_at: string;
  meta_enc: Buffer | null;
}

/** Métadonnées confidentielles d'une étude, chiffrées en base (le nom d'une analyse est une information sensible). */
export interface StudyNames {
  name: string;
  reference: string;
  organisation: string;
}

interface VersionRow {
  id: string;
  study_id: string;
  major: number;
  minor: number;
  change_type: "initial" | "operational" | "strategic";
  summary: string;
  summary_enc: Buffer | null;
  workshops: number[];
  frozen: boolean;
  rev: number;
  data: Buffer;
  stats: StudyStats;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

/** Meilleur droit de l'utilisateur $1 sur l'étude s, directement ou par ses groupes. */
const ACCESS_SQL = `
  SELECT a.access FROM study_acl a
  WHERE a.study_id = s.id AND (
    (a.principal_type = 'user' AND a.principal_id = $1)
    OR (a.principal_type = 'group' AND a.principal_id IN (SELECT group_id FROM group_members WHERE user_id = $1))
  )
  ORDER BY CASE a.access WHEN 'owner' THEN 3 WHEN 'write' THEN 2 ELSE 1 END DESC
  LIMIT 1`;

type MetaRow = StudyRow & {
  v_id: string;
  major: number;
  minor: number;
  rev: number;
  frozen: boolean;
  v_updated_at: string;
  stats: StudyStats;
  owner_name: string | null;
  access: Access;
};

/** Métadonnées d'étude pour l'utilisateur $1 et la version $2 (courante si NULL). */
const META_SQL = `
  SELECT s.*, v.id AS v_id, v.major, v.minor, v.rev, v.frozen, v.updated_at AS v_updated_at, v.stats,
         u.display_name AS owner_name, acc.access
  FROM studies s
  JOIN study_versions v ON v.id = COALESCE($2::text, s.current_version_id) AND v.study_id = s.id
  LEFT JOIN users u ON u.id = s.owner_id
  JOIN LATERAL (${ACCESS_SQL}) acc ON TRUE`;

function toMeta(r: MetaRow, names: StudyNames): StudyMeta & { stats: StudyStats } {
  return {
    id: r.id,
    ...names,
    protection: r.protection as StudyMeta["protection"],
    major: r.major,
    minor: r.minor,
    versionId: r.v_id,
    rev: r.rev,
    frozen: r.frozen,
    createdAt: r.created_at,
    updatedAt: r.v_updated_at,
    ownerName: r.owner_name ?? "—",
    access: r.access,
    stats: r.stats ?? {},
  };
}

export class StudyStore {
  constructor(
    private readonly db: DB,
    private readonly sealer: Sealer,
  ) {}

  /** Nom, référence et organisation : chiffrés et liés à l'étude (colonnes en clair vidées). */
  sealNames(id: string, n: StudyNames): Buffer {
    return this.sealer.seal("study-meta", JSON.stringify(n), `study:${id}`);
  }

  openNames(r: Pick<StudyRow, "id" | "name" | "reference" | "organisation" | "meta_enc">): StudyNames {
    if (!r.meta_enc) return { name: r.name, reference: r.reference, organisation: r.organisation };
    return JSON.parse(this.sealer.open("study-meta", r.meta_enc, `study:${r.id}`)) as StudyNames;
  }

  sealSummary(versionId: string, summary: string): Buffer {
    return this.sealer.seal("study-meta", summary, `version-summary:${versionId}`);
  }

  openSummary(v: Pick<VersionRow, "id" | "summary" | "summary_enc">): string {
    return v.summary_enc ? this.sealer.open("study-meta", v.summary_enc, `version-summary:${v.id}`) : v.summary;
  }

  async accessOf(user: SessionUser, studyId: string, q: Queryable = this.db): Promise<Access | null> {
    if (user.role !== "user") return null;
    const r = await one<{ access: Access }>(q, `SELECT (${ACCESS_SQL}) AS access FROM studies s WHERE s.id = $2`, [user.id, studyId]);
    return r?.access ?? null;
  }

  async require(user: SessionUser, studyId: string, needed: Access, q: Queryable = this.db): Promise<Access> {
    const access = await this.accessOf(user, studyId, q);
    // Même réponse pour une étude inexistante ou inaccessible (besoin d'en connaître).
    if (!access) throw new HttpError(404, "Étude introuvable.");
    if (RANK[access] < RANK[needed]) throw new HttpError(403, needed === "owner" ? "Réservé au propriétaire de l'étude." : "Accès en lecture seule.");
    return access;
  }

  private async metaOf(user: SessionUser, id: string, versionId: string | null = null, q: Queryable = this.db) {
    const r = await one<MetaRow>(q, `${META_SQL} WHERE s.id = $3`, [user.id, versionId, id]);
    if (!r) throw new HttpError(404, versionId ? "Version introuvable." : "Étude introuvable.");
    return toMeta(r, this.openNames(r));
  }

  private encrypt(versionId: string, data: StudyData): Buffer {
    return this.sealer.seal("study-data", JSON.stringify(data), `study-version:${versionId}`);
  }

  private decrypt(v: Pick<VersionRow, "id" | "data">): StudyData {
    return JSON.parse(this.sealer.open("study-data", v.data, `study-version:${v.id}`)) as StudyData;
  }

  async list(user: SessionUser) {
    if (user.role !== "user") return [];
    const rows = await all<MetaRow>(this.db, `${META_SQL} ORDER BY s.updated_at DESC`, [user.id, null]);
    return rows.map((r) => toMeta(r, this.openNames(r)));
  }

  async getMeta(user: SessionUser, id: string) {
    await this.require(user, id, "read");
    return this.metaOf(user, id);
  }

  async create(user: SessionUser, meta: { name: string; reference: string; organisation: string; protection: string }, input: StudyData) {
    if (!user.canCreate) throw new HttpError(403, "Vous n'êtes pas habilité à créer des études.");
    const data = parseStudyData(input);
    data.risks = syncRisks(data);
    const id = randomUUID();
    const vid = randomUUID();
    const t = now();
    await tx(this.db, async (c) => {
      await c.query(
        "INSERT INTO studies (id, name, reference, organisation, protection, owner_id, current_version_id, created_at, updated_at, meta_enc) VALUES ($1,'','','',$2,$3,$4,$5,$5,$6)",
        [id, meta.protection, user.id, vid, t, this.sealNames(id, { name: meta.name, reference: meta.reference, organisation: meta.organisation })],
      );
      await c.query(
        `INSERT INTO study_versions (id, study_id, major, minor, change_type, summary, summary_enc, workshops, frozen, rev, data, stats, created_at, created_by, updated_at, updated_by)
         VALUES ($1,$2,1,0,'initial','',$7,'[1,2,3,4,5]',FALSE,1,$3,$4,$5,$6,$5,$6)`,
        [vid, id, this.encrypt(vid, data), JSON.stringify(computeStats(data)), t, user.displayName, this.sealSummary(vid, "Version initiale")],
      );
      await c.query("INSERT INTO study_acl (study_id, principal_type, principal_id, access) VALUES ($1, 'user', $2, 'owner')", [id, user.id]);
    });
    return this.metaOf(user, id);
  }

  async updateMeta(user: SessionUser, id: string, meta: { name?: string; reference?: string; organisation?: string; protection?: string }) {
    await this.require(user, id, "write");
    await tx(this.db, async (c) => {
      const row = await one<StudyRow>(c, "SELECT * FROM studies WHERE id = $1 FOR UPDATE", [id]);
      if (!row) throw new HttpError(404, "Étude introuvable.");
      const cur = this.openNames(row);
      const next = { name: meta.name ?? cur.name, reference: meta.reference ?? cur.reference, organisation: meta.organisation ?? cur.organisation };
      await c.query("UPDATE studies SET name = '', reference = '', organisation = '', meta_enc = $1, protection = COALESCE($2, protection), updated_at = $3 WHERE id = $4", [
        this.sealNames(id, next),
        meta.protection ?? null,
        now(),
        id,
      ]);
    });
    return this.metaOf(user, id);
  }

  /** Suppression définitive : l'étude, toutes ses versions (documents chiffrés) et ses droits. */
  async delete(user: SessionUser, id: string): Promise<void> {
    await this.require(user, id, "owner");
    await this.db.query("DELETE FROM studies WHERE id = $1", [id]);
  }

  async getData(user: SessionUser, id: string, versionId?: string) {
    await this.require(user, id, "read");
    const meta = await this.metaOf(user, id, versionId ?? null);
    const v = await one<Pick<VersionRow, "id" | "data">>(this.db, "SELECT id, data FROM study_versions WHERE id = $1 AND study_id = $2", [meta.versionId, id]);
    if (!v) throw new HttpError(404, "Version introuvable.");
    return { meta, data: this.decrypt(v) };
  }

  async save(user: SessionUser, id: string, rev: number, input: unknown, force = false) {
    await this.require(user, id, "write");
    const data = parseStudyData(input);
    return tx(this.db, async (c) => {
      // Verrou de la version courante : deux enregistrements simultanés ne peuvent pas passer le contrôle de révision.
      const v = await one<Pick<VersionRow, "id" | "rev" | "frozen" | "updated_by">>(
        c,
        "SELECT v.id, v.rev, v.frozen, v.updated_by FROM study_versions v JOIN studies s ON s.current_version_id = v.id WHERE s.id = $1 FOR UPDATE OF v",
        [id],
      );
      if (!v) throw new HttpError(404, "Étude introuvable.");
      if (v.frozen) throw new HttpError(409, "Cette version est figée.");
      if (!force && v.rev !== rev) {
        throw new HttpError(409, `L'étude a été modifiée par ${v.updated_by} depuis votre dernier chargement.`, { rev: v.rev, updatedBy: v.updated_by, conflict: true });
      }
      const t = now();
      const newRev = v.rev + 1;
      await c.query("UPDATE study_versions SET data = $1, rev = $2, stats = $3, updated_at = $4, updated_by = $5 WHERE id = $6", [
        this.encrypt(v.id, data),
        newRev,
        JSON.stringify(computeStats(data)),
        t,
        user.displayName,
        v.id,
      ]);
      await c.query("UPDATE studies SET updated_at = $1 WHERE id = $2", [t, id]);
      return { rev: newRev, updatedAt: t };
    });
  }

  async versions(user: SessionUser, id: string): Promise<VersionInfo[]> {
    await this.require(user, id, "read");
    const rows = await all<VersionRow>(this.db, "SELECT * FROM study_versions WHERE study_id = $1 ORDER BY major, minor", [id]);
    let prev: StudyData | null = null;
    return rows
      .map((v) => {
        const data = this.decrypt(v);
        const diff: DiffEntry[] | null = prev ? diffStudies(prev, data) : null;
        prev = data;
        return {
          id: v.id,
          major: v.major,
          minor: v.minor,
          changeType: v.change_type,
          summary: this.openSummary(v),
          workshops: v.workshops,
          frozen: v.frozen,
          createdAt: v.created_at,
          createdBy: v.created_by,
          diff,
        };
      })
      .reverse();
  }

  /** Nouvelle version : fige la version courante et ouvre x+1.0 (stratégique) ou x.y+1 (opérationnelle). */
  async newVersion(user: SessionUser, id: string, changeType: "operational" | "strategic", summary: string, workshops: number[]) {
    await this.require(user, id, "write");
    return tx(this.db, async (c) => {
      const cur = await one<VersionRow>(
        c,
        "SELECT v.* FROM study_versions v JOIN studies s ON s.current_version_id = v.id WHERE s.id = $1 FOR UPDATE OF v",
        [id],
      );
      if (!cur) throw new HttpError(404, "Étude introuvable.");
      const data = this.decrypt(cur);
      const major = changeType === "strategic" ? cur.major + 1 : cur.major;
      const minor = changeType === "strategic" ? 0 : cur.minor + 1;
      const vid = randomUUID();
      const t = now();
      await c.query("UPDATE study_versions SET frozen = TRUE WHERE id = $1", [cur.id]);
      await c.query(
        `INSERT INTO study_versions (id, study_id, major, minor, change_type, summary, summary_enc, workshops, frozen, rev, data, stats, created_at, created_by, updated_at, updated_by)
         VALUES ($1,$2,$3,$4,$5,'',$6,$7,FALSE,1,$8,$9,$10,$11,$10,$11)`,
        [vid, id, major, minor, changeType, this.sealSummary(vid, summary), JSON.stringify(workshops), this.encrypt(vid, data), JSON.stringify(cur.stats), t, user.displayName],
      );
      await c.query("UPDATE studies SET current_version_id = $1, updated_at = $2 WHERE id = $3", [vid, t, id]);
      return { id: vid, major, minor };
    });
  }

  async acl(user: SessionUser, id: string) {
    await this.require(user, id, "read");
    return this.aclRaw(id);
  }

  private aclRaw(id: string, q: Queryable = this.db) {
    return all(
      q,
      `SELECT a.principal_type AS "principalType", a.principal_id AS "principalId", a.access,
         COALESCE(u.display_name, g.name, '?') AS name, COALESCE(u.username, '') AS username
       FROM study_acl a
       LEFT JOIN users u ON a.principal_type = 'user' AND u.id = a.principal_id
       LEFT JOIN groups g ON a.principal_type = 'group' AND g.id = a.principal_id
       WHERE a.study_id = $1
       ORDER BY CASE a.access WHEN 'owner' THEN 3 WHEN 'write' THEN 2 ELSE 1 END DESC, name`,
      [id],
    );
  }

  async setAcl(user: SessionUser, id: string, entries: { principalType: "user" | "group"; principalId: string; access: Access }[]) {
    await this.require(user, id, "owner");
    if (!entries.some((e) => e.access === "owner" && e.principalType === "user")) throw new HttpError(400, "L'étude doit conserver au moins un propriétaire nominatif.");
    for (const e of entries) {
      const row =
        e.principalType === "user"
          ? await one<{ role: string }>(this.db, "SELECT role FROM users WHERE id = $1", [e.principalId])
          : await one<{ role: string }>(this.db, "SELECT 'group' AS role FROM groups WHERE id = $1", [e.principalId]);
      if (!row) throw new HttpError(400, "Utilisateur ou groupe inconnu.");
      if (row.role === "admin") throw new HttpError(400, "Le compte administrateur ne peut pas recevoir d'accès aux analyses.");
      if (e.principalType === "group" && e.access === "owner") throw new HttpError(400, "Un groupe ne peut pas être propriétaire.");
    }
    return tx(this.db, async (c) => {
      await c.query("DELETE FROM study_acl WHERE study_id = $1", [id]);
      for (const e of entries) {
        await c.query("INSERT INTO study_acl (study_id, principal_type, principal_id, access) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [id, e.principalType, e.principalId, e.access]);
      }
      const owner = entries.find((e) => e.access === "owner" && e.principalType === "user");
      if (owner) await c.query("UPDATE studies SET owner_id = $1 WHERE id = $2", [owner.principalId, id]);
      return this.aclRaw(id, c);
    });
  }
}
