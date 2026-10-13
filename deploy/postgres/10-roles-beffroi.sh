#!/bin/sh
# Initialisation du conteneur PostgreSQL (premier démarrage) : rôles et base au moindre privilège,
# définis dans roles.sql (commun avec l'installation native). Le super-utilisateur « postgres »
# n'est communiqué à aucun conteneur applicatif.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v owner_pw="$(cat /run/secrets/db_owner_password)" -v app_pw="$(cat /run/secrets/db_app_password)" \
  -f /opt/beffroi/roles.sql
