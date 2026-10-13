/**
 * Beffroi RM en mode « poste seul » : un utilisateur, sur son propre poste, sans PostgreSQL ni comptes.
 *
 * Le programme sert l'application sur 127.0.0.1 uniquement et ouvre le navigateur. Les études sont
 * des fichiers JSON dans le dossier de données de l'utilisateur. L'accès est réservé au navigateur
 * ouvert par le programme : un jeton aléatoire, renouvelé à chaque lancement, est déposé dans un
 * cookie HttpOnly SameSite=Strict ; l'en-tête Host est vérifié (rebinding DNS).
 *
 * Empaqueté en exécutable autonome (Node.js SEA) par scripts/poste.mjs.
 */
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { HttpError, type SessionUser } from "./auth.js";
import { APP_VERSION, json } from "./http.js";
import { LocalStudyStore } from "./local-store.js";
import { studyRoutes } from "./routes/studies.js";
import { requestGuards, securityHeaders } from "./web-security.js";

const DEFAULT_PORT = 47380;
const COOKIE = "beffroi_poste";

const AIDE = `Beffroi RM ${APP_VERSION} — mode poste seul

Usage : beffroi-poste [options]

  --port <n>          port d'écoute sur 127.0.0.1 (défaut ${DEFAULT_PORT}, 0 = port libre au hasard)
  --donnees <dossier> dossier des études (défaut : ${defaultDataDir()})
  --sans-navigateur   ne pas ouvrir le navigateur (l'adresse est affichée)
  --version           affiche la version
  --aide              affiche cette aide
`;

function defaultDataDir(): string {
  if (process.env.BEFFROI_DONNEES) return path.resolve(process.env.BEFFROI_DONNEES);
  if (process.platform === "win32") return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "Beffroi");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Beffroi");
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "beffroi");
}

interface Options {
  port: number;
  dataDir: string;
  browser: boolean;
}

function parseArgs(argv: string[]): Options {
  const o: Options = { port: Number(process.env.BEFFROI_PORT ?? DEFAULT_PORT), dataDir: defaultDataDir(), browser: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) fail(`Valeur manquante après ${a}.`);
      return v;
    };
    if (a === "--port") o.port = Number(value());
    else if (a === "--donnees" || a === "--data") o.dataDir = path.resolve(value());
    else if (a === "--sans-navigateur" || a === "--no-browser") o.browser = false;
    else if (a === "--version" || a === "-v") {
      console.log(APP_VERSION);
      process.exit(0);
    } else if (a === "--aide" || a === "--help" || a === "-h") {
      console.log(AIDE);
      process.exit(0);
    } else fail(`Option inconnue : ${a}\n\n${AIDE}`);
  }
  if (!Number.isInteger(o.port) || o.port < 0 || o.port > 65535) fail("Port invalide.");
  return o;
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(2);
}

// ─────────── fichiers de l'application web ───────────

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

interface Assets {
  has(p: string): boolean;
  get(p: string): Buffer;
}

/** Fichiers embarqués dans l'exécutable (SEA) ou, à défaut, lus dans web/dist. */
async function loadAssets(): Promise<Assets> {
  const sea = await import("node:sea").catch(() => null);
  if (sea?.isSea()) {
    const list = new Set<string>(JSON.parse(sea.getAsset("web-manifest", "utf8")) as string[]);
    return { has: (p) => list.has(p), get: (p) => Buffer.from(sea.getRawAsset(`web/${p}`) as ArrayBuffer) };
  }
  const dir = process.env.STATIC_DIR ? path.resolve(process.env.STATIC_DIR) : path.resolve(path.dirname(process.argv[1] ?? "."), "../../web/dist");
  if (!fs.existsSync(path.join(dir, "index.html"))) fail(`Application web introuvable dans ${dir} : lancez « npm run build -w web ».`);
  const list = new Set(fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join("/")));
  return { has: (p) => list.has(p), get: (p) => fs.readFileSync(path.join(dir, p)) };
}

// ─────────── instance unique ───────────

interface Instance {
  pid: number;
  port: number;
  token: string;
}

/** Une instance déjà lancée sur ce dossier de données répond-elle ? */
async function runningInstance(file: string): Promise<Instance | null> {
  let inst: Instance;
  try {
    inst = JSON.parse(fs.readFileSync(file, "utf8")) as Instance;
    process.kill(inst.pid, 0);
  } catch {
    return null;
  }
  try {
    const r = await fetch(`http://127.0.0.1:${inst.port}/api/poste`, { signal: AbortSignal.timeout(2000) });
    return r.ok && ((await r.json()) as { app?: string }).app === "beffroi-poste" ? inst : null;
  } catch {
    return null;
  }
}

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.on("error", () => console.log(`Ouvrez cette adresse dans votre navigateur : ${url}`));
    child.unref();
  } catch {
    console.log(`Ouvrez cette adresse dans votre navigateur : ${url}`);
  }
}

// ─────────── application ───────────

