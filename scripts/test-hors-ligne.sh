#!/bin/sh
# Vérifie que l'archive d'installation fonctionne sans aucun accès réseau (Linux) :
# extraction dans un dossier vide (sans node_modules), contrôle des sommes SHA-256, puis
# parcours de bout en bout dans un espace de noms réseau isolé où seule l'interface locale existe.
# Usage : npm run test:offline
set -e
cd "$(dirname "$0")/.."
V=$(node -p "require('./package.json').version")
T=$(mktemp -d)
[ -n "$T" ] && [ -d "$T" ] || { echo "Dossier temporaire indisponible." >&2; exit 1; }
trap 'rm -rf -- "$T"' EXIT
tar -xzf "release/beffroi-$V.tar.gz" -C "$T"
(cd "$T/beffroi-$V" && sha256sum -c --quiet SHA256SUMS)
echo "Archive intègre ; lancement sans réseau."
unshare -rn sh -c "python3 scripts/lo-up.py \
  && ! node -e \"fetch('https://example.org').then(() => process.exit(0), () => process.exit(1))\" \
  && echo 'Internet inaccessible : OK' \
  && E2E_SERVER='$T/beffroi-$V/server/dist/server.js' node e2e/smoke.mjs"
