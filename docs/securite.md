# Dossier de sécurité — Beffroi RM 1.1

Ce dossier décrit la sécurité de Beffroi RM « par conception » : les menaces retenues, les mesures
qui y répondent (et où elles se trouvent dans le code), la configuration de production, la
procédure de rotation de clé et les risques résiduels. Il sert de base au dossier d'homologation
de l'instance déployée.

> Beffroi RM n'est pas, à ce jour, une solution labellisée ou qualifiée par l'ANSSI. Ce dossier
> ne remplace pas l'homologation de l'instance par l'autorité responsable.

## 1. Biens à protéger et menaces

Une analyse de risques décrit les vulnérabilités, les scénarios d'attaque et les mesures prévues
d'une organisation : c'est une information sensible, souvent protégée (Diffusion Restreinte).

| Bien | Besoin |
|---|---|
| Contenu des analyses (ateliers, scénarios, mesures) | confidentialité, intégrité |
| Métadonnées des analyses (nom, référence, organisation, motifs de version) | confidentialité |
| Comptes, secrets d'authentification (mots de passe, second facteur) | confidentialité, intégrité |
| Journal d'audit | intégrité, disponibilité (imputabilité) |
| Clé maître | confidentialité |

| Source de menace | Exemples de scénarios |
|---|---|
| Attaquant externe | devinette ou réutilisation de mot de passe, hameçonnage, vol de session, CSRF, injection de contenu, déni de service |
| Utilisateur habilité malveillant ou curieux | accès à une analyse sans besoin d'en connaître, élévation de droits, altération du journal |
| Administrateur de l'application | lecture des analyses (qu'il ne doit pas voir) |
| Accès à la base ou à ses sauvegardes (exploitant, sauvegarde volée, injection SQL) | lecture des analyses, attaque hors ligne des mots de passe, réécriture du journal |
| Poste de travail partagé ou compromis | réutilisation d'une session ouverte, données laissées dans le navigateur |

## 2. Mesures

### 2.1 Authentification

| Mesure | Détail | Code | Test |
|---|---|---|---|
| Authentification multifacteur | TOTP (RFC 6238) exigé par défaut pour tous les comptes locaux (`MFA_POLICY=required`) ; enrôlement imposé avant tout accès ; secret chiffré en base ; anti-rejeu (un code consommé ne sert plus) ; 10 codes de secours à usage unique, conservés sous forme d'empreintes HMAC | `server/src/mfa.ts`, `routes/auth.ts` | `api.test.ts` « authentification multifacteur », `security.test.ts` « TOTP » |
| Authentification unique | OpenID Connect (code + PKCE, `state`, `nonce`) ; niveau d'authentification exigé (`OIDC_ACR_VALUES`) vérifié dans le jeton d'identité | `oidc.ts` | `oidc.test.ts` |
| Empreintes de mots de passe | scrypt N = 2^17, r = 8 (128 Mio par calcul) sur un HMAC du mot de passe avec une sous-clé secrète (poivre) : une copie de la base seule ne permet pas d'attaque hors ligne ; recalcul transparent à la connexion des empreintes liées à une clé précédente ; les empreintes de l'ancien format (sans poivre) sont refusées par défaut et ne sont acceptées que pendant une migration (`ALLOW_LEGACY_PASSWORD_HASHES=true`, à retirer ensuite) | `crypto.ts` | `security.test.ts` « mots de passe » |
| Politique de mot de passe | ≥ 12 caractères, trois types ; refus des mots courants (y compris déguisés : « P@ssw0rd-2026 »), de l'identité de l'utilisateur, des suites et répétitions, et des 5 derniers mots de passe | `crypto.ts` | `api.test.ts` |
| Anti-énumération | même réponse et même durée pour un compte inconnu, désactivé, sans mot de passe local ou mauvais mot de passe ; le verrouillage n'est signalé qu'à qui connaît le mot de passe | `routes/auth.ts` | `api.test.ts` |
| Résistance à la force brute | verrouillage du compte après 5 échecs (mot de passe ou second facteur), 20 tentatives par minute et par adresse IP | `routes/auth.ts` | `api.test.ts`, `security.test.ts` |
| Ré-authentification | mot de passe (et code) exigés pour enrôler, régénérer les codes de secours ou désactiver le second facteur | `routes/auth.ts` | `api.test.ts` |
| Information de l'utilisateur | date de la connexion précédente et nombre d'échecs depuis, affichés à la connexion | `routes/auth.ts`, `lib/auth.svelte.ts` | `api.test.ts` |
| Compte administrateur | distinct, sans accès aux analyses, toujours local (accès de secours), second facteur exigé | `auth.ts` | `api.test.ts` |

