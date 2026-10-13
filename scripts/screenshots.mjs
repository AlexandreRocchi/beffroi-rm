/**
 * Régénère les captures d'écran de la documentation (docs/img) à partir de l'étude exemple de l'ANSSI.
 * Usage : npm run build && npm run docs:screenshots
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createTempDatabase } from "../e2e/base-temporaire.mjs";
import { enrollMfa } from "../e2e/totp.mjs";

const OUT = "docs/img";
const PORT = 19000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beffroi-shots-"));
const ADMIN_PW = "Admin-Initial-2026!";

const database = await createTempDatabase();
const server = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server/dist/server.js"], {
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dataDir, DATABASE_URL: database.url, ADMIN_INITIAL_PASSWORD: ADMIN_PW, LOG_LEVEL: "warn" },
  stdio: ["ignore", "ignore", "inherit"],
});

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
  browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({ viewport: { width: 1400, height: 875 } });
  const shot = async (name) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(`  ${name}.png`);
  };
  const login = async (u, p) => {
    await page.goto(`${BASE}/connexion`);
    await page.fill('input[autocomplete="username"]', u);
    await page.fill('input[autocomplete="current-password"]', p);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);
  };
  const changePw = async (cur, next) => {
    await page.waitForURL(/mot-de-passe/);
    const i = page.locator('input[type="password"]');
    await i.nth(0).fill(cur);
    await i.nth(1).fill(next);
    await i.nth(2).fill(next);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);
  };

  await page.goto(`${BASE}/connexion`);
  await shot("connexion");
  await login("admin", ADMIN_PW);
  await changePw(ADMIN_PW, "Veilleur-Tour-Nord-2026");
  await enrollMfa(page, "Veilleur-Tour-Nord-2026");
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
  await enrollMfa(page, "Horizon-Cloche-7q!");
  await page.click("text=Nouvelle étude");
  await page.fill('.modal input[type="text"] >> nth=0', "BioTech — Recherche et production de vaccins");
  await page.fill('.modal input[type="text"] >> nth=1', "AR-2026-014");
  await page.fill('.modal input[type="text"] >> nth=2', "BioTech SA");
  await page.selectOption(".modal select >> nth=0", "DR");
  await page.click('.modal label:has-text("Exemple du guide")');
  await page.click('.modal button:has-text("Créer")');
  await page.waitForURL(/a1-cadre/);
  const study = page.url().replace(/\/a1-cadre.*/, "");

  for (const [slug, name] of [
    ["vue-ensemble", "vue-ensemble"],
    ["a2-carto", "radar-sr-ov"],
    ["a3-ecosysteme", "radar-ecosysteme"],
    ["a3-scenarios", "scenario-strategique"],
    ["a5-residuels", "risques-residuels"],
    ["a5-traitement", "plan-traitement"],
    ["carte-menace", "carte-menace"],
  ]) {
    await page.goto(`${study}/${slug}`);
    await page.waitForSelector("svg.viz, .viz svg, svg", { timeout: 10000 });
    // Le schéma du scénario stratégique est sous le formulaire et large : écran plus grand, schéma en haut.
    if (slug === "a3-scenarios") {
      await page.setViewportSize({ width: 1840, height: 1150 });
      await page.locator("h3:has-text('Représentation du scénario')").evaluate((el) => el.scrollIntoView({ block: "start" }));
    }
    await shot(name);
    await page.setViewportSize({ width: 1400, height: 875 });
  }

  await page.goto(`${study}/a4-scenarios`);
  await page.waitForSelector(".svelte-flow__node");
  await page.click('button:has-text("Plein écran")');
  await page.waitForTimeout(600);
  await page.locator(".svelte-flow__node .ae-node").nth(2).click();
  await shot("graphe-attaque");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/`);
  await page.waitForSelector(".study-card");
  await shot("portefeuille");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser?.close();
  const exited = new Promise((r) => (server.exitCode !== null ? r() : server.once("exit", r)));
  server.kill("SIGTERM");
  await exited;
  await database.drop();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
