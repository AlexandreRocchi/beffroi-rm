#!/bin/sh
# Installation native de Beffroi RM sur un serveur Linux (systemd), sans conteneur.
# À lancer en root depuis l'archive d'installation extraite (ou depuis le dépôt après « npm run build »).
#
#   sudo ./deploy/linux/installer.sh                          PostgreSQL local (même serveur)
#   sudo ./deploy/linux/installer.sh --db-host bdd.interne \
#        --db-admin-url "postgres://postgres@bdd.interne/postgres"   PostgreSQL distant
#   sudo ./deploy/linux/installer.sh --desinstaller            retire l'application (conserve données et base)
#
# Relancer le script avec une nouvelle archive met l'application à jour : secrets, configuration et
# données sont conservés, le schéma est migré au redémarrage.
#
# Ce que fait le script :
#   - compte système « beffroi » sans shell ni répertoire personnel utilisable ;
#   - application dans --prefix (défaut /opt/beffroi), propriété de root, en lecture seule pour le service ;
#   - secrets générés dans /etc/beffroi/credentials (0600 root), transmis par systemd (LoadCredential) ;
#   - rôles PostgreSQL beffroi_owner (migrations) et beffroi_app (application) — deploy/postgres/roles.sql ;
#   - unités systemd beffroi-migrate (rôle propriétaire) et beffroi (rôle applicatif), durcies.
set -eu