### 2.2 Sessions

- Jeton aléatoire de 256 bits ; seule son empreinte SHA-256 est en base.
- Cookie `__Host-beffroi_sid` en HTTPS : `HttpOnly`, `Secure`, `SameSite=Strict`, sans domaine.
- Expiration après 30 minutes d'inactivité (**15 minutes pour l'administrateur**) et au plus 12 heures.
- Nouvelle session à chaque authentification et à l'activation du second facteur (élévation) ;
  toutes les sessions fermées au changement de mot de passe, à la réinitialisation, à la
  désactivation du compte ou du second facteur.
- Une session ouverte sans second facteur est refusée pour un compte qui en possède un.
- L'utilisateur voit ses sessions (appareil, adresse IP, dates) et peut les fermer ; la
  déconnexion détruit la session côté serveur et efface les données locales du navigateur.

### 2.3 Contrôle d'accès

- Besoin d'en connaître : une analyse n'est visible que des utilisateurs et groupes listés dans
  ses droits (lecture, écriture, propriétaire) ; une analyse inaccessible répond comme une
  analyse inexistante (404).
- L'administrateur gère comptes, groupes et journal, sans jamais accéder aux analyses ; le
  **nom des analyses n'apparaît pas dans le journal** qu'il consulte.
- Contrôles côté serveur à chaque requête ; tout refus d'accès à une ressource (403/404) par un
  utilisateur connecté, ainsi que les échecs d'authentification, est journalisé.

### 2.4 Protection des données

| Mesure | Détail |
|---|---|
| Chiffrement au repos | AES-256-GCM de chaque version d'analyse, des métadonnées (nom, référence, organisation, motif de version) et des secrets MFA |
| Liaison à l'enregistrement | les données associées (AAD) désignent l'usage et la ligne : un chiffré ne peut pas être déplacé d'une analyse à une autre |
| Séparation des clés | une sous-clé par usage (données, métadonnées, MFA, journal, poivre, codes de secours), dérivée de la clé maître par HKDF-SHA256 ; la clé maître ne chiffre rien directement |
| Rotation | chaque chiffré porte l'identifiant de sa clé ; au démarrage, tout ce qui l'a été avec une clé précédente est rechiffré avec la clé courante (§ 4) |
| Secrets hors environnement | clé maître, mots de passe de base et secret OIDC lus dans des fichiers (`*_FILE` : `LoadCredential` systemd, secrets Docker) |
| Exports | générés dans le navigateur ; mention de protection sur chaque livrable ; neutralisation de l'injection de formules dans les CSV |
| Minimisation | aucune donnée d'analyse dans les journaux techniques ; aucun cache navigateur ou proxy pour l'API (`Cache-Control: no-store`) |

### 2.5 Base de données

- **Moindre privilège** : le rôle propriétaire du schéma n'est utilisé que pour les migrations
  (`server.js --migrate` : unité `beffroi-migrate`, conteneur `migrate`) ; l'application se
  connecte avec un rôle qui lit et écrit les données métier, ajoute au journal, et ne peut ni
  modifier le schéma ni altérer le journal. Au démarrage, l'application signale un rôle super-utilisateur ou propriétaire.
- **Journal en ajout seul** : des déclencheurs refusent `UPDATE`, `DELETE` et `TRUNCATE` sur le
  journal pour le rôle applicatif, lorsque les rôles sont séparés ; le propriétaire du schéma peut
  les contourner (le scellement et la copie vers un SIEM le détectent). La purge (entrées de plus
  d'un an) passe par une fonction contrôlée.
- Requêtes paramétrées uniquement ; bornes d'exécution (instruction 30 s, verrou 10 s,
  transaction inactive 60 s) ; contrôle de révision sous verrou de ligne.
