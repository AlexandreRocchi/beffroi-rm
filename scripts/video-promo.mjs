/**
 * Vidéo de présentation de Beffroi RM (16:9, 1920 × 1080, H.264) et affiche, à partir de vraies
 * captures de l'application :
 *   1. démarre le serveur compilé sur une base temporaire, crée l'étude exemple du guide ANSSI
 *      et capture les écrans clés en haute définition, ainsi que des pages du rapport PDF généré ;
 *   2. rend docs/promo/pub.html image par image (window.render(t)) et l'encode avec ffmpeg.
 * Sorties : docs/promo/beffroi-presentation.mp4, docs/promo/beffroi-affiche.png,
 *           docs/promo/beffroi-souverainete.png (visuels intermédiaires dans release/promo).
 * Usage : npm run build && npm run promo      (PROMO_URL=… : adresse affichée en conclusion)
 *         --rendu-seul : réutilise les visuels déjà capturés ; --apercu : une image par scène
 * Prérequis : ffmpeg et pdftoppm (poppler-utils).
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createTempDatabase } from "../e2e/base-temporaire.mjs";
import { authenticator } from "../e2e/totp.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const VIS = path.join(ROOT, "release/promo/visuels");
const OUT = path.join(ROOT, "docs/promo");
const FPS = 30;
const PORT = 19000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PW = "Admin-Initial-2026!";
const executablePath = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;

for (const tool of ["ffmpeg", "pdftoppm"]) {
  try {
    execFileSync(tool, ["-v"], { stdio: "ignore" });
  } catch (e) {
    if (e.code === "ENOENT") throw new Error(`${tool} est requis (paquets ffmpeg et poppler-utils).`);
  }
}
fs.mkdirSync(OUT, { recursive: true });

// ───────────── 1. Visuels réels de l'application ─────────────
async function captureVisuals(browser) {
  fs.rmSync(VIS, { recursive: true, force: true });
  fs.mkdirSync(VIS, { recursive: true });
  const database = await createTempDatabase();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beffroi-promo-"));
  const server = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server/dist/server.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dataDir, DATABASE_URL: database.url, ADMIN_INITIAL_PASSWORD: ADMIN_PW, LOG_LEVEL: "error" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${BASE}/api/health`)).ok) break;
      } catch { /* démarrage en cours */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    // Écran 1440 × 900 en densité 2 : captures nettes même agrandies dans la vidéo.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "fr-FR", timezoneId: "Europe/Paris", acceptDownloads: true });
    const page = await ctx.newPage();
    const quiet = () => page.evaluate(() => document.querySelector(".toasts")?.style.setProperty("display", "none"));
    const shot = async (name, target = page) => {
      await page.waitForTimeout(700);
      await quiet();
      await target.screenshot({ path: path.join(VIS, `${name}.jpg`), type: "jpeg", quality: 90 });
      console.log(`  ${name}.jpg`);
    };
    const login = async (u, p) => {
      await page.goto(`${BASE}/connexion`);
      await page.fill('input[autocomplete="username"]', u);
      await page.fill('input[autocomplete="current-password"]', p);
      await page.click('button[type="submit"]');
    };
    const changePw = async (cur, next) => {
      await page.waitForURL(/mot-de-passe/);
      const i = page.locator('input[type="password"]');
      await i.nth(0).fill(cur);
      await i.nth(1).fill(next);
      await i.nth(2).fill(next);
      await page.click('button[type="submit"]');
    };
    const enroll = async (password) => {
      await page.waitForURL(/securite\/mfa/);
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Continuer")');
      const next = authenticator((await page.locator("code.mono").textContent()).replace(/\s/g, ""));
      await page.fill('input[autocomplete="one-time-code"]', next());
      await page.click('button:has-text("Activer")');
      await page.waitForSelector('[data-testid="recovery-codes"]');
      await page.click('label:has-text("J\'ai conservé ces codes")');
      await page.click('button:has-text("Terminer")');
    };

    await login("admin", ADMIN_PW);
    await changePw(ADMIN_PW, "Veilleur-Tour-Nord-2026");
    await enroll("Veilleur-Tour-Nord-2026");
    await page.click("text=Nouvel utilisateur");
    await page.fill('.drawer input[type="text"] >> nth=0', "rssi");
    await page.fill('.drawer input[type="text"] >> nth=1', "Camille Martin");
    await page.click('.drawer button:has-text("Enregistrer")');
    await page.waitForSelector(".modal .mono");
    const tmp = (await page.textContent(".modal .mono")).trim();
    await page.click('.modal button:has-text("transmis")');
    await page.click("text=Déconnexion");

    await login("rssi", tmp);
    await changePw(tmp, "Horizon-Cloche-7q!");
    await enroll("Horizon-Cloche-7q!");
    await page.click("text=Nouvelle étude");
    await page.fill('.modal input[type="text"] >> nth=0', "BioTech — Recherche et production de vaccins");
    await page.fill('.modal input[type="text"] >> nth=1', "AR-2026-014");
    await page.fill('.modal input[type="text"] >> nth=2', "BioTech SA");
    await page.selectOption(".modal select >> nth=0", "DR");
    await page.click('.modal label:has-text("Exemple du guide")');
    await page.click('.modal button:has-text("Créer")');
    await page.waitForURL(/a1-cadre/);
    const study = page.url().replace(/\/a1-cadre.*/, "");

    /** Recadrage sur un ou plusieurs éléments (réunion de leurs cadres, avec une marge). */
    const crop = async (name, ...locs) => {
      await locs[0].scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await quiet();
      const boxes = await Promise.all(locs.map((l) => l.boundingBox()));
      const x = Math.min(...boxes.map((b) => b.x)) - 12, y = Math.min(...boxes.map((b) => b.y)) - 12;
      const w = Math.max(...boxes.map((b) => b.x + b.width)) + 12 - x, h = Math.max(...boxes.map((b) => b.y + b.height)) + 12 - y;
      await page.screenshot({ path: path.join(VIS, `${name}.jpg`), type: "jpeg", quality: 90, clip: { x, y, width: w, height: h } });
      console.log(`  ${name}.jpg`);
    };
    const card = (text) => page.locator(".card", { hasText: text }).first();

    for (const s of ["vue-ensemble", "a2-carto", "a3-ecosysteme", "a5-residuels", "carte-menace"]) {
      await page.goto(`${study}/${s}`);
      await page.waitForSelector(".section-title h1");
      await shot(s);
    }
    // Visuels recadrés, lisibles une fois intégrés à la vidéo (écran plus haut pour les cartes entières).
    await page.setViewportSize({ width: 1440, height: 1300 });
    await page.goto(`${study}/a2-carto`);
    await page.waitForSelector(".section-title h1");
    await crop("radar-sr-ov", card("Couples retenus uniquement"));
    await page.goto(`${study}/a3-ecosysteme`);
    await page.waitForSelector(".section-title h1");
    await crop("radar-ecosysteme", card("Cartographie de dangerosité initiale"));
    await page.goto(`${study}/a5-residuels`);
    await page.waitForSelector(".section-title h1");
    await crop("matrices", card("Cartographie du risque initial"), card("Cartographie du risque résiduel"));
    await page.goto(`${study}/carte-menace`);
    await page.waitForSelector(".section-title h1");
    await crop("flux-menace", card("Flux de la menace"));
    await page.goto(`${study}/vue-ensemble`);
    await page.waitForSelector(".section-title h1");
    await crop("synthese", page.locator(".section-title").first(), card("Cartographie du risque"));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${study}/a4-scenarios`);
    await page.waitForSelector(".svelte-flow__node");
    await page.click('button:has-text("Plein écran")');
    await page.waitForTimeout(600);
    await page.locator(".svelte-flow__node .ae-node").nth(2).click();
    await shot("a4-graphe");
    await crop("graphe", page.locator(".svelte-flow").first());
    await page.keyboard.press("Escape");

    // Schéma du scénario stratégique, photographié seul sur un écran large.
    await page.setViewportSize({ width: 1840, height: 1150 });
    await page.goto(`${study}/a3-scenarios`);
    await page.waitForSelector(".section-title h1");
    const schema = page.locator(".card", { has: page.locator("h3:has-text('Représentation du scénario')") }).first();
    await schema.scrollIntoViewIfNeeded();
    await shot("schema", schema);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Rapport PDF réellement généré par l'application : quelques pages rendues en images.
    await page.goto(`${study}/exports`);
    await page.waitForSelector(".section-title h1");
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.click('button:has-text("Générer le rapport (.pdf)")')]);
    const pdf = path.join(VIS, "rapport.pdf");
    await download.saveAs(pdf);
    execFileSync("pdftoppm", ["-jpeg", "-jpegopt", "quality=90", "-r", "110", pdf, path.join(VIS, "rapport")]);
    const pages = fs.readdirSync(VIS).filter((f) => /^rapport-\d+\.jpg$/.test(f)).sort();
    console.log(`  rapport PDF : ${pages.length} pages`);
    await ctx.close();
  } finally {
    const exited = new Promise((r) => (server.exitCode !== null ? r() : server.once("exit", r)));
    server.kill("SIGTERM");
    await exited;
    await database.drop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ───────────── 2. Rendu image par image et encodage ─────────────
/** Serveur statique minimal sur le dépôt : la composition charge polices et visuels en HTTP. */
function staticServer() {
  const types = { ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
  const srv = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => srv.listen(0, "127.0.0.1", () => r(srv)));
}

async function renderVideo(browser) {
  if (!fs.existsSync(path.join(VIS, "vue-ensemble.jpg"))) throw new Error("Visuels absents : lancez d'abord le script sans --rendu-seul.");
  const srv = await staticServer();
  try {
    await renderFrames(browser, srv);
  } finally {
    srv.close();
  }
}

async function renderFrames(browser, srv) {
  const url = `http://127.0.0.1:${srv.address().port}/docs/promo/pub.html?visuels=/release/promo/visuels/${process.env.PROMO_URL ? `&url=${encodeURIComponent(process.env.PROMO_URL)}` : ""}`;
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() => window.ready);
  if (errors.length) throw new Error(errors.join("\n"));
  const duration = await page.evaluate(() => window.DURATION);
  if (process.argv.includes("--apercu")) {
    // Une image par scène, une fois ses éléments en place : mise au point rapide de la composition.
    const dir = path.join(ROOT, "release/promo/apercu");
    fs.mkdirSync(dir, { recursive: true });
    const stills = await page.evaluate(() => [...document.querySelectorAll(".scene")].map((s) => Math.min(+s.dataset.end - 0.5, +s.dataset.start + 3.2)));
    for (const [i, t] of stills.entries()) {
      await page.evaluate((x) => window.render(x), t);
      await page.screenshot({ path: path.join(dir, `scene-${String(i + 1).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85 });
    }
    console.log(`  ${stills.length} aperçus dans release/promo/apercu`);
    return;
  }
  const frames = Math.round(duration * FPS);
  const out = path.join(OUT, "beffroi-presentation.mp4");
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((r, j) => ff.on("exit", (c) => (c === 0 ? r() : j(new Error(`ffmpeg : code ${c}`)))));
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % (FPS * 5) === 0) process.stdout.write(`  ${Math.round(f / FPS)} s / ${Math.round(duration)} s\r`);
  }
  ff.stdin.end();
  await done;
  console.log(`\n  ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} Mo, ${duration} s)`);

  // Affiches : conclusion et souveraineté, images fixes 1920 × 1080.
  for (const [t, name] of [[duration - 0.2, "beffroi-affiche"], [42.5, "beffroi-souverainete"]]) {
    await page.evaluate((x) => window.render(x), t);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  docs/promo/${name}.png`);
  }
}

const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  if (!process.argv.includes("--rendu-seul")) {
    console.log("Visuels de l'application");
    await captureVisuals(browser);
  }
  console.log("Rendu de la vidéo");
  await renderVideo(browser);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