PREFIX=/opt/beffroi
ETC=/etc/beffroi
DB_HOST=127.0.0.1
DB_PORT=5432
DB_ADMIN_URL=""
BIND=127.0.0.1
PORT=8080
START=1
UNINSTALL=0

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'
Options :
  --prefix DOSSIER       dossier d'installation (défaut /opt/beffroi)
  --db-host HÔTE         serveur PostgreSQL (défaut 127.0.0.1)
  --db-port PORT         port PostgreSQL (défaut 5432)
  --db-admin-url URL     connexion super-utilisateur d'un PostgreSQL distant, pour créer les rôles
                         (sinon, pour une base distante, la commande à exécuter est affichée)
  --bind ADRESSE         adresse d'écoute de Beffroi RM (défaut 127.0.0.1, derrière un reverse proxy)
  --port PORT            port d'écoute de Beffroi RM (défaut 8080)
  --sans-demarrage       installe sans activer ni démarrer le service
  --desinstaller         retire l'application et les unités (données, secrets et base conservés)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --db-host) DB_HOST="$2"; shift 2 ;;
    --db-port) DB_PORT="$2"; shift 2 ;;
    --db-admin-url) DB_ADMIN_URL="$2"; shift 2 ;;
    --bind) BIND="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --sans-demarrage) START=0; shift ;;
    --desinstaller) UNINSTALL=1; shift ;;
    -h|--help|--aide) usage; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; usage >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { echo "Erreur : $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "lancez ce script en root (sudo)."
case "$PREFIX" in /*) ;; *) die "--prefix doit être un chemin absolu." ;; esac
[ "$PREFIX" != "/" ] || die "--prefix ne peut pas être la racine."
SYSTEMD=0
[ -d /run/systemd/system ] && SYSTEMD=1

# ─────────── désinstallation ───────────
if [ "$UNINSTALL" -eq 1 ]; then
  say "Désinstallation de Beffroi RM"
  if [ "$SYSTEMD" -eq 1 ]; then
    systemctl disable --now beffroi.service 2>/dev/null || true
    rm -f /etc/systemd/system/beffroi.service /etc/systemd/system/beffroi-migrate.service
    systemctl daemon-reload
  fi
  [ -f "$PREFIX/server/dist/server.js" ] && rm -rf -- "$PREFIX"
  echo "Application retirée. Conservés : $ETC (secrets, configuration), /var/lib/beffroi, la base PostgreSQL « beffroi »."
  echo "Pour tout supprimer : sauvegardez puis supprimez $ETC et /var/lib/beffroi, et « DROP DATABASE beffroi » en super-utilisateur."
  exit 0
fi

# ─────────── prérequis ───────────
SRC=$(cd "$(dirname "$0")/../.." && pwd)
[ -f "$SRC/server/dist/server.js" ] && [ -f "$SRC/web/dist/index.html" ] || die "application non construite dans $SRC (archive d'installation ou « npm run build »)."
NODE=$(command -v node || true)
[ -n "$NODE" ] || die "Node.js 22.13 ou plus récent est requis (paquet de la distribution ou binaire officiel)."
"$NODE" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || die "Node.js 22.13 ou plus récent est requis (installé : $("$NODE" --version))."
LOCAL_DB=0
case "$DB_HOST" in 127.0.0.1|localhost|::1) LOCAL_DB=1 ;; esac
if [ "$LOCAL_DB" -eq 1 ] || [ -n "$DB_ADMIN_URL" ]; then command -v psql >/dev/null || die "psql est requis pour créer les rôles PostgreSQL."; fi

# ─────────── compte système ───────────
say "Compte système « beffroi »"
if ! id beffroi >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /var/lib/beffroi --no-create-home --shell /usr/sbin/nologin --comment "Beffroi RM" beffroi
  echo "créé"
else
  echo "existant"
fi

# ─────────── application ───────────
say "Application dans $PREFIX"
install -d -m 0755 -o root -g root "$PREFIX"
for d in server/dist web/dist deploy docs; do
  [ -e "$SRC/$d" ] || continue
  rm -rf -- "${PREFIX:?}/$d"
  install -d -m 0755 "$PREFIX/$(dirname "$d")"
  cp -R "$SRC/$d" "$PREFIX/$d"
done
for f in LICENSE LISEZMOI.txt LICENCES-TIERS.txt sbom.cdx.json SHA256SUMS; do [ -f "$SRC/$f" ] && cp "$SRC/$f" "$PREFIX/"; done
chown -R root:root "$PREFIX"
chmod -R u=rwX,go=rX "$PREFIX"

# ─────────── secrets ───────────
say "Secrets dans $ETC/credentials"
install -d -m 0750 -o root -g root "$ETC"
install -d -m 0700 -o root -g root "$ETC/credentials"
secret() { # nom, nombre d'octets aléatoires
  f="$ETC/credentials/$1"
  if [ ! -s "$f" ]; then
    (umask 077; "$NODE" -e "process.stdout.write(require('crypto').randomBytes($2).toString('base64').replace(/[=+/]/g, ''))" > "$f")
    echo "$1 : généré"
  else
    echo "$1 : conservé"
  fi
  chmod 0600 "$f"
}
secret db_owner_password 32
secret db_app_password 32
secret admin_initial_password 18
f="$ETC/credentials/master_key"
if [ ! -s "$f" ]; then
  (umask 077; "$NODE" -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" > "$f")
  echo "master_key : générée — À SAUVEGARDER SÉPARÉMENT DE LA BASE"
else
  echo "master_key : conservée"
fi
chmod 0600 "$f"

# ─────────── configuration ───────────
if [ ! -f "$ETC/beffroi.env" ]; then
  cat > "$ETC/beffroi.env" <<EOF
# Configuration de Beffroi RM (aucun secret ici : voir $ETC/credentials).
# Liste complète des variables : $PREFIX/docs/guide-utilisation.md, § 1.5.
HOST=$BIND
PORT=$PORT
DATABASE_URL=postgres://beffroi_app@$DB_HOST:$DB_PORT/beffroi
# Rôle propriétaire : utilisé par la seule unité beffroi-migrate (retiré de l'environnement de l'application).
DATABASE_MIGRATION_URL=postgres://beffroi_owner@$DB_HOST:$DB_PORT/beffroi
# Base distante : chiffrer et authentifier la connexion.
#DATABASE_SSL=verify-full
#DATABASE_SSL_CA_FILE=/etc/beffroi/pg-ca.pem
# Derrière un reverse proxy HTTPS (deploy/nginx, deploy/haproxy).
COOKIE_SECURE=true
TRUST_PROXY=true
# Second facteur exigé pour tous les comptes locaux.
MFA_POLICY=required
# Journal d'audit copié dans journald (journalctl -u beffroi), pour un collecteur ou un SIEM.
AUDIT_STDOUT=true
LOG_LEVEL=info
EOF
  chmod 0640 "$ETC/beffroi.env"
  echo "Configuration écrite : $ETC/beffroi.env"
else
  echo "Configuration existante conservée : $ETC/beffroi.env"
fi

# ─────────── base de données ───────────
say "Rôles et base PostgreSQL"
ROLES="$PREFIX/deploy/postgres/roles.sql"
OWNER_PW=$(cat "$ETC/credentials/db_owner_password")
APP_PW=$(cat "$ETC/credentials/db_app_password")
if [ -n "$DB_ADMIN_URL" ]; then
  psql "$DB_ADMIN_URL" -q -v owner_pw="$OWNER_PW" -v app_pw="$APP_PW" -f "$ROLES"
  echo "Rôles beffroi_owner et beffroi_app prêts sur $DB_HOST."
elif [ "$LOCAL_DB" -eq 1 ]; then
  id postgres >/dev/null 2>&1 || die "PostgreSQL local introuvable (compte « postgres ») : installez-le ou utilisez --db-host / --db-admin-url."
  (cd / && runuser -u postgres -- psql -q -v owner_pw="$OWNER_PW" -v app_pw="$APP_PW" -f "$ROLES")
  echo "Rôles beffroi_owner et beffroi_app prêts (PostgreSQL local)."
else
  echo "Base distante : exécutez en super-utilisateur sur $DB_HOST (mots de passe dans $ETC/credentials) :"
  echo "  psql -v owner_pw=\"\$(cat $ETC/credentials/db_owner_password)\" -v app_pw=\"\$(cat $ETC/credentials/db_app_password)\" -f $ROLES"
fi

# ─────────── service ───────────
say "Service systemd"
for u in beffroi-migrate.service beffroi.service; do
  sed -e "s#@PREFIX@#$PREFIX#g" -e "s#@NODE@#$NODE#g" "$PREFIX/deploy/linux/$u" > "/etc/systemd/system/$u"
  chmod 0644 "/etc/systemd/system/$u"
done
if [ "$SYSTEMD" -eq 1 ]; then
  systemctl daemon-reload
  if [ "$START" -eq 1 ]; then
    systemctl enable beffroi.service >/dev/null
    systemctl restart beffroi.service
    echo "Service démarré : systemctl status beffroi — journal : journalctl -u beffroi"
  else
    echo "Unités installées. Démarrage : systemctl enable --now beffroi"
  fi
else
  echo "systemd n'est pas actif sur ce système : unités copiées dans /etc/systemd/system, démarrage manuel requis."
fi

say "Installation terminée"
cat <<EOF
  Adresse           http://$BIND:$PORT (à publier derrière un reverse proxy HTTPS :
                    exemples dans $PREFIX/deploy/nginx et $PREFIX/deploy/haproxy)
  Administrateur    identifiant « admin », mot de passe initial dans
                    $ETC/credentials/admin_initial_password (à changer à la première connexion)
  Clé maître        $ETC/credentials/master_key — à sauvegarder hors de la sauvegarde de la base
  Mise à jour       relancer ce script depuis la nouvelle archive
EOF
