import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { diffStudies, syncRisks, type DiffEntry, type StudyData, type StudyMeta, type VersionInfo } from "@beffroi/shared";
import { HttpError, type SessionUser } from "./auth.js";
import { computeStats, parseStudyData, type StudyStats } from "./study-data.js";
import type { Access } from "./studies.js";

/** Version d'une étude telle qu'enregistrée sur le disque. */
interface LocalVersion {
  id: string;
  major: number;
  minor: number;
  changeType: "initial" | "operational" | "strategic";
  summary: string;
  workshops: number[];
  frozen: boolean;
  rev: number;
  data: StudyData;
  stats: StudyStats;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

/** Fichier d'étude : métadonnées et toutes ses versions (un fichier JSON par étude). */
interface LocalStudy {
  format: 1;
  id: string;
  name: string;
  reference: string;
  organisation: string;
  protection: string;
  createdAt: string;
  updatedAt: string;
  currentVersionId: string;
  versions: LocalVersion[];
}

type MetaInput = { name: string; reference: string; organisation: string; protection: string };

const ID = /^[0-9a-f-]{36}$/;
const now = () => new Date().toISOString();

/**
 * Stockage des études du mode poste seul : un fichier JSON par étude dans le dossier de données de
 * l'utilisateur, écrit de façon atomique (fichier temporaire puis renommage). Un seul utilisateur,
 * propriétaire de toutes ses études : pas de droits d'accès ni de partage.
 */
export class LocalStudyStore {
  private readonly dir: string;

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, "etudes");
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
  }

  private file(id: string): string {
    if (!ID.test(id)) throw new HttpError(404, "Étude introuvable.");
    return path.join(this.dir, `${id}.json`);
  }

  private read(id: string): LocalStudy {
    let text: string;
    try {
      text = fs.readFileSync(this.file(id), "utf8");
    } catch {
      throw new HttpError(404, "Étude introuvable.");
    }
    return JSON.parse(text) as LocalStudy;
  }

  private write(s: LocalStudy): void {
    const file = this.file(s.id);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(s), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  /** Lecture-modification-écriture d'une étude : synchrone, donc jamais entrelacée avec une autre requête. */
  private update<T>(id: string, fn: (s: LocalStudy) => T): T {
    const s = this.read(id);
    const out = fn(s);
    this.write(s);
    return out;
  }

  private current(s: LocalStudy): LocalVersion {
    const v = s.versions.find((x) => x.id === s.currentVersionId);
    if (!v) throw new HttpError(500, "Étude corrompue : version courante absente.");
    return v;
  }

  private toMeta(s: LocalStudy, v: LocalVersion, owner: string): StudyMeta & { stats: StudyStats } {
    return {
      id: s.id,
      name: s.name,
      reference: s.reference,
      organisation: s.organisation,
      protection: s.protection as StudyMeta["protection"],
      major: v.major,
      minor: v.minor,
      versionId: v.id,
      rev: v.rev,
      frozen: v.frozen,
      createdAt: s.createdAt,
      updatedAt: v.updatedAt,
      ownerName: owner,
      access: "owner",
      stats: v.stats,
    };
  }

  async require(_user: SessionUser, id: string, _needed: Access): Promise<Access> {
    if (!fs.existsSync(this.file(id))) throw new HttpError(404, "Étude introuvable.");
    return "owner";
  }

  async list(user: SessionUser) {
    const out: (StudyMeta & { stats: StudyStats })[] = [];
    for (const f of fs.readdirSync(this.dir)) {
      const id = f.endsWith(".json") ? f.slice(0, -5) : "";
      if (!ID.test(id)) continue;
      try {
        const s = this.read(id);
        out.push(this.toMeta(s, this.current(s), user.displayName));
      } catch {
        /* fichier illisible : ignoré dans la liste */
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getMeta(user: SessionUser, id: string) {
    const s = this.read(id);
    return this.toMeta(s, this.current(s), user.displayName);
  }

  async create(user: SessionUser, meta: MetaInput, input: StudyData) {
    const data = parseStudyData(input);
    data.risks = syncRisks(data);
    const t = now();
    const vid = randomUUID();
    const s: LocalStudy = {
      format: 1,
      id: randomUUID(),
      ...meta,
      createdAt: t,
      updatedAt: t,
      currentVersionId: vid,
      versions: [
        {
          id: vid,
          major: 1,
          minor: 0,
          changeType: "initial",
          summary: "Version initiale",
          workshops: [1, 2, 3, 4, 5],
          frozen: false,
          rev: 1,
          data,
          stats: computeStats(data),
          createdAt: t,
          createdBy: user.displayName,
          updatedAt: t,
          updatedBy: user.displayName,
        },
      ],
    };
    this.write(s);
    return this.toMeta(s, s.versions[0], user.displayName);
  }

  async updateMeta(user: SessionUser, id: string, meta: Partial<MetaInput>) {
    return this.update(id, (s) => {
      for (const k of ["name", "reference", "organisation", "protection"] as const) if (meta[k] !== undefined) s[k] = meta[k];
      s.updatedAt = now();
      return this.toMeta(s, this.current(s), user.displayName);
    });
  }

  async delete(_user: SessionUser, id: string): Promise<void> {
    const file = this.file(id);
    if (!fs.existsSync(file)) throw new HttpError(404, "Étude introuvable.");
    fs.rmSync(file);
  }

  async getData(user: SessionUser, id: string, versionId?: string) {
    const s = this.read(id);
    const v = versionId ? s.versions.find((x) => x.id === versionId) : this.current(s);
    if (!v) throw new HttpError(404, "Version introuvable.");
    return { meta: this.toMeta(s, v, user.displayName), data: v.data };
  }

  async save(user: SessionUser, id: string, rev: number, input: unknown, force = false) {
    const data = parseStudyData(input);
    return this.update(id, (s) => {
      const v = this.current(s);
      if (v.frozen) throw new HttpError(409, "Cette version est figée.");
      // Deux onglets ouverts sur la même étude : même contrôle de révision que le serveur d'équipe.
      if (!force && v.rev !== rev) {
        throw new HttpError(409, `L'étude a été modifiée dans un autre onglet depuis votre dernier chargement.`, { rev: v.rev, updatedBy: v.updatedBy, conflict: true });
      }
      const t = now();
      v.data = data;
      v.rev += 1;
      v.stats = computeStats(data);
      v.updatedAt = t;
      v.updatedBy = user.displayName;
      s.updatedAt = t;
      return { rev: v.rev, updatedAt: t };
    });
  }

  async versions(_user: SessionUser, id: string): Promise<VersionInfo[]> {
    const s = this.read(id);
    const sorted = [...s.versions].sort((a, b) => a.major - b.major || a.minor - b.minor);
    let prev: StudyData | null = null;
    return sorted
      .map((v) => {
        const diff: DiffEntry[] | null = prev ? diffStudies(prev, v.data) : null;
        prev = v.data;
        return {
          id: v.id,
          major: v.major,
          minor: v.minor,
          changeType: v.changeType,
          summary: v.summary,
          workshops: v.workshops,
          frozen: v.frozen,
          createdAt: v.createdAt,
          createdBy: v.createdBy,
          diff,
        };
      })
      .reverse();
  }

  /** Nouvelle version : fige la version courante et ouvre x+1.0 (stratégique) ou x.y+1 (opérationnelle). */
  async newVersion(user: SessionUser, id: string, changeType: "operational" | "strategic", summary: string, workshops: number[]) {
    return this.update(id, (s) => {
      const cur = this.current(s);
      const major = changeType === "strategic" ? cur.major + 1 : cur.major;
      const minor = changeType === "strategic" ? 0 : cur.minor + 1;
      const t = now();
      const vid = randomUUID();
      cur.frozen = true;
      s.versions.push({
        id: vid,
        major,
        minor,
        changeType,
        summary,
        workshops,
        frozen: false,
        rev: 1,
        data: structuredClone(cur.data),
        stats: cur.stats,
        createdAt: t,
        createdBy: user.displayName,
        updatedAt: t,
        updatedBy: user.displayName,
      });
      s.currentVersionId = vid;
      s.updatedAt = t;
      return { id: vid, major, minor };
    });
  }

  async acl(user: SessionUser, id: string) {
    await this.require(user, id, "read");
    return [{ principalType: "user", principalId: user.id, access: "owner", name: user.displayName, username: user.username }];
  }

  async setAcl(): Promise<never> {
    throw new HttpError(400, "Le partage n'est pas disponible en mode poste seul : exportez l'étude (JSON) pour la transmettre.");
  }
}
