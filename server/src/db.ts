import pg from "pg";

// Types renvoyés par PostgreSQL : entiers 64 bits en nombres (horodatages en ms, compteurs),
// dates en chaînes ISO 8601 (UTC) comme dans le reste de l'application.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
const parseTimestamptz = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => (parseTimestamptz(v) as Date).toISOString());

/** Migrations successives ; chacune est appliquée une seule fois, dans une transaction. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    function TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    can_create BOOLEAN NOT NULL DEFAULT TRUE,
    password_hash TEXT NOT NULL,
    must_change BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until BIGINT NOT NULL DEFAULT 0,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX users_username ON users (lower(username));

  CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX groups_name ON groups (lower(name));

  CREATE TABLE group_members (
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, user_id)
  );
  CREATE INDEX group_members_user ON group_members (user_id);

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    last_seen BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX sessions_user ON sessions (user_id);

  CREATE TABLE studies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    reference TEXT NOT NULL DEFAULT '',
    organisation TEXT NOT NULL DEFAULT '',
    protection TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    current_version_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE study_versions (
    id TEXT PRIMARY KEY,
    study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    major INTEGER NOT NULL,
    minor INTEGER NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('initial', 'operational', 'strategic')),
    summary TEXT NOT NULL DEFAULT '',
    workshops JSONB NOT NULL DEFAULT '[]',
    frozen BOOLEAN NOT NULL DEFAULT FALSE,
    rev INTEGER NOT NULL DEFAULT 1,
    data BYTEA NOT NULL,
    stats JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT NOT NULL,
    UNIQUE (study_id, major, minor)
  );

  CREATE TABLE study_acl (
    study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'group')),
    principal_id TEXT NOT NULL,
    access TEXT NOT NULL CHECK (access IN ('read', 'write', 'owner')),
    PRIMARY KEY (study_id, principal_type, principal_id)
  );
  CREATE INDEX study_acl_principal ON study_acl (principal_type, principal_id);

  CREATE TABLE audit_log (
    seq BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL,
    user_id TEXT,
    username TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT '',
    target_id TEXT NOT NULL DEFAULT '',
    details TEXT NOT NULL DEFAULT '',
    prev_hash TEXT NOT NULL,
    hash TEXT NOT NULL
  );
  CREATE INDEX audit_ts ON audit_log (ts);
  CREATE INDEX audit_action ON audit_log (action);
  `,
  // 2 — authentification OpenID Connect.
  `
  ALTER TABLE users ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'local' CHECK (auth_source IN ('local', 'oidc'));
  ALTER TABLE users ADD COLUMN oidc_issuer TEXT;
  ALTER TABLE users ADD COLUMN oidc_sub TEXT;
  CREATE UNIQUE INDEX users_oidc ON users (oidc_issuer, oidc_sub) WHERE oidc_sub IS NOT NULL;

  CREATE TABLE oidc_requests (
    state TEXT PRIMARY KEY,
    code_verifier TEXT NOT NULL,
    nonce TEXT NOT NULL,
    created_at BIGINT NOT NULL
  );
  `,
  // 3 — sécurité : métadonnées chiffrées, authentification multifacteur, journal inviolable.
  `
  ALTER TABLE studies ADD COLUMN meta_enc BYTEA;
  ALTER TABLE study_versions ADD COLUMN summary_enc BYTEA;

  ALTER TABLE users ADD COLUMN password_history JSONB NOT NULL DEFAULT '[]';
  ALTER TABLE users ADD COLUMN previous_login TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN mfa_secret BYTEA;
  ALTER TABLE users ADD COLUMN mfa_pending BYTEA;
  ALTER TABLE users ADD COLUMN mfa_last_step BIGINT NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN mfa_recovery JSONB NOT NULL DEFAULT '[]';
  ALTER TABLE users ADD COLUMN mfa_enabled_at TIMESTAMPTZ;

  ALTER TABLE sessions ADD COLUMN mfa BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE TABLE mfa_challenges (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );

  ALTER TABLE audit_log ADD COLUMN alg TEXT NOT NULL DEFAULT 'sha256';
  ALTER TABLE audit_log ADD COLUMN key_id TEXT NOT NULL DEFAULT '';

  -- Journal en ajout seul : aucune modification, suppression uniquement par la purge contrôlée.
  CREATE FUNCTION beffroi_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF TG_OP = 'DELETE' AND current_setting('beffroi.audit_purge', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'journal d''audit en ajout seul : % refusé', TG_OP USING ERRCODE = 'insufficient_privilege';
  END $$;
  CREATE TRIGGER audit_log_guard BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION beffroi_audit_guard();
  CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION beffroi_audit_guard();

  CREATE FUNCTION beffroi_audit_purge(before TIMESTAMPTZ) RETURNS BIGINT
  LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
  DECLARE n BIGINT;
  BEGIN
    IF before > now() - interval '365 days' THEN
      RAISE EXCEPTION 'seules les entrées de plus d''un an peuvent être purgées';
    END IF;
    PERFORM set_config('beffroi.audit_purge', 'on', true);
    DELETE FROM audit_log WHERE ts < before;
    GET DIAGNOSTICS n = ROW_COUNT;
    PERFORM set_config('beffroi.audit_purge', 'off', true);
    RETURN n;
  END $$;
  REVOKE ALL ON FUNCTION beffroi_audit_purge(TIMESTAMPTZ) FROM PUBLIC;
  `,
];

/** Tables en lecture et écriture pour le rôle applicatif ; le journal n'est accessible qu'en ajout. */
const APP_TABLES = ["users", "groups", "group_members", "sessions", "studies", "study_versions", "study_acl", "oidc_requests", "mfa_challenges"];

