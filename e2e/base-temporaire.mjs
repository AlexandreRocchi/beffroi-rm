/**
 * Base PostgreSQL jetable pour les tests de bout en bout et les captures d'écran.
 * TEST_DATABASE_URL : connexion autorisée à créer des bases (défaut : socket Unix local, utilisateur courant).
 */
import { randomBytes } from "node:crypto";
import os from "node:os";
import pg from "pg";

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? `postgres://${os.userInfo().username}@localhost/postgres?host=/var/run/postgresql`;

export async function createTempDatabase(prefix = "beffroi_e2e") {
  const name = `${prefix}_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async drop() {
      const c = new pg.Client({ connectionString: ADMIN_URL });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}
