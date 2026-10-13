/**
 * Construit l'exécutable autonome du mode poste seul (Node.js Single Executable Application) :
 *   release/beffroi-poste-<version>-windows-x64.exe          (sur Windows)
 *   release/beffroi-poste-<version>-linux-x64.tar.gz        (sur Linux)
 *   release/beffroi-poste-<version>-macos-arm64.tar.gz      (sur macOS)
 * + fichier .sha256 de chacun.
 *
 * Le programme (serveur local en un seul fichier) et l'application web sont injectés dans une
 * copie du binaire Node.js qui exécute ce script : l'exécutable produit vise la plate-forme de
 * construction (une construction par système, voir .github/workflows/poste.yml).
 * Usage : npm run poste   (construit aussi le client web)
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const webDist = path.join(root, "web/dist");
const work = path.join(root, "build/poste");
const releaseDir = path.join(root, "release");

if (!fs.existsSync(path.join(webDist, "index.html"))) throw new Error("web/dist introuvable : lancez d'abord « npm run build -w web ».");
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });

// ───── 1. programme en un seul fichier CommonJS (format exigé par Node.js SEA) ─────
const esbuild = require.resolve("esbuild/bin/esbuild", { paths: [path.join(root, "server")] });
execFileSync(
  process.execPath,
  [
    esbuild,
    "server/src/poste.ts",
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--target=node22",
    `--outfile=${path.join(work, "poste.cjs")}`,
    "--alias:@beffroi/shared=./shared/src/index.ts",
    "--external:pg-native",
    "--legal-comments=external",
    "--log-level=warning",
  ],
  { cwd: root, stdio: "inherit" },
);

// ───── 2. ressources : application web ─────
const files = fs
  .readdirSync(webDist, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => path.relative(webDist, path.join(e.parentPath, e.name)).split(path.sep).join("/"))
  .sort();
fs.writeFileSync(path.join(work, "web-manifest.json"), JSON.stringify(files));
const assets = { "web-manifest": path.join(work, "web-manifest.json") };
for (const f of files) assets[`web/${f}`] = path.join(webDist, f);

const blob = path.join(work, "poste.blob");
fs.writeFileSync(
  path.join(work, "sea-config.json"),
  JSON.stringify({ main: path.join(work, "poste.cjs"), output: blob, disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false, assets }, null, 1),
);
execFileSync(process.execPath, ["--experimental-sea-config", path.join(work, "sea-config.json")], { stdio: "inherit" });

// ───── 3. injection dans une copie du binaire Node.js ─────
const platform = { win32: "windows", linux: "linux", darwin: "macos" }[process.platform] ?? process.platform;
const base = `beffroi-poste-${version}-${platform}-${process.arch}`;
const exeName = process.platform === "win32" ? "beffroi-poste.exe" : "beffroi-poste";
const exe = path.join(work, exeName);
fs.copyFileSync(process.execPath, exe);
fs.chmodSync(exe, 0o755);
if (process.platform === "darwin") execFileSync("codesign", ["--remove-signature", exe]);
// La signature Authenticode de node.exe est invalidée par l'injection : on la retire si signtool est présent.
if (process.platform === "win32") {
  try {
    execFileSync("signtool", ["remove", "/s", exe], { stdio: "ignore" });
  } catch {
    /* signtool absent : signature laissée, simplement invalide */
  }
}
const { inject } = require("postject");
await inject(exe, "NODE_SEA_BLOB", fs.readFileSync(blob), {
  sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ...(process.platform === "darwin" ? { machoSegmentName: "NODE_SEA" } : {}),
});
if (process.platform === "darwin") execFileSync("codesign", ["--sign", "-", exe]);

// ───── 4. livrable et somme de contrôle ─────
let out;
if (process.platform === "win32") {
  out = path.join(releaseDir, `${base}.exe`);
  fs.copyFileSync(exe, out);
} else {
  // Archive : conserve le droit d'exécution.
  const dir = path.join(work, base);
  fs.mkdirSync(dir);
  fs.copyFileSync(exe, path.join(dir, exeName));
  fs.chmodSync(path.join(dir, exeName), 0o755);
  fs.copyFileSync(path.join(root, "LICENSE"), path.join(dir, "LICENSE"));
  fs.copyFileSync(path.join(root, "docs/poste-seul.md"), path.join(dir, "LISEZMOI.md"));
  out = path.join(releaseDir, `${base}.tar.gz`);
  execFileSync("tar", ["-czf", out, "-C", work, base]);
}
const sum = crypto.createHash("sha256").update(fs.readFileSync(out)).digest("hex");
fs.writeFileSync(`${out}.sha256`, `${sum}  ${path.basename(out)}\n`);
console.log(`\n${path.relative(root, out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} Mo)\nexécutable : ${path.relative(root, exe)}\nsha256 : ${sum}`);
