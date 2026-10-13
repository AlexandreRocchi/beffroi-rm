# Conception produit — Beffroi RM

> **Nom du produit** : *Beffroi RM* (« RM » pour *Risk Manager*) ; *Beffroi* évoque la tour de guet des villes, d'où l'on surveillait l'horizon et
> sonnait l'alerte. Nom français et distinctif : aucun logiciel de cybersécurité trouvé sous ce nom
> lors d'une recherche en septembre 2026 (*Vauban* et *Barbacane*, déjà portés par des acteurs de
> la sécurité, ont été écartés). Une recherche d'antériorité INPI/EUIPO reste à faire avant dépôt. Le nom de la méthode (EBIOS, marque du SGDSN) n'est utilisé que de façon descriptive.

## 1. Vision

Une application web auto-hébergeable qui permet à une équipe de conduire **de bout en bout**
une appréciation et un traitement des risques numériques selon **EBIOS Risk Manager v1.5**
sur un périmètre défini, avec des **visuels natifs à chaque atelier**, des **calculs fidèles
aux fiches méthodes** (hormis trois règles qui sont des choix de Beffroi RM, paramétrables :
voir § 3.1) et les exigences de sécurité du **label ANSSI** (mode client-serveur).

Principe directeur : *un outil de méthode, pas un GRC*. On saisit chaque objet une fois, tout le
reste (gravités héritées, dangerosité, vraisemblance, niveaux de risque, cartographies,
couverture, livrables) est dérivé et reste cohérent.

Second principe : **souveraineté, 100 % local**. Une analyse de risques décrit les faiblesses de
l'organisation ; elle ne doit dépendre d'aucun service en ligne. D'où :
- aucune requête sortante (ni télémétrie, ni CDN, ni police distante), vérifiée par les tests ;
- une archive d'installation autonome (serveur en un seul fichier, aucune dépendance à installer)
  testée dans un espace réseau sans Internet ;
- des exports générés dans le navigateur, un chiffrement dont la clé reste chez le client ;
- des composants open source à licences permissives, inventoriés (SBOM CycloneDX livrée).

## 2. Utilisateurs

