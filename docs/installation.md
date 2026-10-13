# Installation de Beffroi RM

Beffroi RM est un **serveur d'équipe** : un serveur Node.js (un seul fichier, aucune dépendance npm à
l'exécution), une base PostgreSQL, et les analystes qui se connectent depuis leur navigateur.
Docker n'est **pas** nécessaire : six modes d'installation sont proposés, et tous les modes de
production appliquent les mêmes mesures de sécurité.

## Choisir un mode

| Mode | Pour qui | Prérequis sur le serveur | Fichiers |
|------|----------|--------------------------|----------|
| [1. Linux natif (systemd)](#1-linux-natif-systemd) | Serveur Linux dédié, sans conteneurs | Node.js ≥ 22.13, PostgreSQL ≥ 14 (local ou distant), systemd | `deploy/linux`, `deploy/postgres` |
| [2. Docker Compose](#2-docker-compose) | Serveur avec Docker ou Podman, base incluse | Docker Engine + Compose v2 | `compose.yaml`, `deploy/postgres` |
| [3. Image seule + PostgreSQL existant](#3-image-seule-et-postgresql-existant) | Base déjà exploitée (service interne, instance managée) | Moteur de conteneurs | `Dockerfile`, `deploy/postgres/roles.sql` |
| [4. Kubernetes](#4-kubernetes) | Grappe Kubernetes / OpenShift | Kubernetes ≥ 1.25, PostgreSQL existant | `deploy/kubernetes` |
| [5. Poste d'évaluation (Linux, macOS, Windows)](#5-poste-dévaluation-linux-macos-windows) | Essai, démonstration, formation | Node.js ≥ 22.13, PostgreSQL ≥ 14 | archive d'installation |
| [6. Depuis les sources](#6-depuis-les-sources) | Développement, construction de l'archive | Node.js ≥ 22.13, npm | dépôt |

Utilisation **seule, sans collaboration** : l'exécutable du [mode poste seul](poste-seul.md)
(Windows, Linux) se lance sans aucun prérequis ni installation, sans PostgreSQL ni compte.

Quel que soit le mode, l'application **n'a besoin d'aucun accès Internet** et n'émet aucune requête
sortante. Les modes 1, 2, 3 et 4 partagent la même architecture de sécurité :

- **trois rôles PostgreSQL** ([`deploy/postgres/roles.sql`](../deploy/postgres/roles.sql)) :
  le super-utilisateur n'est confié à aucun composant de Beffroi RM ; `beffroi_owner` (propriétaire
  du schéma) ne sert qu'aux migrations ; `beffroi_app` (application) n'a aucun droit sur le schéma
  et ne peut qu'ajouter au journal d'audit ;
- **secrets en fichiers** (variables `*_FILE`), jamais dans l'environnement ni dans la
  configuration : mot de passe de chaque rôle, clé maître, mot de passe initial de l'administrateur ;
- **processus cloisonné** : compte non privilégié, système de fichiers en lecture seule, aucune
  capacité Linux, pas d'élévation de privilèges, ressources bornées ;
- **TLS terminé par un reverse proxy** ([§ 7](#7-reverse-proxy-https)) ; Beffroi RM n'écoute que sur
  l'interface locale ou le réseau interne, avec `COOKIE_SECURE=true` et `TRUST_PROXY=true`.

Au premier démarrage, le compte **admin** est créé. Son mot de passe initial est lu dans
`ADMIN_INITIAL_PASSWORD_FILE` s'il est fourni (il n'est alors jamais recopié dans les journaux),
sinon généré et affiché une seule fois dans la sortie du service. Il doit être changé à la
première connexion, puis le second facteur (TOTP) est enrôlé.

**Clé maître** : elle chiffre les études. Sauvegardez-la **séparément** de la base : sans elle, une
sauvegarde de la base est illisible, et c'est voulu. Rotation : [dossier de sécurité](securite.md).

## 1. Linux natif (systemd)

Installation sans conteneur, sur Debian, Ubuntu, RHEL/Rocky/Alma, SUSE… Le script
[`deploy/linux/installer.sh`](../deploy/linux/installer.sh) s'exécute depuis l'archive
d'installation extraite (ou depuis le dépôt après `npm run build`).

```bash
# Prérequis (exemple Debian 12 / Ubuntu 24.04 ; Node.js 22 : paquet de la distribution ou binaire officiel)
apt install nodejs postgresql

sha256sum -c beffroi-1.0.0.tar.gz.sha256
tar -xzf beffroi-1.0.0.tar.gz && cd beffroi-1.0.0 && sha256sum -c SHA256SUMS

sudo ./deploy/linux/installer.sh            # PostgreSQL local
sudo systemctl status beffroi               # journal : journalctl -u beffroi
```

Ce que fait l'installateur :

| Élément | Emplacement | Protection |
|---------|-------------|------------|
| Application | `/opt/beffroi` (`--prefix`) | propriété de root, lecture seule pour le service |
| Compte de service | `beffroi` | compte système, sans shell ni répertoire personnel |
| Secrets | `/etc/beffroi/credentials` | 0600 root ; transmis au service par `LoadCredential=` de systemd, lisibles du seul service, jamais dans l'environnement |
| Configuration | `/etc/beffroi/beffroi.env` | aucun secret ; conservée lors des mises à jour |
| Rôles PostgreSQL | `beffroi_owner`, `beffroi_app` | créés ou mis à jour par `roles.sql` |
| Unités | `beffroi-migrate.service`, `beffroi.service` | durcies (voir ci-dessous) |

Au démarrage, `beffroi-migrate` applique les migrations avec le seul rôle `beffroi_owner`, puis
`beffroi` démarre avec le seul rôle `beffroi_app`. L'unité applicative retire
`DATABASE_MIGRATION_URL` de son environnement (`UnsetEnvironment=`) : l'application ne connaît
pas le rôle propriétaire.

Les unités appliquent le guide ANSSI de cloisonnement système : `ProtectSystem=strict`,
`PrivateUsers`, `PrivateDevices`, `ProtectKernel*`, `ProtectProc=invisible`, `NoNewPrivileges`,
aucune capacité (`CapabilityBoundingSet=` vide), filtre d'appels système `@system-service` sans
`@privileged`, familles d'adresses limitées à IPv4, IPv6 et Unix, `UMask=0077`, mémoire et
processus bornés. `systemd-analyze security beffroi.service` donne une exposition de **1,2**
(0 = cloisonnement maximal, 10 = aucun). Deux options restent volontairement inactives :
`MemoryDenyWriteExecute` (incompatible avec le compilateur à la volée de Node.js) et le filtrage
IP (`IPAddressAllow=`, fourni en commentaire, à régler selon l'emplacement de la base, du proxy et
du fournisseur OIDC).

**PostgreSQL distant** :

```bash
sudo ./deploy/linux/installer.sh --db-host bdd.interne \
     --db-admin-url "postgres://postgres@bdd.interne/postgres"
```

Sans `--db-admin-url`, l'installateur affiche la commande `psql` à faire exécuter par
l'administrateur de la base. Activez alors TLS vers la base dans `/etc/beffroi/beffroi.env`
(`DATABASE_SSL=verify-full`, `DATABASE_SSL_CA_FILE`).

**Options** : `--prefix`, `--db-host`, `--db-port`, `--db-admin-url`, `--bind` (défaut
`127.0.0.1`), `--port` (défaut `8080`), `--sans-demarrage`.

**Mise à jour** : relancer l'installateur depuis la nouvelle archive. Secrets, configuration et
données sont conservés ; le schéma est migré au redémarrage.

**Désinstallation** : `sudo ./deploy/linux/installer.sh --desinstaller` retire l'application et
les unités, et conserve `/etc/beffroi`, `/var/lib/beffroi` et la base.

## 2. Docker Compose

L'application et sa base PostgreSQL, sur un seul hôte.

```bash
./scripts/generer-secrets.sh       # ./secrets : mots de passe des rôles et clé maître
docker compose up -d --build
docker compose logs beffroi        # mot de passe initial du compte « admin »
```

- La base est initialisée au premier démarrage par `deploy/postgres/roles.sql` ; le conteneur
  éphémère `migrate` utilise `beffroi_owner`, l'application `beffroi_app`.
- Secrets montés dans `/run/secrets` ; base sur un réseau interne sans accès extérieur ;
  conteneurs en lecture seule, sans capacité, `no-new-privileges`, processus et mémoire bornés.
- Images de base paramétrables pour un registre interne : `NODE_IMAGE`, `POSTGRES_IMAGE`.
- Publication sur `127.0.0.1:8080` (`BEFFROI_BIND`, `BEFFROI_PORT`), derrière un reverse proxy
  HTTPS ([§ 7](#7-reverse-proxy-https)).

## 3. Image seule et PostgreSQL existant

Pour une base déjà exploitée (instance managée, grappe PostgreSQL interne) : seule l'image de
Beffroi RM est déployée.

```bash
docker build -t registre.interne/beffroi:1.0.0 .      # --build-arg NODE_IMAGE=… pour un miroir interne

# 1. Rôles, par l'administrateur de la base (une fois ; rejouable) :
psql "postgres://postgres@bdd.interne/postgres" \
     -v owner_pw="$(cat secrets/db_owner_password)" -v app_pw="$(cat secrets/db_app_password)" \
     -f deploy/postgres/roles.sql

# Options de cloisonnement communes :
DURCI="--read-only --tmpfs /tmp:size=64m --cap-drop ALL --security-opt no-new-privileges:true --pids-limit 200 --memory 1g"

# 2. Migrations (rôle propriétaire), à chaque mise à jour de l'image :
docker run --rm $DURCI \
  -v "$PWD/secrets/db_owner_password:/run/secrets/db_owner_password:ro" \
  -e DATABASE_URL=postgres://beffroi_app@bdd.interne:5432/beffroi \
  -e DATABASE_MIGRATION_URL=postgres://beffroi_owner@bdd.interne:5432/beffroi \
  -e DATABASE_MIGRATION_PASSWORD_FILE=/run/secrets/db_owner_password \
  registre.interne/beffroi:1.0.0 node --disable-warning=ExperimentalWarning server/dist/server.js --migrate

# 3. Application (rôle applicatif) :
docker run -d --name beffroi --restart unless-stopped $DURCI --tmpfs /data:size=16m,uid=1000 \
  -p 127.0.0.1:8080:8080 \
  -v "$PWD/secrets/db_app_password:/run/secrets/db_app_password:ro" \
  -v "$PWD/secrets/master_key:/run/secrets/master_key:ro" \
  -e DATABASE_URL=postgres://beffroi_app@bdd.interne:5432/beffroi \
  -e DATABASE_PASSWORD_FILE=/run/secrets/db_app_password \
  -e BEFFROI_MASTER_KEY_FILE=/run/secrets/master_key \
  -e DATABASE_SSL=verify-full -e COOKIE_SECURE=true -e TRUST_PROXY=true -e AUDIT_STDOUT=true \
  registre.interne/beffroi:1.0.0
```

Les fichiers de secrets doivent être lisibles par l'utilisateur de l'image (uid 1000) ;
`scripts/generer-secrets.sh` les prépare. Pour vérifier le certificat de la base, montez la CA et
ajoutez `DATABASE_SSL_CA_FILE`.

## 4. Kubernetes

[`deploy/kubernetes`](../deploy/kubernetes) est une configuration Kustomize, à adapter puis à
appliquer avec `kubectl apply -k`. PostgreSQL est fourni à part (service managé, opérateur
CloudNativePG…), avec les rôles de `roles.sql`.

```bash
# Image dans le registre interne (nom à reporter dans kustomization.yaml, champ images)
docker build -t registre.interne/beffroi:1.0.0 . && docker push registre.interne/beffroi:1.0.0

# Secrets (jamais versionnés) : ./scripts/generer-secrets.sh puis
kubectl create namespace beffroi
kubectl -n beffroi create secret generic beffroi-app \
  --from-file=db_app_password=secrets/db_app_password \
  --from-file=master_key=secrets/master_key \
  --from-file=admin_initial_password=secrets/admin_initial_password
kubectl -n beffroi create secret generic beffroi-migration \
  --from-file=db_owner_password=secrets/db_owner_password

# Adapter configmap.yaml (adresse de la base), networkpolicy.yaml et ingress.yaml (nom d'hôte), puis :
kubectl apply -k deploy/kubernetes
```

Créez `secrets/admin_initial_password` vous-même (par exemple
`openssl rand -base64 18 > secrets/admin_initial_password`) : ainsi le mot de passe initial n'apparaît
pas dans les journaux du pod.

| Mesure | Mise en œuvre |
|--------|---------------|
| Pod Security Standards | espace de noms au profil **restricted** (`enforce`) |
| Moindre privilège base | migrations dans un conteneur d'initialisation, seul à monter le secret `beffroi-migration` ; l'application ne reçoit que `beffroi-app` |
| Conteneurs | utilisateur 1000, `readOnlyRootFilesystem`, `capabilities.drop: [ALL]`, `allowPrivilegeEscalation: false`, seccomp `RuntimeDefault`, limites mémoire |
| API Kubernetes | compte de service sans jeton (`automountServiceAccountToken: false`) |
| Réseau | NetworkPolicy : entrées depuis le seul contrôleur d'entrée ; sorties vers DNS et PostgreSQL uniquement |
| TLS | Ingress (secret `beffroi-tls`) ; réglages TLS ANSSI dans la ConfigMap du contrôleur |

Les migrations prennent un verrou PostgreSQL : plusieurs réplicas peuvent démarrer ensemble. Au-delà
d'un réplica, les limites de débit (connexion, API) s'appliquent par réplica.

> **État de validation** : les manifestes sont validés par `kustomize build` et `kubeconform`
> (schémas Kubernetes 1.30), et les contraintes du pod (uid 1000, lecture seule, sans capacité)
> sont éprouvées avec l'image réelle sous Docker. Ils n'ont pas été déployés sur une grappe réelle
> dans le cadre des tests de Beffroi RM : faites une recette sur votre plateforme.

## 5. Poste d'évaluation (Linux, macOS, Windows)

Pour essayer Beffroi RM sur un poste de travail, sans conteneur ni service système : l'application
tourne dans une fenêtre de terminal, sous le compte de l'utilisateur.

1. Installez **Node.js 22** (installeur officiel ou gestionnaire de paquets) et **PostgreSQL**
   (paquet de la distribution ; sous Windows, installeur PostgreSQL ou
   `winget install PostgreSQL.PostgreSQL.17`).
2. Extrayez l'archive et vérifiez `SHA256SUMS`.
3. Créez les rôles, avec deux mots de passe de votre choix :

   ```bash
   psql -U postgres -v owner_pw=MotDePasseProprietaire -v app_pw=MotDePasseApplication -f deploy/postgres/roles.sql
   ```

4. Lancez Beffroi RM. Au démarrage, les migrations sont appliquées avec le rôle propriétaire, puis
   l'application sert les requêtes avec le rôle applicatif (simplification propre à ce mode : le
   processus connaît les deux mots de passe) :

   ```bash
   # Linux, macOS
   export DATABASE_URL=postgres://beffroi_app:MotDePasseApplication@localhost/beffroi
   export DATABASE_MIGRATION_URL=postgres://beffroi_owner:MotDePasseProprietaire@localhost/beffroi
   ./beffroi.sh
   ```

   ```bat
   rem Windows (invite de commandes)
   set DATABASE_URL=postgres://beffroi_app:MotDePasseApplication@localhost/beffroi
   set DATABASE_MIGRATION_URL=postgres://beffroi_owner:MotDePasseProprietaire@localhost/beffroi
   beffroi.cmd
   ```

5. Ouvrez <http://127.0.0.1:8080> ; le mot de passe initial du compte `admin` s'affiche dans la
   fenêtre du lanceur. La clé maître est créée dans le dossier `donnees` de l'archive. Le second
   facteur est exigé : prévoyez une application TOTP (FreeOTP, Aegis, KeePassXC…), ou lancez avec
   `MFA_POLICY=optional` pour une démonstration.

Ce mode sert en HTTP sur l'interface locale uniquement : ne l'exposez pas sur le réseau. Pour une
équipe, passez à un mode serveur (1 à 4).

## 6. Depuis les sources

Base et rôles comme au [§ 5](#5-poste-dévaluation-linux-macos-windows), puis :

```bash
npm ci
npm run build
export DATABASE_URL=postgres://beffroi_app:MotDePasseApplication@localhost/beffroi
export DATABASE_MIGRATION_URL=postgres://beffroi_owner:MotDePasseProprietaire@localhost/beffroi
npm start
npm run package         # archive d'installation hors ligne dans release/
```

Développement (API avec rechargement et client Vite sur <http://localhost:5173>) :
`DATABASE_URL=… npm run dev`.

## 7. Reverse proxy HTTPS

Beffroi RM n'émet pas de certificat : un reverse proxy termine TLS devant lui. Deux configurations
prêtes à l'emploi, conformes au guide ANSSI sur TLS (TLS 1.2 et 1.3 uniquement, échange de clés
ECDHE, suites AEAD, pas de tickets de session) :

- **Nginx** : [`deploy/nginx/beffroi.conf`](../deploy/nginx/beffroi.conf) — testée avec
  Nginx 1.24 (Ubuntu 24.04), syntaxe également comprise des versions antérieures (Debian 12 : 1.22) ;
- **HAProxy** : [`deploy/haproxy/beffroi.cfg`](../deploy/haproxy/beffroi.cfg) — testée avec
  HAProxy 2.8 (Ubuntu 24.04), directives disponibles depuis la 2.2 (RHEL 9 : 2.4, Debian 12 : 2.6).

Points communs : redirection de HTTP vers HTTPS ; en-tête `X-Forwarded-For` **écrasé** par
l'adresse réelle du client (un en-tête forgé est ignoré, le journal d'audit enregistre la bonne
adresse) ; en-tête `Host` transmis tel quel (Beffroi RM le compare à l'en-tête `Origin`) ; corps
limité à 20 Mo comme l'application. Les en-têtes de sécurité (HSTS, CSP, COOP, COEP…) sont
posés par Beffroi RM lui-même dès que `COOKIE_SECURE=true`. Les lignes IPv6 sont en commentaire :
activez-les si l'hôte utilise IPv6.

Beffroi RM peut aussi servir HTTPS directement (`TLS_CERT`, `TLS_KEY`), par exemple sur un poste
isolé ; le reverse proxy reste recommandé en production (certificats, journalisation, filtrage).

## 8. Vérifier une installation

Le parcours de bout en bout (navigateur réel) s'exécute contre n'importe quelle instance vierge :

```bash
E2E_URL=https://beffroi.exemple.fr E2E_ADMIN_PASSWORD="$(sudo cat /etc/beffroi/credentials/admin_initial_password)" \
  node e2e/smoke.mjs      # E2E_INSECURE_TLS=1 pour un certificat de test
```

Il enrôle l'administrateur et un analyste (mot de passe, second facteur), conduit une étude
complète, vérifie le journal d'audit, les exports et l'absence de toute requête vers un hôte
externe. Il a été rejoué sur l'installation native, derrière Nginx puis HAProxy en HTTPS, et sur
l'image seule avec un PostgreSQL existant ; `npm run test:offline` le rejoue sur l'archive
d'installation, sans aucun accès réseau.
