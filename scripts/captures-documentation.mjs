/**
 * Régénère les captures d'écran de la documentation intégrée (web/public/captures) en
 * parcourant l'application avec l'étude exemple de l'ANSSI : connexion, second facteur,
 * portefeuille, chacun des cinq ateliers, outils de l'étude, profil et administration.
 * Usage : npm run build && npm run docs:screenshots
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createTempDatabase } from "../e2e/base-temporaire.mjs";
import { authenticator } from "../e2e/totp.mjs";

const OUT = "web/public/captures";
const PORT = 19000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "beffroi-captures-"));
const ADMIN_PW = "Admin-Initial-2026!";
const VIEWPORT = { width: 1280, height: 800 };

fs.mkdirSync(OUT, { recursive: true });
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
  const page = await browser.newPage({ viewport: VIEWPORT, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const shot = async (name, opts = {}) => {
    await page.waitForTimeout(opts.wait ?? 450);
    // Notifications éphémères (« MFA activée »…) masquées par le DOM (la CSP refuse toute feuille injectée).
    await page.evaluate(() => document.querySelector(".toasts")?.style.setProperty("display", "none"));
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 72, ...(opts.clip ? { clip: opts.clip } : {}) });
    console.log(`  ${name}.jpg`);
  };
  const login = async (u, p) => {
    await page.goto(`${BASE}/connexion`);
    await page.fill('input[autocomplete="username"]', u);
    await page.fill('input[autocomplete="current-password"]', p);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);
  };
  const changePw = async (cur, next, name) => {
    await page.waitForURL(/mot-de-passe/);
    const i = page.locator('input[type="password"]');
    await i.nth(0).fill(cur);
    await i.nth(1).fill(next);
    await i.nth(2).fill(next);
    if (name) await shot(name);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(400);
  };
  /** Enrôlement du second facteur, avec captures des étapes si `prefix` est fourni. */
  const enroll = async (password, prefix) => {
    await page.waitForURL(/securite\/mfa/);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Continuer")');
    const secret = (await page.locator("code.mono").textContent()).replace(/\s/g, "");
    const next = authenticator(secret);
    await page.fill('input[autocomplete="one-time-code"]', next());
    if (prefix) await shot(`${prefix}-2`);
    await page.click('button:has-text("Activer")');
    await page.waitForSelector('[data-testid="recovery-codes"]');
    if (prefix) await shot(`${prefix}-3`);
    await page.click('label:has-text("J\'ai conservé ces codes")');
    await page.click('button:has-text("Terminer")');
    await page.waitForTimeout(400);
    return next;
  };

  // ───── administrateur : premier démarrage, comptes, journal ─────
  await page.goto(`${BASE}/connexion`);
  await page.fill('input[autocomplete="username"]', "admin");
  await page.fill('input[autocomplete="current-password"]', "••••••••••••");
  await shot("connexion");
  await login("admin", ADMIN_PW);
  await changePw(ADMIN_PW, "Veilleur-Tour-Nord-2026", "mot-de-passe-initial");
  const adminCode = await enroll("Veilleur-Tour-Nord-2026", "mfa");
  await page.waitForSelector("text=Nouvel utilisateur");
  await page.click("text=Nouvel utilisateur");
  await page.fill('.drawer input[type="text"] >> nth=0', "rssi");
  await page.fill('.drawer input[type="text"] >> nth=1', "Camille Martin");
  await shot("admin-nouvel-utilisateur");
  await page.click('.drawer button:has-text("Enregistrer")');
  await page.waitForSelector(".modal .mono");
  await shot("admin-mot-de-passe-temporaire");
  const tmp = (await page.textContent(".modal .mono")).trim();
  await page.click('.modal button:has-text("transmis")');
  for (const [u, n] of [["dpo", "Dominique Petit"], ["archi", "Alex Bernard"]]) {
    await page.click("text=Nouvel utilisateur");
    await page.fill('.drawer input[type="text"] >> nth=0', u);
    await page.fill('.drawer input[type="text"] >> nth=1', n);
    await page.click('.drawer button:has-text("Enregistrer")');
    await page.waitForSelector(".modal .mono");
    await page.click('.modal button:has-text("transmis")');
  }
  await page.waitForTimeout(300);
  await shot("admin-utilisateurs");
  await page.click("text=Déconnexion");

  // ───── analyste : portefeuille et étude exemple ─────
  await login("rssi", tmp);
  await changePw(tmp, "Horizon-Cloche-7q!");
  await enroll("Horizon-Cloche-7q!");
  await page.waitForSelector("text=Nouvelle étude");
  await page.click("text=Nouvelle étude");
  await page.fill('.modal input[type="text"] >> nth=0', "BioTech — Recherche et production de vaccins");
  await page.fill('.modal input[type="text"] >> nth=1', "AR-2026-014");
  await page.fill('.modal input[type="text"] >> nth=2', "BioTech SA");
  await page.selectOption(".modal select >> nth=0", "DR");
  await page.click('.modal label:has-text("Exemple du guide")');
  await shot("nouvelle-etude");
  await page.click('.modal button:has-text("Créer")');
  await page.waitForURL(/a1-cadre/);
  const study = page.url().replace(/\/a1-cadre.*/, "");

  const sections = [
    "vue-ensemble", "a1-cadre", "a1-perimetre", "a1-er", "a1-socle", "a2-couples", "a2-carto",
    "a3-ecosysteme", "a3-scenarios", "a3-mesures", "a4-scenarios", "a5-synthese", "a5-traitement",
    "a5-residuels", "a5-suivi", "carte-menace", "parametres", "versions", "exports",
  ];
  for (const s of sections) {
    await page.goto(`${study}/${s}`);
    await page.waitForSelector(".section-title h1", { timeout: 10000 });
    await shot(s, { wait: 800 });
  }

  // Détails : fiche d'un événement redouté, schéma d'un scénario stratégique, graphe d'attaque, aide.
  await page.goto(`${study}/a1-er`);
  await page.waitForSelector(".section-title h1");
  await page.locator("tr.clickable").first().click();
  await page.waitForSelector(".drawer");
  await shot("a1-er-fiche", { wait: 600 });
  await page.keyboard.press("Escape");

  // Schéma du scénario stratégique : large, photographié seul sur un écran plus grand.
  await page.setViewportSize({ width: 1840, height: 1150 });
  await page.goto(`${study}/a3-scenarios`);
  await page.waitForSelector(".section-title h1");
  const schema = page.locator(".card", { has: page.locator("h3:has-text('Représentation du scénario')") }).first();
  await schema.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector(".toasts")?.style.setProperty("display", "none"));
  await schema.screenshot({ path: path.join(OUT, "a3-scenarios-schema.jpg"), type: "jpeg", quality: 72 });
  console.log("  a3-scenarios-schema.jpg");
  await page.setViewportSize(VIEWPORT);

  // Graphe d'attaque en plein écran, une action élémentaire sélectionnée.
  await page.goto(`${study}/a4-scenarios`);
  await page.waitForSelector(".svelte-flow__node");
  await page.click('button:has-text("Plein écran")');
  await page.waitForTimeout(600);
  await page.locator(".svelte-flow__node .ae-node").nth(2).click();
  await shot("a4-graphe", { wait: 700 });
  await page.keyboard.press("Escape");

  // Partage : accès en lecture donné à un collègue.
  await page.goto(`${study}/partage`);
  await page.waitForSelector(".section-title h1");
  await page.click(".combo input");
  await page.fill(".combo input", "Dominique");
  await page.locator(".combo-item", { hasText: "Dominique" }).first().dispatchEvent("mousedown");
  await page.click('button:has-text("Donner l\'accès en lecture")');
  await shot("partage", { wait: 600 });

  await page.goto(`${study}/a2-couples`);
  await page.waitForSelector(".section-title h1");
  const helpBtn = page.locator('button[aria-label="Aide méthodologique"]');
  if (!(await page.locator(".help-panel").count())) await helpBtn.click();
  await shot("aide-methodologique", { wait: 600 });

  await page.goto(`${BASE}/`);
  await page.waitForSelector(".study-card");
  await shot("portefeuille");
  await page.goto(`${BASE}/profil`);
  await page.waitForSelector("h1");
  await shot("profil", { wait: 700 });
  await page.click("text=Déconnexion");

  await login("admin", "Veilleur-Tour-Nord-2026");
  await page.fill('input[autocomplete="one-time-code"]', adminCode());
  await shot("connexion-second-facteur");
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/);
  await page.goto(`${BASE}/admin/journal`);
  await page.click('button:has-text("Vérifier l\'intégrité")');
  await page.waitForSelector(".callout.success");
  await shot("admin-journal");

  // Page de documentation elle-même, pour le README.
  await page.setViewportSize({ width: 1400, height: 875 });
  await page.goto(`${BASE}/documentation/atelier-3`);
  await page.waitForSelector(".doc-main img");
  await page.waitForTimeout(800);
  await page.screenshot({ path: "docs/img/documentation.png" });
  console.log("  docs/img/documentation.png");
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