- TLS vers PostgreSQL (`DATABASE_SSL=verify-full` et `DATABASE_SSL_CA_FILE`) lorsque la base est
  distante ; dans le déploiement Docker Compose, la base est sur un réseau interne sans sortie.

### 2.6 Journal d'audit

- Couvre sessions, échecs, verrouillages, second facteur, comptes, droits, lecture, écriture,
  export et versions des analyses, consultation et purge du journal, démarrage et arrêt.
- **Scellé par HMAC-SHA256** (clé dérivée de la clé maître, absente de la base) et chaîné :
  modifier ou insérer une entrée, ou en supprimer une au milieu du journal, est détecté par la
  vérification d'intégrité. La suppression des premières ou des dernières entrées ne l'est pas :
  la copie vers un SIEM (`AUDIT_STDOUT`) en garde la preuve. Toute tentative de rétrogradation
  vers l'ancien format non scellé est détectée.
- Copie en temps réel sur la sortie standard, une entrée JSON par ligne (`AUDIT_STDOUT=true`),
  pour un collecteur (journald, syslog) ou un SIEM : la preuve est conservée hors de la base.

### 2.7 Application web

| Mesure | Détail |
|---|---|
| CSP stricte | `default-src 'self'` ; aucun script en ligne ; aucune feuille de style injectée (`style-src 'self'`, seuls les attributs `style` des composants sont admis) ; `frame-ancestors 'none'`, `base-uri 'none'`, `object-src 'none'` |
| Isolation | `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy`, `Origin-Agent-Cluster`, `X-Frame-Options: DENY`, `Permissions-Policy` restrictive, HSTS en HTTPS |
| Requêtes inter-sites | Fetch Metadata : l'API refuse toute requête d'un autre site (sauf le retour du fournisseur d'identité) ; contrôle de l'origine ; en-tête anti-CSRF obligatoire ; corps JSON uniquement |
| Déni de service | limitation par adresse IP (600 requêtes par minute, 20 connexions par minute), taille maximale des requêtes, délais d'en-têtes et de requête |
| Validation | schéma strict (zod) de chaque entrée et de chaque document d'analyse ; cohérence référentielle ; texte enrichi assaini (DOMPurify) à l'affichage |
| Discrétion | ni version ni pile technique exposées aux visiteurs non authentifiés ; messages d'erreur génériques |
| Souveraineté | aucune requête vers un hôte tiers (vérifiée par le test de bout en bout) |

### 2.8 Chaîne d'approvisionnement

- Aucun script d'installation tiers (`.npmrc` : `ignore-scripts`), dépendances verrouillées
  (`package-lock.json`), nomenclature CycloneDX et licences livrées avec l'archive.
- `npm run audit:deps` : vulnérabilités connues des dépendances de production. Au 13/10/2026,
  seule une alerte modérée subsiste (GHSA-w5hq-g745-h8pq, `uuid` < 11.1.1 via exceljs) :
  **non exploitable**, la faille ne concerne que les fonctions v3/v5/v6 appelées avec un
  tampon, alors qu'exceljs n'appelle que `v4()` ; le code livré au navigateur est de plus le
  paquet précompilé d'exceljs.

## 3. Configuration de production

1. Déployer selon l'un des modes de production du [guide d'installation](installation.md) — Linux
   natif (unités systemd durcies), Docker Compose ou image seule, qui appliquent tous le même
   cloisonnement ; conserver les secrets générés dans un coffre-fort.
2. Servir en HTTPS : reverse proxy TLS (Nginx, HAProxy) avec `COOKIE_SECURE=true` et
   `TRUST_PROXY=true`, ou TLS natif (`TLS_CERT`, `TLS_KEY`).
3. Conserver `MFA_POLICY=required` ; avec l'authentification unique, exiger le MFA chez le
   fournisseur (`OIDC_ACR_VALUES`) et envisager `LOCAL_LOGIN=false`.
4. Séparer les rôles PostgreSQL (`DATABASE_MIGRATION_URL` pour les migrations seulement) ;
   chiffrer la connexion si la base est distante (`DATABASE_SSL=verify-full`).
