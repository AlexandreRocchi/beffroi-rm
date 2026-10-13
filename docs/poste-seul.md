# Beffroi RM en mode poste seul

Le mode **poste seul** est une version de Beffroi RM pour **une personne, sur son propre poste** :
un seul fichier exécutable, sans installation, sans PostgreSQL, sans compte ni mot de passe. Les
cinq ateliers, les visuels, les calculs, les versions et les exports (PDF, Word, Excel, JSON) sont
les mêmes que dans le serveur d'équipe.

Ce qui n'existe pas en mode poste seul : la collaboration (partage, droits, groupes), les comptes
(connexion, second facteur, sessions), l'administration et le journal d'audit.

## Télécharger

Sur la page **Releases** du dépôt GitHub, choisissez le livrable de votre système :

| Système | Fichier |
|---|---|
| Windows 10/11 (x64) | `beffroi-poste-<version>-windows-x64.exe` |
| Linux (x64, glibc) | `beffroi-poste-<version>-linux-x64.tar.gz` |

Vérifiez l'intégrité avec le fichier `.sha256` publié à côté (Linux : `sha256sum -c <fichier>.sha256` ;
Windows : `Get-FileHash -Algorithm SHA256 <fichier>`).

Chaque livrable porte une **attestation de provenance** GitHub (signée par Sigstore, inscrite dans
un journal de transparence public) : elle prouve que le fichier a été construit par le workflow de
ce dépôt, à partir d'un commit précis. Vérification avec la CLI GitHub :

```bash
gh attestation verify beffroi-poste-<version>-linux-x64.tar.gz --repo AlexandreRocchi/beffroi-rm
```

## Lancer

- **Windows** : double-cliquez sur le `.exe`. Tant que l'exécutable n'est pas signé (voir
  [Signature](#signature-de-lexécutable-windows)), ou tant que sa réputation n'est pas établie,
  SmartScreen peut afficher « Windows a protégé votre ordinateur » : cliquez sur
  *Informations complémentaires* puis *Exécuter quand même*.
- **Linux** :

  ```bash
  tar xzf beffroi-poste-<version>-linux-x64.tar.gz
  ./beffroi-poste-<version>-linux-x64/beffroi-poste
  ```

Une fenêtre de console s'ouvre et le navigateur affiche Beffroi RM. **Gardez la console ouverte**
pendant votre travail ; fermez-la (ou `Ctrl+C`) pour quitter. Relancer le programme alors qu'il est
déjà ouvert rouvre simplement la page.

Options :

| Option | Effet |
|---|---|
| `--port <n>` | port d'écoute sur 127.0.0.1 (défaut 47380 ; un port libre est choisi s'il est occupé ; `0` = toujours au hasard) |
| `--donnees <dossier>` | dossier des études (aussi : variable `BEFFROI_DONNEES`) |
| `--sans-navigateur` | n'ouvre pas le navigateur ; l'adresse à ouvrir est affichée |
| `--version`, `--aide` | version, aide |

## Où sont mes études ?

Un fichier JSON par étude (toutes ses versions comprises), dans :

| Système | Dossier |
|---|---|
| Windows | `%APPDATA%\Beffroi\etudes` |
| Linux | `~/.local/share/beffroi/etudes` (ou `$XDG_DATA_HOME/beffroi/etudes`) |
| macOS | `~/Library/Application Support/Beffroi/etudes` |

**Sauvegarde** : copiez ce dossier, programme fermé. Pour **transmettre** une étude à un collègue
ou la verser sur un serveur d'équipe Beffroi RM, exportez-la au format JSON (*Exports et imports*),
puis importez-la de l'autre côté (*Importer* sur la page d'accueil).

## Sécurité

- **Aucun accès réseau** : le programme n'écoute que sur `127.0.0.1` (jamais sur le réseau) et
  n'émet aucune requête sortante ; la même politique de sécurité du contenu (CSP) que le serveur
  d'équipe interdit toute ressource extérieure.
- **Accès réservé au navigateur ouvert par le programme** : à chaque lancement, un jeton aléatoire
  de 256 bits est déposé dans un cookie `HttpOnly`, `SameSite=Strict`. Une autre page web, ou un
  autre utilisateur du même poste, ne peut pas lire ni modifier les études. Si l'onglet n'est plus
  relié (programme relancé), Beffroi RM invite à relancer le programme.
- **Protections du navigateur** identiques au serveur d'équipe : contrôle de l'en-tête `Host`
  (rebinding DNS), Fetch Metadata, anti-CSRF, en-têtes de sécurité.
- **Données non chiffrées par Beffroi RM** : les études sont des fichiers lisibles par votre compte
  (droits `0600` sous Linux et macOS, profil utilisateur sous Windows). Une clé posée à côté des
  données n'apporterait rien : **chiffrez le disque** (BitLocker, LUKS, FileVault), surtout sur un
  portable. Pour des analyses Diffusion Restreinte ou plus, respectez les règles d'homologation de
  votre organisation : un poste isolé et chiffré, ou le serveur d'équipe.

## Construire l'exécutable

L'exécutable est une [Single Executable Application](https://nodejs.org/api/single-executable-applications.html)
Node.js : le programme (`server/src/poste.ts`, compilé en un seul fichier) et l'application web
sont injectés dans une copie du binaire Node.js. Il se construit sur le système visé :

```bash
npm ci
npm run poste        # release/beffroi-poste-<version>-<système>-<arch>.(exe|tar.gz) + .sha256
npm run test:poste   # parcours complet de l'exécutable dans Chromium
```

Le workflow [`.github/workflows/poste.yml`](../.github/workflows/poste.yml) construit et teste les
versions Windows et Linux, puis les publie sur la page Releases à chaque étiquette `v*` :

```bash
git tag v1.2.0 && git push origin v1.2.0
```

Développement (sans empaquetage) : `npm run dev:poste`.

## Signature de l'exécutable Windows

L'exécutable Windows n'est pas signé (Authenticode) : Windows SmartScreen peut demander une
confirmation au premier lancement (« Informations complémentaires » puis « Exécuter quand même »).
L'intégrité se vérifie par la somme de contrôle SHA-256 et par l'attestation de provenance (ci-dessus).
La mise en place d'une signature avec SignPath est suivie dans les issues du dépôt.
