/**
 * Construit l'archive d'installation hors ligne de Beffroi RM :
 *   release/beffroi-<version>.tar.gz (+ .sha256)
 * Contenu : serveur compilé en un seul fichier (aucun node_modules), client web, lanceurs,
 * nomenclature logicielle CycloneDX, licences des composants tiers, sommes de contrôle.
 * Prérequis à l'exécution : Node.js >= 22.13 et une base PostgreSQL >= 14. Aucun accès réseau
 * vers l'extérieur n'est nécessaire.
 * Usage : npm run package
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const name = `beffroi-${version}`;
const releaseDir = path.join(root, "release");
const out = path.join(releaseDir, name);

for (const f of ["server/dist/server.js", "web/dist/index.html"]) {
  if (!fs.existsSync(path.join(root, f))) throw new Error(`${f} introuvable : lancez d'abord « npm run build ».`);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "server"), { recursive: true });

// Même arborescence que le dépôt : server/dist/server.js sert ../../web/dist.
fs.cpSync(path.join(root, "server/dist"), path.join(out, "server/dist"), { recursive: true });
fs.cpSync(path.join(root, "web/dist"), path.join(out, "web/dist"), { recursive: true });
fs.copyFileSync(path.join(root, "LICENSE"), path.join(out, "LICENSE"));
// Fichiers de déploiement (installateur Linux, unités systemd, rôles PostgreSQL,
// reverse proxies) et documentation d'exploitation.
fs.cpSync(path.join(root, "deploy"), path.join(out, "deploy"), { recursive: true });
fs.mkdirSync(path.join(out, "docs"));
for (const f of ["installation.md", "securite.md", "guide-utilisation.md"]) fs.copyFileSync(path.join(root, "docs", f), path.join(out, "docs", f));

// ───── lanceurs ─────
const checkNode =
  "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<13)){console.error('Node.js 22.13 ou plus récent est requis (version installée : '+process.version+').');process.exit(1)}";
fs.writeFileSync(
  path.join(out, "beffroi.sh"),
  `#!/bin/sh
# Lance Beffroi RM (Linux, macOS). Aucune connexion Internet n'est nécessaire.
set -e
cd "$(dirname "$0")"
node -e "${checkNode}"
if [ -z "\${DATABASE_URL:-}" ] && [ -z "\${PGDATABASE:-}" ]; then
  echo "Base PostgreSQL non configurée : définissez DATABASE_URL (voir docs/installation.md, § 4)." >&2
  echo "  export DATABASE_URL=postgres://beffroi_app:MOT_DE_PASSE@localhost/beffroi" >&2
  exit 1
fi
export DATA_DIR="\${DATA_DIR:-$PWD/donnees}"
exec node --disable-warning=ExperimentalWarning server/dist/server.js
`,
  { mode: 0o755 },
);
fs.writeFileSync(
  path.join(out, "beffroi.cmd"),
  `@echo off\r
rem Lance Beffroi RM (Windows). Aucune connexion Internet n'est nécessaire.\r
cd /d "%~dp0"\r
node -e "${checkNode}" || exit /b 1\r
if "%DATABASE_URL%%PGDATABASE%"=="" (\r
  echo Base PostgreSQL non configuree : definissez DATABASE_URL ^(voir docs\\installation.md, paragraphe 4^).\r
  echo   set DATABASE_URL=postgres://beffroi_app:MOT_DE_PASSE@localhost/beffroi\r
  exit /b 1\r
)\r
if "%DATA_DIR%"=="" set "DATA_DIR=%~dp0donnees"\r
node --disable-warning=ExperimentalWarning server\\dist\\server.js\r
`,
);

// ───── nomenclature logicielle (SBOM) et licences tierces ─────
// Sous Windows, « npm » est un script .cmd : il ne se lance que par un shell (sinon spawnSync npm ENOENT).
const sbom = JSON.parse(
  execFileSync("npm", ["sbom", "--omit=dev", "--sbom-format=cyclonedx"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  }),
);
fs.writeFileSync(path.join(out, "sbom.cdx.json"), JSON.stringify(sbom, null, 2));

const PERMISSIVE = new Set(["MIT", "MIT/X11", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "BlueOak-1.0.0", "Unlicense", "CC0-1.0", "OFL-1.1", "Zlib", "Python-2.0", "MIT-0"]);
const licenseOf = (pkg) => {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(" OR ");
  return "";
};
const licenseText = (dir) => {
  const f = fs.readdirSync(dir).find((x) => /^(licen[cs]e|copying)(\.|$)/i.test(x));
  if (f) return fs.readFileSync(path.join(dir, f), "utf8").trim();
  const readme = fs.readdirSync(dir).find((x) => /^readme/i.test(x));
  const m = readme && /#+\s*licen[cs]e[\s\S]*/i.exec(fs.readFileSync(path.join(dir, readme), "utf8"));
  return m ? m[0].slice(0, 3000).trim() : "";
};
const components = sbom.components
  .map((c) => ({ c, dir: c.properties?.find((p) => p.name === "cdx:npm:package:path")?.value }))
  .filter(({ dir }) => dir && dir.startsWith("node_modules/"))
  .map(({ c, dir }) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, dir, "package.json"), "utf8"));
    const text = licenseText(path.join(root, dir));
    // Licence non déclarée dans package.json mais texte MIT fourni.
    const license = licenseOf(pkg) || (/Permission is hereby granted, free of charge/.test(text) ? "MIT" : "non déclarée");
    return { name: c.name, version: c.version, license, text, homepage: pkg.homepage ?? "", dir, main: pkg.main ?? "index.js" };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Fichiers réellement livrés, et composition des deux bundles.