| Persona | Besoins | Droits typiques |
|---|---|---|
| **Animateur / RSSI** (pilote de l'étude) | dérouler les ateliers en séance, projeter les visuels, produire les livrables d'homologation | propriétaire de l'étude |
| **Contributeur** (DSI, architecte, métier, threat intel) | compléter son périmètre (biens supports, PP, graphes d'attaque) | écriture sur l'étude |
| **Décideur** (direction, autorité d'homologation) | lire la synthèse, la cartographie des risques, la stratégie de traitement ; accepter les risques résiduels | lecture |
| **Consultant** | mener plusieurs études pour plusieurs clients, réutiliser ses bases de connaissances | propriétaire de ses études |
| **Administrateur** | comptes, groupes, journal ; n'accède jamais aux analyses (besoin d'en connaître) | administration uniquement |

## 3. Périmètre fonctionnel

### 3.1 Transverse
- **Portefeuille d'études** : cartes avec mention de protection, version, avancement par
  atelier, répartition des risques par niveau ; création vide, depuis l'exemple ANSSI
  (biotech vaccins), par import JSON ou par **reprise du modèle Excel de l'ANSSI** (classeur
  « EBIOS RM – Ateliers » complété : périmètre, ER, socle, SR/OV, PP, SS, vraisemblance
  expresse des SO, risques ; rapport d'import listant ce qui reste à structurer).
- **Espace d'étude** : la carte des 5 ateliers et de leurs activités est affichée en permanence
  dans la barre latérale (atelier courant en surbrillance, pastilles d'avancement) ; navigation
  libre ; bandeau de **mention de protection** sur chaque écran et chaque export.
- **Sauvegarde automatique** (et Ctrl+S), **annuler/rétablir** (Ctrl+Z / Ctrl+Y), raccourcis
  Alt+1..5 vers les ateliers, détection de conflit d'édition (révision optimiste).
- **Versions x.y** : nouvelle version opérationnelle (y+1) ou stratégique (x+1), motif,
  ateliers concernés ; versions antérieures figées consultables ; **synthèse automatique des
  modifications** par atelier et activité.
- **Valeurs forcées** : chaque valeur calculée (pertinence, dangerosité, gravité,
  vraisemblance, niveaux résiduels) peut être forcée ; la valeur forcée est signalée par un
  marqueur distinct et la valeur calculée reste affichée en regard.
- **Paramètres de l'étude** : échelles (4 ou 5 niveaux) avec libellés/descriptions/couleurs,
  matrices (pertinence, croisement Pr×D, niveau de risque), seuils des zones, pondération de la
  formule de dangerosité, bases de connaissances (catégories SR, OV, PP, impacts, biens
  supports, phases et catalogue d'actions élémentaires, aide à la cotation), import/fusion JSON.
- **Choix propres à Beffroi RM** : trois règles de calcul ne viennent pas des fiches méthodes de
  l'ANSSI mais de choix du produit, tous paramétrables dans les paramètres de l'étude :
  la modulation de la pertinence de ±1 niveau selon l'activité (désactivée par défaut) ;
  la grille Pr×D à 4 niveaux (grille de la fiche 8 sans la ligne Pr0 ni la colonne D0, valeurs
  ramenées à V1–V4), qui s'applique aux échelles à 4 niveaux, réglage par défaut ;
  la matrice de niveau de risque, calculée par le produit G×V (seuils 3 et 8 en échelles à
  4 niveaux ; G×(V+1), seuils 4 et 11, en échelles à 5 niveaux).
- **Aide contextuelle** : pour chaque activité, objectifs, participants et conseils tirés du
  guide et des fiches.
- **Exports** : JSON complet (ré-importable), Excel multi-onglets (tout ou atelier par atelier),
  rapport Word et rapport PDF (sections choisies, visuels inclus) produits à partir d'un même
  contenu (`export/report.tsx`), tous générés dans le navigateur.
- **Partage** : droits lecture/écriture par utilisateur ou groupe, par étude.

### 3.2 Atelier 1 — Cadrage et socle
- Cadre : objectifs, objet de l'étude, type d'étude (grille d'usages p.14), participants,
  **matrice RACI** ateliers × participants, responsable de l'acceptation des risques, durées des
  cycles, hypothèses, contraintes, planning des séances.
- Périmètre : missions, valeurs métier (nature, description, responsable interne/externe,
  besoins D/I/C/T), biens supports (type selon fiche 1, description, responsable), liaisons
  n–n ; **filtre** par valeur métier ; **import CSV** ; **visuel** : carte missions → valeurs
  métier → biens supports.
- Événements redoutés : par valeur métier (ou non liés : risques non intentionnels, avec
  vraisemblance expresse), critères atteints, catégories d'impacts, description des impacts,
  gravité, justification ; **visuel** : heatmap valeurs métier × gravité.
- Socle : référentiels (type, nom), exigences cochables une à une ou en masse, état
  (appliqué / avec restrictions / non appliqué / non applicable), écart, justification ;
  indicateur de couleur par référentiel (calculé ou forcé) ; affichage/masquage du détail ;
  filtre « non respectées » ; bibliothèque intégrée (guide d'hygiène ANSSI 42 mesures, mesures
  NIS 2 art. 21) ; import CSV ; décision de poursuite ; **visuel** : radar (Kiviat) de
  conformité.

### 3.3 Atelier 2 — Sources de risque
- Sources de risque (catégorie parmi la base modifiable, description).
- Couples SR/OV : objectif visé (texte + catégorie), motivation, ressources, activité,
  **pertinence calculée** (matrice fiche 4, modulable de ±1 niveau selon l'activité si le réglage
  est activé) ou forcée, justification,
  priorité P1/P2, retenu/écarté + justification d'exclusion.
- **Croisement OV ↔ ER** (matrice cochable) avec alertes : ER orphelins, couples sans ER ;
  gravité héritée affichée.
- **Visuel** : radar SR/OV (secteurs par source ou par catégorie d'objectif, distance =
  pertinence), filtres.

### 3.4 Atelier 3 — Scénarios stratégiques
- Parties prenantes : catégorie (base modifiable, internes/externes), rang 1–3, critères
  D/P/M/C avec info-bulles de la métrique, **dangerosité calculée** (formule pondérable) ou
  forcée, justification, zone, sélection **critique** (suggérée si zone contrôle/danger).
- Seuils veille/contrôle/danger (+ assistant 10/40/40/10 %).
- **Visuels** : radar de dangerosité **initial et résiduel côte à côte** (mêmes seuils,
  secteurs par catégorie, taille = exposition, couleur = fiabilité cyber, PPC cerclées).
- Scénarios stratégiques : couple SR/OV retenu, nom, description, **chemins d'attaque**
  (nom, description) composés d'étapes glissées depuis une palette : événements
  intermédiaires (liés à une PP) et événements redoutés (liés à une valeur métier) ;
  **gravité** = max des ER des chemins (ou ER du couple), forçable ; **visuel** : diagramme
  en couloirs Source → Écosystème → Objet de l'étude → Objectif visé.
- Mesures sur l'écosystème : par PP, mesure(s) + **niveaux cibles** des critères →
  dangerosité résiduelle ; recommandation automatique selon la zone (fiche 6).

### 3.5 Atelier 4 — Scénarios opérationnels
- Un scénario opérationnel par chemin d'attaque ; nom, description, justification.
- **Éditeur de graphe d'attaque** : couloirs Connaître / Rentrer / Trouver / Exploiter
  (phases modifiables), palette d'actions élémentaires issues du catalogue (fiche 7, glisser
  -déposer), nœuds ET / OU, nœud final « objectif visé », chaque AE rattachée à un **bien
  support** (ou à une PP pour la phase écosystème).
- **Méthode de vraisemblance** au niveau de l'étude, modifiable à tout moment :
  - *expresse* : vraisemblance directe du scénario et, au choix, de chaque mode opératoire ;
    option croisement Pr × D global ;
  - *standard* : Pr par AE, propagation `min(Pr, max(préd.))`, ET = min, OU = max ;
  - *avancée* : Pr et D par AE, propagation exacte par front de Pareto (évite de croiser des
    modes différents), croisement Pr × D, bonus +1 si SR très déterminée ;
  - correction optionnelle des chaînes longues (≥ 10 AE).
- Indices cumulés affichés sur chaque nœud, **mode opératoire le plus vraisemblable
  surligné**, AE les plus critiques listées ; modes opératoires nommés ; vraisemblance forçable.
- Base de connaissance d'aide à la cotation (fiche 8) consultable au moment de coter.
- Tableau de synthèse des scénarios opérationnels (filtre par seuil).

### 3.6 Atelier 5 — Traitement du risque
- **Scénarios de risque** générés automatiquement : un par chemin d'attaque retenu (gravité du
  scénario stratégique, vraisemblance du scénario opérationnel, ou pertinence du couple si pas
  d'atelier 4) + un par ER non intentionnel ; libellé éditable.
- **Cartographie du risque initial** (grille G×V colorée par niveau), tableau de synthèse,
  filtres (source, gravité min.) ; vue par SR/OV ; **matrice de couverture ER ↔ risques**
  avec angles morts surlignés.
- **Stratégie** : acceptabilité déduite du niveau (Faible/Moyen/Élevé →
  acceptable / tolérable sous contrôle / inacceptable), forçable, option de traitement
  (réduire, accepter, transférer, refuser), indicateur couleur.
- **Plan de traitement** : mesures issues du socle, de l'écosystème et des scénarios ;
  catégorie (gouvernance / protection / défense / résilience), éléments concernés (valeurs
  métier, biens supports, PP), risques traités, responsable, freins, coût/complexité, charge,
  échéance, priorité, statut, avancement %, commentaires ; tri et filtres ; **visuels** :
  avancement par catégorie, calendrier des échéances.
- **Risques résiduels** : gravité/vraisemblance résiduelles saisies dans le tableau **ou par
  glisser-déposer** sur la cartographie résiduelle (synchronisés), forçage, **fiche RR**
  (modèle p.78).
- **Suivi** : indicateurs de pilotage, comité (fréquence, prochaine date, membres),
  déclencheurs de mise à jour.
- **Carte de la menace** (vue de synthèse) : flux SR → OV → valeurs métier → niveaux de risque.

## 4. Architecture technique

```
┌──────────────── Navigateur ────────────────┐      ┌────────────── Serveur Node.js ───────────────┐
│ Svelte 5 + TypeScript (Vite)               │      │ Express 5 (HTTPS natif ou derrière proxy)    │
│  • Svelte Flow (@xyflow/svelte) : éditeur  │ JSON │  • Session (cookie HttpOnly, SameSite) ou    │
│    de graphe d'attaque                     │◄────►│    OpenID Connect (Keycloak, LemonLDAP::NG)  │
│  • SVG maison : radars, matrices, couloirs,│ REST │  • RBAC admin/utilisateur + ACL par étude    │
│    Sankey, Kiviat                          │      │  • Journal d'audit chaîné (SHA-256)          │
│  • moteur de calcul partagé (shared/)      │      │  • Chiffrement AES-256-GCM des études        │
│  • exports PDF (pdfmake), Word (docx),     │      └──────────────────────┬───────────────────────┘
│    Excel (exceljs)                         │                             │ pg (pool, transactions)
└────────────────────────────────────────────┘                  ┌──────────▼──────────┐
                                                                │   PostgreSQL ≥ 14   │
                                                                └─────────────────────┘
```

- **Monorepo** npm workspaces : `shared/` (types, valeurs par défaut, bases de connaissances,
  moteur de calcul, exemple ANSSI), `server/`, `web/`.
- **Modèle de persistance « document »** : chaque version d'étude est un document JSON
  typé, chiffré au repos. Ce choix rend triviaux versions figées, diff, export/import, undo, et
  garantit la cohérence référentielle (validation au chargement).
- **Moteur partagé** : les mêmes fonctions calculent côté client (affichage instantané) et
  côté serveur (tableau de bord du portefeuille).
- **Concurrence** : révision incrémentée à chaque sauvegarde, vérifiée sous verrou de ligne
  (`SELECT … FOR UPDATE`) ; une sauvegarde sur une révision périmée renvoie 409 et
  l'utilisateur choisit recharger ou écraser. Le schéma est migré au démarrage sous verrou
  consultatif, ce qui permet de lancer plusieurs instances derrière un répartiteur de charge.

### 4.1 Modèle de données (simplifié)

```
Study ──< StudyVersion (major.minor, frozen, change_type, summary, workshops, data chiffrée)
  │
  └── StudyData
       framing        objectifs, participants, RACI, cycles, planning, hypothèses, contraintes
       settings       échelles, matrices, seuils, pondérations, bases de connaissances
       missions ──< businessValues >──< supportingAssets
       fearedEvents   (→ businessValue | non intentionnel)
       baseline.referentials ──< requirements
       riskSources ──< srovPairs (>──< fearedEvents)
       stakeholders   (critères initiaux + cibles résiduelles)
       strategicScenarios (→ srovPair) ──< attackPaths ──< steps (→ stakeholder | fearedEvent)
       operationalScenarios (→ attackPath) : graph(nodes, edges), operatingModes
       risks          (→ attackPath | fearedEvent) : traitement, résiduel, fiche RR
       measures       (→ risks, businessValues, supportingAssets, stakeholders, requirements)
       monitoring     indicateurs, comité, déclencheurs
User ──< GroupMember >── Group        StudyAcl(study, user|group, read|write|owner)
Session, AuditLog(prev_hash, hash)
```

## 5. Écrans

1. Connexion / changement de mot de passe obligatoire au premier login.
2. Portefeuille d'études (tableau de bord).
3. Espace d'étude : barre latérale « carte de la méthode », en-tête (nom, version, mention,
   état de sauvegarde, annuler/rétablir, exports), contenu de l'activité, panneau d'aide
   repliable.
   - Vue d'ensemble (indicateurs, matrice, carte de la menace)
   - A1 : Cadre · Périmètre · Événements redoutés · Socle
   - A2 : Sources et couples SR/OV · Cartographie et croisement ER
   - A3 : Écosystème · Scénarios stratégiques · Mesures écosystème
   - A4 : Scénarios opérationnels (éditeur) · Synthèse
   - A5 : Synthèse des risques · Plan de traitement · Risques résiduels · Suivi
   - Carte de la menace · Paramètres · Versions · Partage · Exports
4. Administration : utilisateurs, groupes, journal d'audit (filtre, export, purge journalisée).

## 6. Visuels

| Visuel | Atelier | Exigence |
|---|---|---|
| Carte missions → valeurs métier → biens supports | A1 | EXI_M1_08 (filtre) |
| Heatmap gravité des ER par valeur métier | A1 | — |
| Radar (Kiviat) de conformité du socle | A1 | guide p.29 note 14 |
| Radar SR/OV (par source / par objectif) | A2 | EXI_M2_09 |
| Matrice de croisement OV ↔ ER | A2 | EXI_M2_10 |
| Radars de dangerosité initial / résiduel | A3 | EXI_M3_13, M3_26 |
| Diagramme de scénario stratégique en couloirs | A3 | EXI_M3_18/19 |
| Graphe d'attaque interactif (phases, ET/OU, indices) | A4 | EXI_M4_01..17 |
| Cartographie du risque initial / résiduel (glisser-déposer) | A5 | EXI_M5_01, M5_08, M5_10 |
| Matrice de couverture ER ↔ risques | A5 | EXI_M5_03 |
| Avancement du plan de traitement | A5 | EXI_M5_07 |
| Carte de la menace (flux SR → OV → VM → risques) | synthèse | — |

## 7. Sécurité (mode client-serveur du label)

Synthèse ci-dessous ; menaces, mesures (avec le code et les tests correspondants), configuration
de production et risques résiduels : [dossier de sécurité](securite.md).

- Compte **administrateur distinct**, créé au premier démarrage avec mot de passe à changer ;
  l'administrateur gère comptes, groupes et journal, sans jamais accéder aux analyses.
- Comptes **nominatifs** (identifiant unique), mots de passe ≥ 12 caractères, hachage
  **scrypt** salé, verrouillage après 5 échecs (15 min), sessions de 30 min d'inactivité /
  12 h max, jeton de session aléatoire (256 bits) stocké haché, cookie `HttpOnly; SameSite=Strict;
  Secure` en HTTPS.
- **Droits** lecture/écriture par étude, pour un utilisateur ou un groupe ; création d'étude
  réservée aux utilisateurs habilités.
- **Chiffrement au repos** AES-256-GCM des documents d'étude (clé maître en variable
  d'environnement ou fichier 0600) ; **en transit** : HTTPS natif (TLS 1.2+, suites ANSSI) ou
  reverse proxy.
- **Journal d'audit** : ouverture/fermeture de session, échecs, verrouillages, gestion des
  comptes, lecture/écriture/export d'analyses, gestion des versions, consultation/export/purge
  du journal, démarrage/arrêt de l'application ; entrées **chaînées par hachage** (intégrité
  vérifiable), toute purge est elle-même journalisée.
- En-têtes : CSP stricte, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS en HTTPS ;
  protection CSRF (SameSite strict + en-tête applicatif obligatoire sur les requêtes
  modifiantes) ; validation stricte des entrées (zod) ; texte enrichi assaini (DOMPurify).
- Conditions générales d'emploi : avertissements EXI_S6_02 à S6_05 dans l'application
  (page « À propos ») et la documentation.

## 8. Choix structurants et alternatives écartées

| Décision | Alternative | Raison |
|---|---|---|
| Document JSON versionné par étude | Schéma relationnel complet | versions figées, diff, export/import et undo triviaux ; volumétrie d'une étude faible (< 1 Mo) |
| PostgreSQL | SQLite embarqué (`node:sqlite`) | mode serveur d'équipe : accès concurrents, sauvegarde et réplication éprouvées, plusieurs instances possibles ; SGBD inscrit au SILL et utilisé par les services numériques de l'ANSSI |
| Svelte 5 + Svelte Flow | React + React Flow | framework à gouvernance communautaire (pas d'éditeur unique) inscrit au SILL, compilé sans environnement d'exécution lourd ; même éditeur de graphe (xyflow) |
| Express 5 | Fastify | cadre le plus répandu de l'écosystème Node.js, retenu par MonServiceSécurisé et MonAideCyber (ANSSI) |
| OpenID Connect | SAML, annuaire LDAP direct | protocole standard des fournisseurs d'identité du SILL (Keycloak, LemonLDAP::NG) ; le MFA est délégué au fournisseur (`acr_values`) |
| Calcul de vraisemblance par fronts de Pareto | Formules de la fiche appliquées nœud par nœud | reproduit exactement la fiche en méthode standard et évite, en avancée, de croiser Pr et D de modes différents (piège signalé par la fiche 8) |
| Visuels SVG maison | Bibliothèques de graphiques | radars EBIOS (zones, secteurs, distance inversée) non standard ; export identique à l'écran |
| Exports générés côté navigateur | Génération serveur | réutilise les composants SVG pour les images du rapport ; serveur minimal |

### 8.1 Socle technique : pourquoi ces composants

L'ANSSI ne publie pas de liste de technologies « validées ». Le socle a donc été choisi pour être
aligné sur deux références vérifiables :

- le **SILL** (socle interministériel de logiciels libres, code.gouv.fr/sill), qui recense les
  logiciels libres recommandés et utilisés par l'administration (consulté en septembre 2026) ;
- les **services numériques de l'ANSSI** développés avec beta.gouv.fr, dont le code est public :
  [MonServiceSécurisé](https://github.com/betagouv/mon-service-securise) (Node.js, TypeScript,
  Express, PostgreSQL, Svelte, Vite, Vitest, Playwright) et
  [MonAideCyber](https://github.com/betagouv/mon-aide-cyber) (Node.js, TypeScript, Express,
  PostgreSQL).

| Composant | Rôle dans Beffroi RM | Inscrit au SILL | Utilisé par les services de l'ANSSI |
|---|---|---|---|
| Node.js ≥ 22 | exécution du serveur | oui (NodeJS) | MonServiceSécurisé, MonAideCyber |
| TypeScript | langage (client, serveur, moteur partagé) | — | MonServiceSécurisé, MonAideCyber |
| Express 5 | API HTTP | — | MonServiceSécurisé, MonAideCyber |
| PostgreSQL ≥ 14 | base de données | oui | MonServiceSécurisé, MonAideCyber |
| Svelte 5 | interface | oui (version ≥ 5.55) | MonServiceSécurisé |
| Vite | construction de l'interface | oui (ViteJS) | MonServiceSécurisé |
| Vitest, Playwright | tests unitaires, API et de bout en bout | — | MonServiceSécurisé |
| Svelte Flow (@xyflow/svelte) | éditeur de graphe d'attaque | — | — (licence MIT, éditeur européen xyflow) |
| Keycloak, LemonLDAP::NG | fournisseurs d'identité OpenID Connect | oui | — |
| Nginx, HAProxy | terminaison TLS en frontal | oui | — |
| Docker | déploiement conteneurisé | oui | — |

Les autres bibliothèques embarquées (docx, exceljs, pdfmake, immer, DOMPurify, zod,
openid-client, pg…) sont open source sous licences permissives et inventoriées dans la
nomenclature CycloneDX livrée avec l'archive d'installation.

## 9. Traçabilité des exigences du label (cahier des charges v3.1)

| Exigence | Réalisation |
|---|---|
| Spéc. générales : 5 ateliers, itératif, exports par étape | espace d'étude, export Excel par atelier, rapport par sections |
| Mention de protection | champ obligatoire à la création, bandeau permanent, en-tête des exports |
| Guide d'utilisation | `docs/guide-utilisation.md` + aide contextuelle |
| Versions x.y | écran Versions : cycle opérationnel/stratégique, motif, ateliers, diff automatique |
| EXI_M1_01–03 cadre | écran Cadre, RACI, planning, export |
| EXI_M1_04–08 périmètre | missions, VM, BS, liaisons, filtre, import CSV, carte |
| EXI_M1_09–16 ER | ER par VM ou non liés, échelle de gravité modifiable, impacts, justification |
| EXI_M1_17–23 socle | référentiels, exigences cochables, masquer/afficher, indicateur couleur, justification, filtre, import |
| EXI_M2_01–03 | bases SR/OV par défaut modifiables, import/fusion JSON |
| EXI_M2_04–07 | motivation, ressources, activité, pertinence calculée ou saisie, justification, export |
| EXI_M2_08–10 | sélection, radar SR/OV filtrable, croisement OV/ER |
| EXI_M3_01–17 | catégories PP, grille D/P/M/C modifiable, formule pondérable, forçage visible, seuils, radar, PPC, pertinence → vraisemblance sans A4 |
| EXI_M3_18–23 | scénarios, chemins, événements intermédiaires/ER par palette, gravité calculée/forcée, export |
| EXI_M3_24–28 | mesures et niveaux cibles par PP, dangerosité résiduelle, radar résiduel même seuils, export |
| EXI_M4_01–06 | scénarios opérationnels liés, graphe, catalogue d'AE modifiable, BS par AE, ET/OU |
| EXI_M4_07–18 | choix et changement de méthode, grilles modifiables, algorithmes, aide à la cotation, forçage, chemin critique, synthèse |
| EXI_M5_01–03 | cartographie initiale, synthèse, filtres, matrice de couverture |
| EXI_M5_04–07 | couleur de stratégie (clic depuis la cartographie), mesures complètes, plan trié/filtré, export |
| EXI_M5_08–12 | résiduels par tableau ou glisser-déposer, forçage, cartographie résiduelle, fiches RR, export |
| EXI_S1 | admin distinct, comptes nominatifs, mots de passe, droits par étude/groupe, auth serveur |
| EXI_S2 | AES-256-GCM au repos, HTTPS |
| EXI_S3 | journal chaîné couvrant tous les événements listés |
| EXI_S6 | avertissements dans « À propos » et la documentation |
| Annexe A | responsive, raccourcis, sauvegarde auto, contrôle de saisie, texte enrichi, en-têtes figés, lignes alternées, atelier courant visible, navigation libre, métriques utiles seules, annuler, listes triées avec recherche |

Ne figurent pas dans ce tableau : les exigences EXI_S4, EXI_S5, EXI_S6_01 et EXI_S6_06. La ligne
EXI_S6 ne couvre que les avertissements ; les clauses EXI_S6_02 à EXI_S6_05 (mentions d'évaluation)
sont préparées mais sans objet tant que le produit n'est pas labellisé.
