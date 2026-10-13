/**
 * Test de bout en bout dans un vrai navigateur (Playwright/Chromium).
 * Démarre le serveur compilé sur une base temporaire, puis :
 * administrateur → création d'un analyste → étude exemple ANSSI → visite de toutes les activités
 * → modification/annulation → réévaluation résiduelle par glisser-déposer → exports.
 * Usage : npm run build && npm run test:e2e   (SCREENSHOTS=dossier pour conserver les captures,
 *         E2E_SERVER=chemin/server/dist/server.js pour tester une archive d'installation extraite,
 *         E2E_URL=https://beffroi.exemple.fr E2E_ADMIN_PASSWORD=… pour tester une instance déjà déployée
 *         et encore vierge : installation native, Docker, derrière un reverse proxy)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createTempDatabase } from "./base-temporaire.mjs";
import { enrollMfa } from "./totp.mjs";

const PORT = 18000 + Math.floor(Math.random() * 1000);
const REMOTE = process.env.E2E_URL?.replace(/\/$/, "");
const BASE = REMOTE ?? `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beffroi-e2e-"));
const shots = process.env.SCREENSHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const ADMIN_PW = REMOTE ? process.env.E2E_ADMIN_PASSWORD : "Admin-Initial-2026!";
if (REMOTE && !ADMIN_PW) throw new Error("E2E_ADMIN_PASSWORD est requis avec E2E_URL.");

// E2E_SERVER : serveur à tester (par défaut celui du dépôt ; sinon celui d'une archive d'installation extraite).
// E2E_URL : instance déjà démarrée, rien n'est lancé ni supprimé.
let cleanup = async () => fs.rmSync(dataDir, { recursive: true, force: true });
if (!REMOTE) {
  const database = await createTempDatabase();
  const server = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", process.env.E2E_SERVER ?? "server/dist/server.js"], {
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dataDir, DATABASE_URL: database.url, ADMIN_INITIAL_PASSWORD: ADMIN_PW, LOG_LEVEL: "warn" },
    stdio: "inherit",
  });
  cleanup = async () => {
    const exited = new Promise((r) => (server.exitCode !== null ? r() : server.once("exit", r)));
    server.kill("SIGTERM");
    await exited;
    await database.drop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Échec : ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch { /* démarrage en cours */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Le serveur n'a pas démarré.");
}