const shippedCode = [path.join(out, "server/dist/server.js"), ...fs.readdirSync(path.join(out, "web/dist/assets")).filter((f) => f.endsWith(".js")).map((f) => path.join(out, "web/dist/assets", f))]
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");
const pkgOf = (p) => [...p.matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g)].pop()?.[1];
const bundled = {
  serveur: [...new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, "server/modules.json"), "utf8")).inputs).map(pkgOf).filter(Boolean))].sort(),
  navigateur: [...new Set(JSON.parse(fs.readFileSync(path.join(root, "web/modules.json"), "utf8")).map(pkgOf).filter(Boolean))].sort(),
};
/** Un paquet est considéré comme absent du livrable si ses chaînes caractéristiques n'y figurent pas. */
const isShipped = (x) => {
  const file = [x.main, `${x.main}.js`, "index.js"].map((m) => path.join(root, x.dir, m)).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  if (!file) return true;
  const literals = [...fs.readFileSync(file, "utf8").matchAll(/(["'])([^"'\\\n]{20,})\1/g)].map((m) => m[2]);
  return !literals.length || literals.some((l) => shippedCode.includes(l));
};
const permissive = (x) => x.license.replace(/[()]/g, "").split(/\s+(?:OR|AND)\s+/).some((l) => PERMISSIVE.has(l.trim()));
for (const x of components) if (!permissive(x) && !isShipped(x)) x.note = "présent dans l'arbre des dépendances mais absent des fichiers livrés (dépendance réservée à Node.js)";
const nonPermissive = components.filter((x) => !permissive(x) && !x.note);
const byLicense = {};
for (const x of components) byLicense[x.license] = (byLicense[x.license] ?? 0) + 1;
fs.writeFileSync(
  path.join(out, "LICENCES-TIERS.txt"),
  [
    `Beffroi RM ${version} — composants tiers inclus dans l'application`,
    "",
    `${components.length} composants open source, embarqués dans server/dist/server.js et web/dist :`,
    ...Object.entries(byLicense).sort((a, b) => b[1] - a[1]).map(([l, n]) => `  ${l.padEnd(28)} ${n}`),
    "",
    "Composition des fichiers livrés (bibliothèques compilées dans chaque bundle ; exceljs et pdfmake",
    "sont eux-mêmes des bundles précompilés qui incluent leurs propres dépendances) :",
    `  serveur (${bundled.serveur.length})    : ${bundled.serveur.join(", ")}`,
    `  navigateur (${bundled.navigateur.length}) : ${bundled.navigateur.join(", ")}`,
    "",
    ...components.map((x) => `${"=".repeat(78)}\n${x.name} ${x.version} — ${x.license}${x.note ? ` — ${x.note}` : ""}${x.homepage ? `\n${x.homepage}` : ""}\n\n${x.text || "(texte de licence non fourni par le paquet)"}\n`),
  ].join("\n"),
);

// ───── notice ─────
fs.writeFileSync(
  path.join(out, "LISEZMOI.txt"),
  `BEFFROI ${version} — analyse de risques numériques selon la méthode EBIOS Risk Manager
${"=".repeat(78)}

INSTALLATION (sans accès Internet) — procédures complètes : docs/installation.md
  Prérequis : Node.js 22.13 ou plus récent et PostgreSQL 14 ou plus récent (paquets de la
  distribution). Aucune autre dépendance : ne lancez pas « npm install ».
  Vérifiez l'intégrité : sha256sum -c ${name}.tar.gz.sha256, puis sha256sum -c SHA256SUMS.

  Serveur Linux (systemd) — recommandé en production :
       sudo ./deploy/linux/installer.sh
     Compte de service dédié, secrets transmis par systemd, unités durcies, rôles PostgreSQL
     au moindre privilège (deploy/postgres/roles.sql). Options : --help.

  Poste d'évaluation (Linux, macOS, Windows) :
       psql -U postgres -v owner_pw=MOT1 -v app_pw=MOT2 -f deploy/postgres/roles.sql
       DATABASE_URL=postgres://beffroi_app:MOT2@localhost/beffroi \\
       DATABASE_MIGRATION_URL=postgres://beffroi_owner:MOT1@localhost/beffroi ./beffroi.sh
     (Windows : « set » de ces deux variables puis beffroi.cmd). L'application écoute sur
     http://127.0.0.1:8080 ; le mot de passe initial du compte « admin » s'affiche au
     premier démarrage.

  Autres modes (Docker Compose, image seule) : docs/installation.md.
  Reverse proxy HTTPS : deploy/nginx, deploy/haproxy.

CONFIGURATION (variables d'environnement ; secrets de préférence en fichiers, suffixe _FILE)
  DATABASE_URL           connexion du rôle applicatif (ou variables PGHOST, PGUSER, PGDATABASE…)
  DATABASE_MIGRATION_URL connexion du rôle propriétaire du schéma (migrations uniquement :
                         « node server/dist/server.js --migrate ») — moindre privilège
  DATABASE_PASSWORD_FILE mot de passe de la base lu dans un fichier
  DATA_DIR               dossier de la clé maître générée (défaut : ./donnees)
  HOST, PORT             adresse et port d'écoute (défaut : 127.0.0.1:8080)
  BEFFROI_MASTER_KEY     clé de chiffrement des études (base64, 32 octets) ; sinon générée
                         dans DATA_DIR/master.key
  TLS_CERT, TLS_KEY      certificat et clé pour servir directement en HTTPS
  MFA_POLICY             second facteur des comptes locaux : required (défaut), admin, optional
  AUDIT_STDOUT           true : copie du journal d'audit (JSON) sur la sortie standard, pour un SIEM
  OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI
                         authentification unique OpenID Connect (Keycloak, LemonLDAP::NG…)
  Liste complète : guide d'utilisation ; configuration de production et rotation de la clé
  maître : dossier de sécurité (docs/guide-utilisation.md et docs/securite.md du dépôt).

SAUVEGARDE
  Sauvegardez la base PostgreSQL (pg_dump) et, séparément, la clé maître : sans elle, les
  études chiffrées sont illisibles.

SOUVERAINETÉ
  - Aucune requête sortante : ni télémétrie, ni mise à jour automatique, ni police, script
    ou service tiers. Le navigateur ne charge que des ressources servies par Beffroi RM
    (politique de sécurité du contenu « default-src 'self' »).
  - Les données restent dans votre base PostgreSQL, chiffrées (AES-256-GCM) avec une clé qui ne quitte
    pas votre infrastructure. Les exports Word, PDF, Excel et JSON sont produits dans le
    navigateur de l'utilisateur.
  - Composants : ${components.length} bibliothèques open source (licences permissives), listées dans
    sbom.cdx.json (CycloneDX) et LICENCES-TIERS.txt.
`,
);

// ───── sommes de contrôle et archive ─────
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(out);
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
fs.writeFileSync(path.join(out, "SHA256SUMS"), files.sort().map((f) => `${sha(fs.readFileSync(f))}  ${path.relative(out, f).split(path.sep).join("/")}`).join("\n") + "\n");

const tarball = path.join(releaseDir, `${name}.tar.gz`);
execFileSync("tar", ["-czf", tarball, "-C", releaseDir, name]);
fs.writeFileSync(`${tarball}.sha256`, `${sha(fs.readFileSync(tarball))}  ${name}.tar.gz\n`);

const size = (fs.statSync(tarball).size / 1024 / 1024).toFixed(1);
console.log(`Archive : release/${name}.tar.gz (${size} Mo)`);
for (const x of components.filter((y) => y.note)) console.log(`Non livré : ${x.name} (${x.license})`);
console.log(`Composants tiers : ${components.length} — ${Object.entries(byLicense).map(([l, n]) => `${l} ${n}`).join(", ")}`);
if (nonPermissive.length) {
  console.warn(`Licences à examiner : ${nonPermissive.map((x) => `${x.name} (${x.license})`).join(", ")}`);
  process.exitCode = 1;
}
