import { safeEqual, sha256 } from "./crypto.js";
import { all, now, one, tx, type DB } from "./db.js";
import type { Keyring } from "./keys.js";

export interface AuditEntry {
  seq: number;
  ts: string;
  user_id: string | null;
  username: string;
  ip: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string;
  prev_hash: string;
  hash: string;
  /** « hmac-sha256 » (clé secrète) ; « sha256 » pour les entrées antérieures à la version 1.1. */
  alg: string;
  key_id: string;
}

export interface AuditActor {
  userId: string | null;
  username: string;
  ip: string;
}

const GENESIS = "0".repeat(64);
/** Verrou consultatif sérialisant l'écriture du journal (chaîne cohérente entre instances). */
const AUDIT_LOCK = 4242002;
const HMAC = "hmac-sha256";
const LEGACY = "sha256";
/** Action d'ancrage : une entrée HMAC atteste le nombre et la dernière empreinte des entrées antérieures. */
const UPGRADE = "audit.upgrade";

type Fields = Omit<AuditEntry, "seq" | "hash">;

const serialize = (e: Fields) => [e.prev_hash, e.ts, e.user_id ?? "", e.username, e.ip, e.action, e.target_type, e.target_id, e.details].join("␟");

/**
 * Journal d'audit chaîné et scellé : chaque entrée contient l'empreinte de la précédente et est
 * authentifiée par un HMAC-SHA256 dont la clé, dérivée de la clé maître, n'est pas en base.
 * Un accès en écriture à la base ne suffit donc pas à réécrire le journal de façon indétectable
 * (EXI_S3_05). En base, des déclencheurs interdisent modification et suppression hors purge contrôlée.
 */
export class AuditLog {
  constructor(
    private readonly db: DB,
    private readonly keys: Keyring,
    private readonly opts: { stdout?: boolean } = {},
  ) {}

  private seal(e: Fields): string {
    if (e.alg === LEGACY) return sha256(serialize(e));
    return this.keys.mac("audit-mac", `${e.key_id}␟${serialize(e)}`, e.key_id);
  }

  async write(actor: AuditActor, action: string, targetType = "", targetId = "", details: Record<string, unknown> | string = ""): Promise<void> {
    const e = await tx(this.db, async (c) => {
      await c.query("SELECT pg_advisory_xact_lock($1)", [AUDIT_LOCK]);
      const last = await one<{ hash: string }>(c, "SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1");
      const f: Fields = {
        ts: now(),
        user_id: actor.userId,
        username: actor.username,
        ip: actor.ip,
        action,
        target_type: targetType,
        target_id: targetId,
        details: typeof details === "string" ? details : JSON.stringify(details),
        prev_hash: last?.hash ?? GENESIS,
        alg: HMAC,
        key_id: this.keys.current.id,
      };
      const hash = this.seal(f);
      const r = await one<{ seq: number }>(
        c,
        "INSERT INTO audit_log (ts, user_id, username, ip, action, target_type, target_id, details, prev_hash, hash, alg, key_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING seq",
        [f.ts, f.user_id, f.username, f.ip, f.action, f.target_type, f.target_id, f.details, f.prev_hash, hash, f.alg, f.key_id],
      );
      return { seq: r!.seq, ...f, hash };
    });
    // Copie pour un collecteur externe (journald, syslog, SIEM) : conserve la preuve hors de la base.
    if (this.opts.stdout) {
      process.stdout.write(`${JSON.stringify({ type: "beffroi.audit", seq: e.seq, ts: e.ts, user: e.username, userId: e.user_id, ip: e.ip, action: e.action, targetType: e.target_type, target: e.target_id, details: e.details, hash: e.hash })}\n`);
    }
  }

  /**
   * Passage d'un journal de la version 1.0 (empreintes SHA-256) au scellement HMAC : une entrée
   * scellée atteste le nombre et la dernière empreinte des entrées existantes, qui ne peuvent
   * ensuite plus être réécrites sans casser cette attestation.
   */
  async upgradeLegacy(): Promise<void> {
    const legacy = await one<{ n: number; last: string | null; seq: number | null }>(
      this.db,
      `SELECT count(*) AS n, max(seq) AS seq, (SELECT hash FROM audit_log WHERE alg = '${LEGACY}' ORDER BY seq DESC LIMIT 1) AS last FROM audit_log WHERE alg = '${LEGACY}'`,
    );
    if (!legacy?.n) return;
    const anchored = await one(this.db, "SELECT 1 FROM audit_log WHERE action = $1 AND alg = $2", [UPGRADE, HMAC]);
    if (anchored) return;
    await this.write({ userId: null, username: "system", ip: "" }, UPGRADE, "audit", "", { legacyEntries: legacy.n, lastSeq: legacy.seq, lastHash: legacy.last });
  }

