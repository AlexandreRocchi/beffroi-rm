import { all, one, tx, type DB } from "./db.js";
import type { Keyring, Sealer } from "./keys.js";
import type { StudyStore } from "./studies.js";

export interface RewrapReport {
  studies: number;
  versions: number;
  mfa: number;
  /** Empreintes de mot de passe encore liées à une ancienne clé (renouvelées à la prochaine connexion). */
  stalePasswords: number;
  /**
   * Empreintes de l'ancien format (antérieur à Beffroi RM 1.0.0, sans poivre) : refusées par défaut,
   * renouvelées à la connexion seulement si ALLOW_LEGACY_PASSWORD_HASHES=true.
   */
  legacyPasswords: number;
}

/**
 * Mise à niveau cryptographique au démarrage, par lots et sans interruption du service :
 * - chiffre les métadonnées d'étude encore en clair (ancien format, antérieur à Beffroi RM 1.0.0) et vide les colonnes en clair ;
 * - rechiffre avec la clé courante tout ce qui l'a été avec une clé précédente ou l'ancien format.
 * Une fois le rapport vide, les clés précédentes peuvent être retirées du trousseau.
 */
export async function rewrap(db: DB, keys: Keyring, sealer: Sealer, store: StudyStore): Promise<RewrapReport> {
  const report: RewrapReport = { studies: 0, versions: 0, mfa: 0, stalePasswords: 0, legacyPasswords: 0 };

  for (const s of await all<{ id: string; name: string; reference: string; organisation: string; meta_enc: Buffer | null }>(
    db,
    "SELECT id, name, reference, organisation, meta_enc FROM studies",
  )) {
    if (s.meta_enc && !sealer.isStale(s.meta_enc)) continue;
    const names = store.openNames(s);
    await db.query("UPDATE studies SET name = '', reference = '', organisation = '', meta_enc = $1 WHERE id = $2", [store.sealNames(s.id, names), s.id]);
    report.studies++;
  }

  for (const { id } of await all<{ id: string }>(db, "SELECT id FROM study_versions")) {
    await tx(db, async (c) => {
      const v = await one<{ id: string; data: Buffer; summary: string; summary_enc: Buffer | null }>(c, "SELECT id, data, summary, summary_enc FROM study_versions WHERE id = $1 FOR UPDATE", [id]);
      if (!v) return;
      const staleData = sealer.isStale(v.data);
      const staleSummary = !v.summary_enc || sealer.isStale(v.summary_enc);
      if (!staleData && !staleSummary) return;
      const data = staleData ? sealer.seal("study-data", sealer.open("study-data", v.data, `study-version:${v.id}`), `study-version:${v.id}`) : v.data;
      await c.query("UPDATE study_versions SET data = $1, summary = '', summary_enc = $2 WHERE id = $3", [data, store.sealSummary(v.id, store.openSummary(v)), v.id]);
      report.versions++;
    });
  }

  for (const u of await all<{ id: string; mfa_secret: Buffer | null; mfa_pending: Buffer | null }>(
    db,
    "SELECT id, mfa_secret, mfa_pending FROM users WHERE mfa_secret IS NOT NULL OR mfa_pending IS NOT NULL",
  )) {
    const reseal = (b: Buffer | null, aad: string) => (b && sealer.isStale(b) ? sealer.seal("mfa-secret", sealer.open("mfa-secret", b, aad), aad) : b);
    const secret = reseal(u.mfa_secret, `mfa:${u.id}`);
    const pending = reseal(u.mfa_pending, `mfa-pending:${u.id}`);
    if (secret !== u.mfa_secret || pending !== u.mfa_pending) {
      await db.query("UPDATE users SET mfa_secret = $1, mfa_pending = $2 WHERE id = $3", [secret, pending, u.id]);
      report.mfa++;
    }
  }

  // Les empreintes de l'ancien format (« scrypt$… ») sont comptées à part des empreintes liées à une ancienne clé.
  const stale = await one<{ n: number }>(
    db,
    "SELECT count(*) AS n FROM users WHERE auth_source = 'local' AND password_hash <> '!' AND NOT password_hash LIKE $1 AND NOT password_hash LIKE 'scrypt$%'",
    [`scrypt2$${keys.current.id}$%`],
  );
  report.stalePasswords = stale?.n ?? 0;
  const legacy = await one<{ n: number }>(db, "SELECT count(*) AS n FROM users WHERE auth_source = 'local' AND password_hash LIKE 'scrypt$%'");
  report.legacyPasswords = legacy?.n ?? 0;
  return report;
}
