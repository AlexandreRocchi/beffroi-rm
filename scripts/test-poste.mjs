/**
 * Test de bout en bout de l'exécutable du mode poste seul, dans un vrai navigateur.
 * Lance l'exécutable sur un dossier de données temporaire, puis : ouverture par le lien à jeton,
 * absence des fonctions de compte et de partage, étude exemple ANSSI, sauvegarde automatique,
 * export JSON, instance unique, persistance après redémarrage, refus sans jeton ou hôte étranger.
 * Usage : npm run poste && npm run test:poste [chemin/de/l'exécutable]
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const exe = path.resolve(process.argv[2] ?? `build/poste/beffroi-poste${process.platform === "win32" ? ".exe" : ""}`);
if (!fs.existsSync(exe)) throw new Error(`${exe} introuvable : lancez d'abord « npm run poste ».`);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beffroi-poste-"));

function assert(cond, msg) {
  if (!cond) throw new Error(`Échec : ${msg}`);
  console.log(`  ✓ ${msg}`);
}

/** Lance l'exécutable et attend l'adresse d'ouverture affichée. */
function launch(extra = []) {
  const child = spawn(exe, ["--sans-navigateur", "--port", "0", "--donnees", dataDir, ...extra], { stdio: ["ignore", "pipe", "inherit"] });
  let out = "";
  const url = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Pas d'adresse affichée :\n${out}`)), 15_000);
    child.stdout.on("data", (b) => {
      out += b;
      const m = /(http:\/\/127\.0\.0\.1:\d+\/ouvrir\?jeton=[\w-]+)/.exec(out);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Arrêt prématuré (${code}) :\n${out}`));
    });
  });
  return { child, url, output: () => out };
}

async function stop(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await exited;
}

const executablePath = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
let browser;
let first = launch();
try {
  const url = await first.url;
  const base = new URL(url).origin;
  console.log(`Exécutable : ${exe}\nAdresse : ${base}`);

  // ───── contrôles d'accès ─────
  assert((await fetch(`${base}/api/studies`)).status === 401, "API refusée sans le jeton d'ouverture");
  assert((await fetch(`${base}/ouvrir?jeton=faux`, { redirect: "manual" })).status === 403, "jeton invalide refusé");
  const rebinding = await new Promise((resolve) => {
    const u = new URL(base);
    import("node:http").then(({ request }) =>
      request({ host: u.hostname, port: u.port, path: "/", headers: { host: "beffroi.attaquant.example" } }, (r) => resolve(r.statusCode)).end(),
    );
  });
  assert(rebinding === 421, "hôte étranger refusé (rebinding DNS)");

  // ───── parcours dans le navigateur ─────
  browser = await chromium.launch(executablePath ? { executablePath } : {}).catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["data:", "blob:"].includes(u.protocol) && u.origin !== base) external.push(r.url());
  });

  await page.goto(url);
  await page.waitForURL(`${base}/`);
  await page.waitForSelector("text=Nouvelle étude");
  assert((await page.locator("text=poste local").count()) === 1, "mode poste seul signalé, sans connexion");
  assert((await page.locator('button:has-text("Déconnexion")').count()) === 0, "aucune déconnexion ni compte");

  await page.click("text=Nouvelle étude");
  await page.fill('.modal input[type="text"] >> nth=0', "BioTech poste");
  await page.selectOption(".modal select >> nth=0", "DR");
  await page.click('.modal label:has-text("Exemple du guide")');
  await page.click('.modal button:has-text("Créer")');
  await page.waitForURL(/a1-cadre/);
  const study = page.url().replace(/\/a1-cadre.*/, "");
  for (const s of ["vue-ensemble", "a3-ecosysteme", "a4-scenarios", "a5-synthese", "carte-menace", "versions", "exports"]) {
    await page.goto(`${study}/${s}`);
    await page.waitForTimeout(500);
  }
  assert(errors.length === 0, `activités affichées sans erreur (${errors.join(" | ") || "aucune"})`);

  await page.goto(`${study}/partage`);
  await page.waitForSelector("text=Propriétés de l'étude");
  assert((await page.locator("h3:has-text('Accès')").count()) === 0, "pas de partage, propriétés seules");
  assert((await page.locator("nav >> text=Partage et droits").count()) === 0, "menu « Propriétés » au lieu du partage");

  await page.goto(`${study}/a1-er`);
  await page.waitForSelector("td.num select");
  await page.locator("td.num select").first().selectOption("4");
  await page.waitForTimeout(2200);
  assert((await page.textContent(".save-state")).includes("Enregistré"), "sauvegarde automatique sur le disque");
  const files = fs.readdirSync(path.join(dataDir, "etudes")).filter((f) => f.endsWith(".json"));
  assert(files.length === 1, "étude enregistrée dans le dossier de données");

  await page.goto(`${study}/exports`);
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.click('button:has-text("Exporter (.json)")')]);
  const exported = path.join(dataDir, "export.json");
  await dl.saveAs(exported);
  assert(fs.statSync(exported).size > 10_000, "export JSON");
  assert(external.length === 0, `aucune requête hors du poste (${external.slice(0, 3).join(", ") || "aucune"})`);

  // ───── instance unique ─────
  const second = spawn(exe, ["--sans-navigateur", "--donnees", dataDir], { stdio: ["ignore", "pipe", "inherit"] });
  let secondOut = "";
  second.stdout.on("data", (b) => (secondOut += b));
  const code = await new Promise((r) => second.once("exit", r));
  assert(code === 0 && secondOut.includes(new URL(url).port), "second lancement : renvoi vers l'instance ouverte");

  // ───── redémarrage : données conservées, ancien lien invalide ─────
  await stop(first.child);
  first = launch();
  const url2 = await first.url;
  const base2 = new URL(url2).origin;
  const fresh = await browser.newContext();
  const p2 = await fresh.newPage();
  await p2.goto(`${base2}/`);
  await p2.waitForSelector("text=n'est plus relié");
  assert(true, "page ouverte sans jeton : invitation à relancer Beffroi RM");
  await p2.goto(url2);
  await p2.waitForSelector("text=BioTech poste");
  assert(true, "étude conservée après redémarrage");
  await p2.goto(`${base2}/etudes/${study.split("/").pop()}/a1-er`);
  await p2.waitForSelector("td.num select");
  assert((await p2.locator("td.num select").first().inputValue()) === "4", "modification conservée après redémarrage");
  console.log("\nMode poste seul : parcours complet réussi.");
} finally {
  await browser?.close();
  await stop(first.child);
  // Sous Windows, kill() termine le processus sans signal : pas de nettoyage à vérifier.
  if (process.platform !== "win32") assert(!fs.existsSync(path.join(dataDir, "instance.json")), "arrêt propre (fichier d'instance supprimé)");
  fs.rmSync(dataDir, { recursive: true, force: true });
}