5. Collecter la sortie standard (`AUDIT_STDOUT=true`) vers le SIEM de l'organisation ; vérifier
   régulièrement l'intégrité du journal depuis l'écran d'administration.
6. Sauvegarder la base (`pg_dump`) et, **séparément**, la clé maître ; chiffrer le stockage de
   l'hôte ; appliquer le guide ANSSI de configuration d'un système GNU/Linux.
7. Suivre `npm run audit:deps` et les mises à jour de Node.js et PostgreSQL.

## 4. Rotation de la clé maître

1. Générer une nouvelle clé : `openssl rand -base64 32`.
2. Redémarrer avec `BEFFROI_MASTER_KEY_FILE` désignant un fichier contenant la nouvelle clé et
   `BEFFROI_PREVIOUS_MASTER_KEYS_FILE` un fichier contenant l'ancienne clé (plusieurs clés séparées
   par des virgules). Au démarrage, analyses, métadonnées et secrets MFA sont rechiffrés avec la
   nouvelle clé (entrée `crypto.rewrap` au journal).
3. Les empreintes de mots de passe, calculées avec un poivre lié à la clé, sont renouvelées à la
   connexion de chaque utilisateur ; le démarrage indique combien restent liés à l'ancienne clé.
   Le journal reste vérifiable tant que l'ancienne clé est présente dans le trousseau.
4. Conserver l'ancienne clé (en lecture seule) tant que des empreintes ou des entrées de journal
   en dépendent, puis la retirer ; réinitialiser au besoin les comptes non reconnectés.

## 5. Risques résiduels

| Risque | Commentaire et traitement possible |
|---|---|
| Hameçonnage en temps réel du second facteur | le TOTP ne résiste pas à un relais d'hameçonnage ; l'authentification unique avec un facteur résistant (clé FIDO2 chez le fournisseur d'identité) supprime ce risque |
| Compromission du serveur applicatif | l'application détient la clé maître en mémoire : un attaquant qui la contrôle lit les analyses ; durcissement de l'hôte et cloisonnement du conteneur à la charge de l'exploitant |
| Suppression des premières ou des dernières entrées du journal par un super-utilisateur de la base | le scellement détecte toute modification mais pas la troncature du début et de la fin du journal : la copie vers un SIEM (`AUDIT_STDOUT`) en conserve la preuve |
| Limitation de débit par instance | les compteurs sont en mémoire : avec plusieurs instances, la limite s'applique par instance (le verrouillage par compte, lui, est en base) ; compléter au reverse proxy |
| Fichiers exportés | non chiffrés par Beffroi RM : à protéger selon leur mention de protection |
| Attributs de style en ligne autorisés par la CSP | nécessaires aux composants graphiques ; ils ne permettent pas d'exécuter du script |
| Informations classifiées | Beffroi RM n'est pas conçu pour traiter des informations portant une mention de classification de défense |

## 6. Correspondance avec les guides de l'ANSSI

| Guide | Mise en œuvre |
|---|---|
| Recommandations relatives à l'authentification multifacteur et aux mots de passe | MFA TOTP exigé, OIDC avec niveau d'authentification vérifié, politique de mot de passe, empreintes scrypt poivrées, verrouillage, information de dernière connexion |
| Recommandations pour la mise en œuvre d'un site web : maîtriser les standards de sécurité côté navigateur | CSP stricte, isolation inter-origines, Fetch Metadata, cookies `__Host-`, CSRF, HSTS |
| Recommandations de sécurité relatives à TLS | TLS 1.2 minimum, suites AEAD à confidentialité persistante ; TLS vers PostgreSQL |
| Recommandations pour la mise en place de cloisonnement système | conteneurs non privilégiés en lecture seule, sans capacités, ressources bornées, base sur réseau interne, rôles PostgreSQL séparés |
| Recommandations de sécurité pour la mise en œuvre d'un système de journalisation | journal scellé et chaîné, en ajout seul, export JSON en temps réel vers un collecteur |
| Recommandations relatives à l'administration sécurisée des SI | administrateur applicatif distinct sans accès aux analyses, MFA, session courte ; administration système à la charge de l'exploitant |
