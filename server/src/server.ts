import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { bootstrapAdmin, buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool, grantAppRole, migrate, one, SCHEMA_VERSION } from "./db.js";
import { APP_VERSION } from "./http.js";

const config = loadConfig();

// Mode « migration seule » (conteneur éphémère avec le rôle propriétaire du schéma) : le service
// applicatif ne reçoit ensuite que les identifiants du rôle applicatif, sans droit sur le schéma.
if (process.argv.includes("--migrate")) {
  const ownerUrl = config.databaseMigrationUrl ?? config.databaseUrl;
  const owner = createPool({ connectionString: ownerUrl, max: 1, ssl: config.databaseSsl, sslCa: config.databaseSslCa });
  await migrate(owner);
  const appRole = config.databaseUrl ? decodeURIComponent(new URL(config.databaseUrl).username) : "";
  const ownerRole = (await one<{ u: string }>(owner, "SELECT current_user AS u"))!.u;
  if (appRole && appRole !== ownerRole) await grantAppRole(owner, appRole);
  await owner.end();
  console.log(`Schéma à jour (version ${SCHEMA_VERSION})${appRole && appRole !== ownerRole ? `, droits minimaux accordés à ${appRole}` : ""}.`);
  process.exit(0);
}

const { app, ctx } = await buildApp(config);

const password = await bootstrapAdmin(ctx);
if (password) {
  const line = "═".repeat(64);
  // Un mot de passe fourni par l'exploitant (ADMIN_INITIAL_PASSWORD[_FILE]) n'est jamais recopié dans les journaux.
  const shown = config.bootstrapAdminPassword ? "celui fourni par ADMIN_INITIAL_PASSWORD(_FILE)" : password;
  console.log(`\n${line}\n Compte administrateur créé\n   identifiant : admin\n   mot de passe : ${shown}\n Ce mot de passe devra être changé à la première connexion.\n${line}\n`);
}

// HTTPS natif (TLS 1.2 minimum, suites AEAD à confidentialité persistante) ou HTTP derrière un
// reverse proxy qui termine TLS (Nginx, HAProxy).
const server =
  config.tlsCert && config.tlsKey
    ? https.createServer(
        {
          cert: fs.readFileSync(config.tlsCert),
          key: fs.readFileSync(config.tlsKey),
          minVersion: "TLSv1.2",
          ciphers: [
            "TLS_AES_256_GCM_SHA384",
            "TLS_AES_128_GCM_SHA256",
            "TLS_CHACHA20_POLY1305_SHA256",
            "ECDHE-ECDSA-AES256-GCM-SHA384",
            "ECDHE-RSA-AES256-GCM-SHA384",
            "ECDHE-ECDSA-AES128-GCM-SHA256",
            "ECDHE-RSA-AES128-GCM-SHA256",
          ].join(":"),
          honorCipherOrder: true,
        },
        app,
      )
    : http.createServer(app);
server.requestTimeout = 60_000;
server.headersTimeout = 20_000;

const system = { userId: null, username: "system", ip: "" };
await ctx.audit.write(system, "app.start", "app", "", { version: APP_VERSION });
const purge = setInterval(() => void ctx.sessions.purgeExpired().catch((e) => ctx.log.error("purge des sessions", e)), 10 * 60_000);
purge.unref();

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    await ctx.audit.write(system, "app.stop", "app", "", { signal: sig }).catch(() => undefined);
    server.close();
    await ctx.db.end();
    process.exit(0);
  });
}

server.listen(config.port, config.host, () => ctx.log.info(`Beffroi RM ${APP_VERSION} à l'écoute sur ${config.tlsCert ? "https" : "http"}://${config.host}:${config.port}`));