export type DB = pg.Pool;
/** Pool ou connexion d'une transaction en cours. */
export type Queryable = pg.Pool | pg.PoolClient;

export interface PoolOptions {
  connectionString?: string;
  max?: number;
  /** TLS vers PostgreSQL : « disable », « require » (chiffré) ou « verify-full » (chiffré et serveur authentifié). */
  ssl?: "disable" | "require" | "verify-full";
  /** Autorité de certification du serveur PostgreSQL (PEM), pour « verify-full ». */
  sslCa?: string;
}

export function createPool(opts: PoolOptions): DB {
  const ssl =
    opts.ssl === "verify-full" ? { rejectUnauthorized: true, ...(opts.sslCa ? { ca: opts.sslCa } : {}) } : opts.ssl === "require" ? { rejectUnauthorized: false } : undefined;
  return new pg.Pool({
    connectionString: opts.connectionString,
    max: opts.max ?? 10,
    application_name: "beffroi",
    ...(ssl ? { ssl } : {}),
    // Bornes d'exécution : une requête ou une transaction bloquée ne peut pas monopoliser la base.
    statement_timeout: 30_000,
    lock_timeout: 10_000,
    idle_in_transaction_session_timeout: 60_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * Droits minimaux du rôle applicatif lorsque les migrations sont exécutées par un rôle distinct
 * (propriétaire du schéma) : lecture et écriture des tables métier, ajout seul dans le journal,
 * purge du journal uniquement par la fonction contrôlée, aucune modification du schéma.
 */
export async function grantAppRole(owner: DB, appRole: string): Promise<void> {
  await tx(owner, async (c) => {
    const role = (await c.query<{ q: string }>("SELECT quote_ident($1) AS q", [appRole])).rows[0].q;
    const schema = (await c.query<{ q: string }>("SELECT quote_ident(current_schema()) AS q")).rows[0].q;
    await c.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
    await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${APP_TABLES.join(", ")} TO ${role}`);
    await c.query(`REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM ${role}`);
    await c.query(`GRANT SELECT, INSERT ON audit_log TO ${role}`);
    await c.query(`GRANT SELECT ON schema_migrations TO ${role}`);
    await c.query(`GRANT USAGE ON SEQUENCE audit_log_seq_seq TO ${role}`);
    await c.query(`GRANT EXECUTE ON FUNCTION beffroi_audit_purge(TIMESTAMPTZ) TO ${role}`);
  });
}

/** Constats sur les droits du rôle applicatif (avertissements au démarrage). */
export async function privilegeWarnings(db: DB): Promise<string[]> {
  const r = await one<{ superuser: boolean; owner: boolean; audit_update: boolean }>(
    db,
    `SELECT rolsuper AS superuser,
            EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_log' AND schemaname = current_schema() AND tableowner = current_user) AS owner,
            has_table_privilege(current_user, 'audit_log', 'UPDATE') AS audit_update
     FROM pg_roles WHERE rolname = current_user`,
  );
  const out: string[] = [];
  if (r?.superuser) out.push("le rôle PostgreSQL de l'application est super-utilisateur : utilisez un rôle dédié sans privilège d'administration");
  if (r?.owner) out.push("le rôle PostgreSQL de l'application est propriétaire du schéma : définissez DATABASE_MIGRATION_URL pour séparer migrations et exécution (moindre privilège)");
  else if (r?.audit_update) out.push("le rôle PostgreSQL de l'application peut modifier le journal d'audit");
  return out;
}

/** Version du schéma en base (0 si la base est vide). */
export async function schemaVersion(db: Queryable): Promise<number> {
  const exists = (await db.query<{ e: boolean }>("SELECT to_regclass('schema_migrations') IS NOT NULL AS e")).rows[0].e;
  if (!exists) return 0;
  return (await db.query<{ v: number | null }>("SELECT max(version) AS v FROM schema_migrations")).rows[0].v ?? 0;
}

export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Applique les migrations manquantes (verrou consultatif : plusieurs instances peuvent démarrer
 * ensemble). Un schéma à jour ne demande aucun droit de création : le rôle applicatif peut démarrer
 * sur une base migrée par le rôle propriétaire.
 */
export async function migrate(db: DB): Promise<void> {
  if ((await schemaVersion(db)) >= MIGRATIONS.length) return;
  await tx(db, async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(4242001)");
    await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    const { rows } = await c.query<{ v: number | null }>("SELECT max(version) AS v FROM schema_migrations");
    for (let v = rows[0].v ?? 0; v < MIGRATIONS.length; v++) {
      await c.query(MIGRATIONS[v]);
      await c.query("INSERT INTO schema_migrations (version) VALUES ($1)", [v + 1]);
    }
  });
}

export async function tx<T>(db: DB, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export async function one<T extends pg.QueryResultRow>(db: Queryable, sql: string, args: unknown[] = []): Promise<T | undefined> {
  return (await db.query<T>(sql, args)).rows[0];
}

export async function all<T extends pg.QueryResultRow>(db: Queryable, sql: string, args: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, args)).rows;
}

export const now = () => new Date().toISOString();
