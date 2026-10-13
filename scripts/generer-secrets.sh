#!/bin/sh
# Génère les secrets du déploiement Docker Compose dans ./secrets (à sauvegarder hors de la base).
#   db_admin_password  super-utilisateur PostgreSQL (administration de la base uniquement)
#   db_owner_password  propriétaire du schéma (migrations)
#   db_app_password    rôle applicatif
#   master_key         clé maître de chiffrement des études (32 octets, base64)
# Le dossier est réservé à l'administrateur (0700) ; les fichiers sont lisibles par les comptes
# de service des conteneurs, qui les reçoivent en secrets montés dans /run/secrets.
set -eu
cd "$(dirname "$0")/.."
umask 077
mkdir -p secrets
chmod 700 secrets
for name in db_admin_password db_owner_password db_app_password; do
  [ -s "secrets/$name" ] || openssl rand -base64 32 | tr -d '\n=/+' > "secrets/$name"
done
[ -s secrets/master_key ] || openssl rand -base64 32 | tr -d '\n' > secrets/master_key
chmod 644 secrets/*
echo "Secrets prêts dans ./secrets. Sauvegardez secrets/master_key séparément de la base : sans elle, les études sont illisibles."