  async query(filter: { from?: string; to?: string; action?: string; user?: string; target?: string; limit?: number; offset?: number }) {
    const where: string[] = [];
    const args: (string | number)[] = [];
    const add = (sql: string, v: string) => {
      args.push(v);
      where.push(sql.replace("?", `$${args.length}`));
    };
    if (filter.from) add("ts >= ?", filter.from);
    if (filter.to) add("ts <= ?", filter.to);
    if (filter.action) add("action LIKE ?", `${filter.action.replace(/[\\%_]/g, "\\$&")}%`);
    if (filter.user) add("username ILIKE ?", `%${filter.user.replace(/[\\%_]/g, "\\$&")}%`);
    if (filter.target) add("target_id = ?", filter.target);
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = (await one<{ n: number }>(this.db, `SELECT count(*) AS n FROM audit_log ${clause}`, args))?.n ?? 0;
    const rows = await all<AuditEntry>(
      this.db,
      `SELECT * FROM audit_log ${clause} ORDER BY seq DESC LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
      [...args, Math.min(filter.limit ?? 100, 5000), filter.offset ?? 0],
    );
    return { total, rows };
  }

  /**
   * Vérifie le chaînage et le scellement de chaque entrée. Les entrées SHA-256 (version 1.0) ne sont
   * acceptées que si une entrée d'ancrage HMAC en atteste le nombre et la dernière empreinte ;
   * après la première entrée HMAC, toute entrée non scellée est une altération (rétrogradation).
   * La première entrée conservée peut suivre une purge journalisée.
   */
  async verify(): Promise<{ ok: boolean; checked: number; brokenAt: number | null; reason?: string }> {
    const rows = await all<AuditEntry>(this.db, "SELECT * FROM audit_log ORDER BY seq ASC");
    let prev: string | null = null;
    let sealedSeen = false;
    let legacyCount = 0;
    let legacyLast: string | null = null;
    const broken = (r: AuditEntry, reason: string) => ({ ok: false, checked: rows.length, brokenAt: r.seq, reason });
    for (const r of rows) {
      if (prev !== null && r.prev_hash !== prev) return broken(r, "chaînage rompu");
      const { seq: _s, hash, ...rest } = r;
      if (r.alg === LEGACY) {
        if (sealedSeen) return broken(r, "entrée non scellée après le passage au HMAC");
        legacyCount++;
        legacyLast = hash;
      } else if (r.alg === HMAC) {
        if (!this.keys.has(r.key_id)) return broken(r, `clé ${r.key_id} absente du trousseau`);
        sealedSeen = true;
        if (r.action === UPGRADE && legacyCount) {
          const d = JSON.parse(r.details) as { legacyEntries: number; lastHash: string };
          if (d.lastHash !== legacyLast) return broken(r, "attestation des entrées antérieures invalide");
          legacyCount = 0;
        }
      } else return broken(r, "algorithme inconnu");
      if (!safeEqual(this.seal(rest), hash)) return broken(r, "empreinte invalide");
      prev = hash;
    }
    const last = rows.at(-1);
    // Le serveur scelle au moins une entrée à chaque démarrage : un journal sans entrée scellée a été réécrit.
    if (last && !sealedSeen) return broken(last, "aucune entrée scellée");
    if (last && legacyCount) return broken(last, "entrées antérieures non attestées");
    return { ok: true, checked: rows.length, brokenAt: null };
  }

  /** Purge des entrées de plus d'un an, par la fonction contrôlée de la base ; l'opération est journalisée. */
  async purge(actor: AuditActor, before: string): Promise<number> {
    const r = await one<{ n: number }>(this.db, "SELECT beffroi_audit_purge($1) AS n", [before]);
    const deleted = Number(r?.n ?? 0);
    await this.write(actor, "audit.purge", "audit", "", { before, deleted });
    return deleted;
  }
}