const executablePath = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
let browser;
try {
  await waitForServer();
  browser = await chromium.launch(executablePath ? { executablePath } : {}).catch(() => chromium.launch());
  // E2E_INSECURE_TLS : certificat auto-signé d'un reverse proxy de test.
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, ignoreHTTPSErrors: !!process.env.E2E_INSECURE_TLS });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  // Souveraineté : aucune requête ne doit quitter le serveur local (polices, scripts, images, API).
  const external = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["data:", "blob:"].includes(u.protocol) && u.host !== new URL(BASE).host) external.push(r.url());
  });
  const shot = async (name) => shots && page.screenshot({ path: path.join(shots, `${name}.png`) });

  const login = async (u, p) => {
    await page.goto(`${BASE}/connexion`);
    await page.fill('input[autocomplete="username"]', u);
    await page.fill('input[autocomplete="current-password"]', p);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
  };
  const changePw = async (cur, next) => {
    await page.waitForURL(/mot-de-passe/);
    const i = page.locator('input[type="password"]');
    await i.nth(0).fill(cur);
    await i.nth(1).fill(next);
    await i.nth(2).fill(next);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);
  };

  console.log("Administration");
  await page.goto(`${BASE}/connexion`);
  await page.waitForTimeout(400);
  await shot("connexion");
  await login("admin", ADMIN_PW);
  await changePw(ADMIN_PW, "Veilleur-Tour-Nord-2026");
  await enrollMfa(page, "Veilleur-Tour-Nord-2026");
  assert(page.url().endsWith("/admin"), "second facteur de l'administrateur enrôlé");
  await page.click("text=Nouvel utilisateur");
  await page.fill('.drawer input[type="text"] >> nth=0', "rssi");
  await page.fill('.drawer input[type="text"] >> nth=1', "Camille Martin");
  await page.click('.drawer button:has-text("Enregistrer")');
  await page.waitForSelector(".modal .mono");
  const tmp = (await page.textContent(".modal .mono")).trim();
  assert(tmp.length >= 12, "mot de passe temporaire généré");
  await page.click('.modal button:has-text("transmis")');
  await page.goto(`${BASE}/admin/journal`);
  await page.click('button:has-text("Vérifier l\'intégrité")');
  await page.waitForSelector(".callout.success");
  assert(true, "journal d'audit intègre");
  await page.click("text=Déconnexion");

  console.log("Analyste");
  await login("rssi", tmp);
  await changePw(tmp, "Horizon-Cloche-7q!");
  const rssi = await enrollMfa(page, "Horizon-Cloche-7q!");
  assert(rssi.codes.length === 10, "codes de secours remis une seule fois");
  // Déconnexion effective côté serveur : le cookie capturé avant ne donne plus accès.
  const sid = (await ctx.cookies()).find((c) => c.name.endsWith("beffroi_sid"));
  await page.click("text=Déconnexion");
  await page.waitForURL(/connexion/);
  const replay = await fetch(`${BASE}/api/studies`, { headers: { cookie: `${sid.name}=${sid.value}` } });
  assert(replay.status === 401, "session détruite côté serveur à la déconnexion");
  // Connexion en deux étapes : mot de passe puis code à usage unique.
  await login("rssi", "Horizon-Cloche-7q!");
  await page.waitForSelector('input[autocomplete="one-time-code"]');
  const errorsBefore = errors.length;
  await page.fill('input[autocomplete="one-time-code"]', "000000");
  await page.click('button:has-text("Valider")');
  await page.waitForSelector(".callout.danger");
  // Seule erreur attendue : le refus (401) du code volontairement faux, journalisé par le navigateur.
  const expected = errors.splice(errorsBefore);
  assert(expected.length === 1 && expected[0].includes("401"), "code faux refusé par le serveur");
  await page.fill('input[autocomplete="one-time-code"]', rssi.next());
  await page.click('button:has-text("Valider")');
  await page.waitForURL(`${BASE}/`);
  assert(true, "connexion avec second facteur (code faux refusé)");
  await page.click("text=Nouvelle étude");
  await page.fill('.modal input[type="text"] >> nth=0', "BioTech");
  await page.selectOption(".modal select >> nth=0", "DR");
  await page.click('.modal label:has-text("Exemple du guide")');
  await page.click('.modal button:has-text("Créer")');
  await page.waitForURL(/a1-cadre/);
  const study = page.url().replace(/\/a1-cadre.*/, "");
  assert((await page.textContent(".protection-banner")).includes("Diffusion Restreinte"), "mention de protection affichée");

  for (const s of ["vue-ensemble", "a1-cadre", "a1-perimetre", "a1-er", "a1-socle", "a2-couples", "a2-carto", "a3-ecosysteme", "a3-scenarios", "a3-mesures", "a4-scenarios", "a5-synthese", "a5-traitement", "a5-residuels", "a5-suivi", "carte-menace", "parametres", "versions", "partage", "exports"]) {
    await page.goto(`${study}/${s}`);
    await page.waitForTimeout(600);
    await shot(s);
  }
  assert(errors.length === 0, `toutes les activités s'affichent sans erreur (${errors.join(" | ") || "aucune"})`);

  await page.goto(`${study}/a5-synthese`);
  await page.waitForSelector("svg[aria-label='Cartographie du risque initial'] g[transform] text");
  const levels = await page.locator("svg[aria-label='Cartographie du risque initial'] g[transform] text").allTextContents();
  assert(["R1", "R2", "R3", "R4", "R5"].every((r) => levels.includes(r)), "cartographie du risque initial complète");

  await page.goto(`${study}/a1-er`);
  await page.waitForSelector("td.num select");
  await page.locator("td.num select").first().selectOption("4");
  await page.waitForTimeout(2200);
  assert((await page.textContent(".save-state")).includes("Enregistré"), "sauvegarde automatique");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(2200);
  assert((await page.locator("td.num select").first().inputValue()) === "3", "annulation (Ctrl+Z)");

  await page.goto(`${study}/a5-residuels`);
  await page.waitForSelector("svg[aria-label='Cartographie du risque résiduel'] g[transform] text");
  const resid = page.locator("svg[aria-label='Cartographie du risque résiduel']");
  const chip = await resid.locator("g[transform] >> text=R3").first().boundingBox();
  const box = await resid.boundingBox();
  await page.mouse.move(chip.x + chip.width / 2, chip.y + chip.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.75, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  assert((await page.locator("tbody tr:has-text('R3') select").nth(1).inputValue()) === "2", "réévaluation résiduelle par glisser-déposer");

  await page.goto(`${study}/exports`);
  for (const [label, ext] of [["Exporter (.xlsx)", "xlsx"], ["Générer le rapport (.docx)", "docx"], ["Générer le rapport (.pdf)", "pdf"], ["Exporter (.json)", "json"]]) {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.click(`button:has-text("${label}")`)]);
    const file = path.join(dataDir, `export.${ext}`);
    await dl.saveAs(file);
    assert(fs.statSync(file).size > 10_000, `export ${ext} généré`);
  }
  const pdf = fs.readFileSync(path.join(dataDir, "export.pdf")).toString("latin1");
  const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  assert(pdf.startsWith("%PDF-") && pages >= 15, `rapport PDF valide (${pages} pages)`);
  assert(/IBMPlexSans/.test(pdf) && (pdf.match(/\/Subtype\s*\/Image/g) ?? []).length >= 10, "police et visuels embarqués dans le PDF");
  await page.goto(`${BASE}/`);
  await page.click('button:has-text("Importer")');
  await page.setInputFiles('.modal input[type="file"]', "docs/sources/EBIOS_RM_Ateliers_modele.xlsx");
  await page.waitForSelector('[data-testid="import-report"]');
  assert((await page.textContent('[data-testid="import-report"]')).includes("3 chemins d'attaque"), "import du modèle Excel ANSSI analysé");
  await page.selectOption(".modal select >> nth=0", "NP");
  await page.click('.modal button:has-text("Importer")');
  await page.waitForURL(/vue-ensemble/);
  await page.goto(page.url().replace(/vue-ensemble.*/, "a5-synthese"));
  await page.waitForSelector("svg[aria-label='Cartographie du risque initial'] g[transform] text");
  const imported = await page.locator("svg[aria-label='Cartographie du risque initial'] g[transform] text").allTextContents();
  assert(["R1", "R2", "R3"].every((r) => imported.includes(r)), "risques du modèle ANSSI cartographiés");

  console.log("Documentation");
  // Aide contextuelle : depuis une page d'étude, le tutoriel illustré du bon atelier.
  await page.goto(`${study}/a2-couples`);
  if (!(await page.locator(".help-panel").count())) await page.click('button[aria-label="Aide méthodologique"]');
  await page.click('.help-panel a:has-text("Tutoriel illustré")');
  await page.waitForURL(/\/documentation\/atelier-2$/);
  await page.waitForSelector(".doc-main h1:has-text('Atelier 2')");
  const loaded = await page.$$eval(".doc-main img", (imgs) => Promise.all(imgs.map((i) => (i.loading = "eager", i.decode().then(() => i.naturalWidth > 0, () => false)))));
  assert(loaded.length >= 2 && loaded.every(Boolean), `tutoriel illustré ouvert depuis l'aide (${loaded.length} captures)`);
  await page.fill(".doc-search input", "graphe d'attaque");
  assert((await page.locator(".doc-toc a").allTextContents()).some((t) => t.includes("Atelier 4")), "recherche dans la documentation");
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(600);
  await shot("portefeuille");
  assert(errors.length === 0, "aucune erreur dans la console");
  assert(external.length === 0, `aucune requête vers un hôte externe (${external.slice(0, 3).join(", ") || "aucune"})`);
  console.log("\nTest de bout en bout réussi.");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await cleanup();
}
