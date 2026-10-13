import fs from "node:fs";
import path from "node:path";

/** Authentification unique OpenID Connect (Keycloak, LemonLDAP::NG, ProConnect…). */
export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** URL de retour enregistrée chez le fournisseur : https://<hôte>/api/auth/oidc/callback */
  redirectUri: string;
  scopes: string;
  /** Libellé du bouton de connexion. */
  label: string;
  /** Création du compte à la première connexion ; sinon, compte préalablement créé par l'administrateur. */
  autoCreate: boolean;
  /** Niveau d'authentification exigé (paramètre acr_values, vérifié dans le jeton d'identité). */
  acrValues?: string;
  /** Autorise un fournisseur en HTTP (développement et tests uniquement). */
  allowHttp: boolean;
}

export interface Config {
  host: string;
  port: number;
  /** Connexion PostgreSQL (URL). Sinon, variables standard PGHOST, PGUSER, PGDATABASE… */
  databaseUrl?: string;
  /** Connexion du rôle propriétaire du schéma, utilisée seulement pour les migrations (moindre privilège). */
  databaseMigrationUrl?: string;
  /** TLS vers PostgreSQL. */
  databaseSsl: "disable" | "require" | "verify-full";
  /** Autorité de certification du serveur PostgreSQL (contenu PEM). */
  databaseSslCa?: string;
  /** Taille maximale du pool de connexions PostgreSQL. */
  databasePoolSize: number;
  /** Dossier de la clé maître lorsqu'elle n'est pas fournie par BEFFROI_MASTER_KEY. */
  dataDir: string;
  /** Clé maître (base64, 32 octets). Sinon lue ou générée dans dataDir/master.key. */
  masterKey?: string;
  /** Clés maîtres précédentes, conservées le temps de la rotation (lecture seule). */
  previousMasterKeys: string[];
  tlsCert?: string;
  tlsKey?: string;
  /** Force l'attribut Secure du cookie (derrière un reverse proxy HTTPS). */
  cookieSecure: boolean;
  trustProxy: boolean;
  sessionIdleMinutes: number;
  /** Inactivité maximale d'une session administrateur (plus courte). */
  adminSessionIdleMinutes: number;
  sessionMaxHours: number;
  maxFailedLogins: number;
  lockoutMinutes: number;
  staticDir?: string;
  /** Mot de passe initial du compte administrateur (sinon généré et affiché une fois). */
  bootstrapAdminPassword?: string;
  logLevel: "error" | "warn" | "info";
  oidc?: OidcConfig;
  /** Connexion par mot de passe local pour les analystes (l'administrateur garde toujours un accès local). */
  localLogin: boolean;
  /**
   * Authentification multifacteur des comptes locaux : « required » (tous), « admin » (administrateurs)
   * ou « optional » (au choix de l'utilisateur). Les comptes OIDC relèvent du fournisseur d'identité.
   */
  mfaPolicy: "required" | "admin" | "optional";
  /** Copie du journal d'audit sur la sortie standard (JSON par ligne) pour un collecteur ou un SIEM. */
  auditStdout: boolean;
  /** Requêtes d'API autorisées par adresse IP et par minute. */
  rateLimitPerMinute: number;
  /** Tentatives de connexion autorisées par adresse IP et par minute (mot de passe et second facteur). */
  loginRateLimitPerMinute: number;
  /**
   * Accepte les empreintes de mot de passe de l'ancien format (antérieur à Beffroi RM 1.0.0, sans poivre)
   * et les remplace à la connexion. À n'activer que pendant la migration : ce format permet à qui écrit
   * dans la base de contourner le poivre. Vrai uniquement si ALLOW_LEGACY_PASSWORD_HASHES vaut « true ».
   */
  allowLegacyPasswordHashes: boolean;
}

/**
 * Valeur d'une variable ou, pour les secrets, du fichier désigné par la variable suffixée « _FILE »
 * (secrets Docker ou Kubernetes : le secret n'apparaît pas dans l'environnement du processus).
 */
function secret(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const file = env[`${name}_FILE`];
  if (file) return fs.readFileSync(file, "utf8").trim();
  return env[name];
}