function sameToken(a: unknown, b: string): boolean {
  if (typeof a !== "string" || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.dataDir, { recursive: true, mode: 0o700 });
  const instanceFile = path.join(opts.dataDir, "instance.json");

  const existing = await runningInstance(instanceFile);
  if (existing) {
    const url = `http://127.0.0.1:${existing.port}/ouvrir?jeton=${existing.token}`;
    console.log(`Beffroi RM est déjà ouvert sur ce poste : ${url}`);
    if (opts.browser) openBrowser(url);
    return;
  }

  const assets = await loadAssets();
  const store = new LocalStudyStore(opts.dataDir);
  const token = randomBytes(32).toString("base64url");
  const user: SessionUser = {
    id: "local",
    username: os.userInfo().username,
    displayName: os.userInfo().username,
    email: "",
    function: "",
    role: "user",
    canCreate: true,
    mustChange: false,
    authSource: "local",
    mfaEnabled: false,
    mustEnrollMfa: false,
    previousLogin: null,
  };
  // Le port réel n'est connu qu'après l'écoute (port 0).
  let hosts = new Set<string>();

  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);
  app.use(securityHeaders(false));
  // Anti-rebinding DNS : seul l'hôte local exact est servi.
  app.use((req, _res, next) => {
    if (!hosts.has(req.get("host") ?? "")) throw new HttpError(421, "Hôte refusé.");
    next();
  });

  // Ouverture par le programme : dépôt du jeton dans un cookie, puis accueil.
  app.get("/ouvrir", (req, res) => {
    if (!sameToken(req.query.jeton, token)) throw new HttpError(403, "Lien d'ouverture invalide : relancez Beffroi RM.");
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: "strict", path: "/" });
    res.setHeader("Cache-Control", "no-store");
    res.redirect(303, "/");
  });

  const api = express.Router();
  api.use(requestGuards());
  api.use(express.json({ limit: "20mb", strict: true }));
  api.use(cookieParser());
  // Sonde de l'instance unique (sans donnée).
  api.get("/poste", (_req, res) => void res.json({ app: "beffroi-poste", version: APP_VERSION }));
  api.use((req, _res, next) => {
    req.user = sameToken(req.cookies?.[COOKIE], token) ? user : null;
    req.sessionHash = null;
    next();
  });
  api.get("/auth/me", (req, res) =>
    void res.json({ user: req.user, version: APP_VERSION, mode: "poste", mfaPolicy: "optional", auth: { localLogin: false, oidc: null } }),
  );
  api.use((req, _res, next) => {
    if (!req.user) throw new HttpError(401, "Accès réservé au navigateur ouvert par Beffroi RM : relancez le programme.");
    next();
  });
  api.get("/directory", (_req, res) => void res.json({ users: [], groups: [] }));
  api.use(studyRoutes({ audit: { write: async () => undefined }, store }));
  api.get("/health", json(async () => ({ ok: true })));
  api.use(() => {
    throw new HttpError(404, "Ressource inconnue.");
  });
  app.use("/api", api);

  // Application web : fichiers embarqués, puis index.html pour les routes du client.
  app.get("/{*chemin}", (req, res) => {
    let p = "";
    try {
      p = decodeURIComponent(req.path).replace(/^\/+/, "");
    } catch {
      /* chemin mal encodé : accueil */
    }
    const file = p && assets.has(p) ? p : "index.html";
    res.type(TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Cache-Control", file.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    res.send(assets.get(file));
  });

  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message, ...err.extra });
    if (err.type === "entity.parse.failed") return void res.status(400).json({ error: "Corps de requête JSON invalide." });
    if (err.type === "entity.too.large") return void res.status(413).json({ error: "Requête trop volumineuse." });
    if (err.status && err.status < 500) return void res.status(err.status).json({ error: "Requête invalide." });
    console.error(err);
    res.status(500).json({ error: "Erreur interne." });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", (e: NodeJS.ErrnoException) => {
      // Port occupé par un autre programme : un port libre au hasard.
      if (e.code === "EADDRINUSE" && opts.port !== 0) {
        console.log(`Port ${opts.port} occupé : choix d'un port libre.`);
        server.listen(0, "127.0.0.1", resolve);
      } else reject(e);
    });
    server.listen(opts.port, "127.0.0.1", resolve);
  });
  const port = (server.address() as { port: number }).port;
  hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  fs.writeFileSync(instanceFile, JSON.stringify({ pid: process.pid, port, token } satisfies Instance), { mode: 0o600 });

  const url = `http://127.0.0.1:${port}/ouvrir?jeton=${token}`;
  console.log(`
Beffroi RM ${APP_VERSION} — mode poste seul
  Adresse : ${url}
  Études  : ${path.join(opts.dataDir, "etudes")}
Gardez cette fenêtre ouverte pendant votre travail ; fermez-la (ou Ctrl+C) pour quitter.
`);
  if (opts.browser) openBrowser(url);

  const stop = () => {
    try {
      const cur = JSON.parse(fs.readFileSync(instanceFile, "utf8")) as Instance;
      if (cur.pid === process.pid) fs.rmSync(instanceFile);
    } catch {
      /* déjà supprimé */
    }
    process.exit(0);
  };
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const) process.on(sig, stop);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