/** Connexion PostgreSQL dont le mot de passe est lu dans un fichier (secret), inséré dans l'URL. */
function dbUrl(env: NodeJS.ProcessEnv, urlName: string, passwordName: string): string | undefined {
  const url = secret(env, urlName);
  const password = secret(env, passwordName);
  if (!url || !password) return url;
  const u = new URL(url);
  u.password = encodeURIComponent(password);
  return u.toString();
}

const bool = (v: string | undefined, def: boolean) => (v === undefined ? def : ["1", "true", "yes", "on"].includes(v.toLowerCase()));

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const level = env.LOG_LEVEL ?? "info";
  return {
    host: env.HOST ?? "127.0.0.1",
    port: Number(env.PORT ?? 8080),
    databaseUrl: dbUrl(env, "DATABASE_URL", "DATABASE_PASSWORD"),
    databaseMigrationUrl: dbUrl(env, "DATABASE_MIGRATION_URL", "DATABASE_MIGRATION_PASSWORD"),
    databaseSsl: env.DATABASE_SSL === "require" || env.DATABASE_SSL === "verify-full" ? env.DATABASE_SSL : "disable",
    databaseSslCa: env.DATABASE_SSL_CA_FILE ? fs.readFileSync(env.DATABASE_SSL_CA_FILE, "utf8") : undefined,
    databasePoolSize: Number(env.DATABASE_POOL_SIZE ?? 10),
    dataDir: path.resolve(env.DATA_DIR ?? "data"),
    masterKey: secret(env, "BEFFROI_MASTER_KEY"),
    previousMasterKeys: (secret(env, "BEFFROI_PREVIOUS_MASTER_KEYS") ?? "").split(",").map((k) => k.trim()).filter(Boolean),
    tlsCert: env.TLS_CERT,
    tlsKey: env.TLS_KEY,
    cookieSecure: bool(env.COOKIE_SECURE, !!env.TLS_CERT),
    trustProxy: bool(env.TRUST_PROXY, false),
    sessionIdleMinutes: Number(env.SESSION_IDLE_MINUTES ?? 30),
    adminSessionIdleMinutes: Number(env.ADMIN_SESSION_IDLE_MINUTES ?? 15),
    sessionMaxHours: Number(env.SESSION_MAX_HOURS ?? 12),
    maxFailedLogins: Number(env.MAX_FAILED_LOGINS ?? 5),
    lockoutMinutes: Number(env.LOCKOUT_MINUTES ?? 15),
    staticDir: env.STATIC_DIR ? path.resolve(env.STATIC_DIR) : undefined,
    bootstrapAdminPassword: secret(env, "ADMIN_INITIAL_PASSWORD"),
    logLevel: level === "error" || level === "warn" ? level : "info",
    oidc: env.OIDC_ISSUER
      ? {
          issuer: env.OIDC_ISSUER,
          clientId: env.OIDC_CLIENT_ID ?? "",
          clientSecret: secret(env, "OIDC_CLIENT_SECRET") ?? "",
          redirectUri: env.OIDC_REDIRECT_URI ?? "",
          scopes: env.OIDC_SCOPES ?? "openid profile email",
          label: env.OIDC_LABEL ?? "Se connecter avec le compte de l'organisation",
          autoCreate: bool(env.OIDC_AUTO_CREATE, true),
          acrValues: env.OIDC_ACR_VALUES || undefined,
          allowHttp: bool(env.OIDC_ALLOW_HTTP, false),
        }
      : undefined,
    localLogin: bool(env.LOCAL_LOGIN, true),
    mfaPolicy: env.MFA_POLICY === "admin" || env.MFA_POLICY === "optional" ? env.MFA_POLICY : "required",
    auditStdout: bool(env.AUDIT_STDOUT, false),
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE ?? 600),
    loginRateLimitPerMinute: Number(env.LOGIN_RATE_LIMIT_PER_MINUTE ?? 20),
    allowLegacyPasswordHashes: env.ALLOW_LEGACY_PASSWORD_HASHES === "true",
  };
}
