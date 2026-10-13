# Benchmark des outils EBIOS Risk Manager

État du marché fin septembre 2026, établi à partir de la liste officielle des solutions
labellisées par l'ANSSI, de la documentation publique des éditeurs et des tickets publics
(GitHub) des projets open source. Les éditeurs ne publient ni tarifs ni documentation détaillée :
les points faibles relevés s'appuient sur ce qui est public et sur les usages courants, pas sur des
tests en main propre des logiciels propriétaires.

## 1. Panorama

Solutions labellisées EBIOS RM (page « Label EBIOS Risk Manager », cyber.gouv.fr) :

| Éditeur | Solution | Standalone | Client-serveur | SaaS |
|---|---|---|---|---|
| ADACIS | ARIMES | 1.2 | – | – |
| Airbus Protect | Fence | 3.16 | 3.16 | – |
| ALL4TEC | Agile Risk Manager | – | 2.6.2 | – |
| EGERIE Software | EGERIE Risk Manager | – | 4.0 | 4.0 |
| Reciproc-IT | Oligo Risk Manager | 2.1.0 | 1.0.0 | – |
| Sia Partners | C2R – Cyber Risk Review | – | 1.0 | – |
| Phinasoft | Phinasoft Risk Manager | – | 2.0 | 2.0 |

Hors label mais très utilisés : **CISO Assistant** (intuitem, GRC open source AGPLv3 avec un
module EBIOS RM), le **modèle Excel de l'ANSSI**, et les grands GRC génériques (ServiceNow IRM,
Archer…) où EBIOS RM est reconstitué à la main.

## 2. Fiches concurrents

### EGERIE (EGERIE Risk Manager / plateforme EGERIE)

- **Positionnement** : leader français du « cyber risk management », 150+ grands comptes
  (CAC 40, Ministère des Armées, OIV/OSE), levée de 30 M€ (2023). SaaS ou on-premise.
- **Points forts**
  - Plateforme intégrée : analyses EBIOS RM, ISO 27005 et **quantification financière** (FAIR),
    conformité multi-référentiels, plans d'action, tableaux de bord de pilotage.
  - Bibliothèques métiers et normatives, « moteur d'analyse » qui réévalue dynamiquement les
    risques quand les mesures avancent ; « saisir une fois, retrouver partout ».
  - Visuels de restitution : radar SR/OV (vue par SR et par OV), graphes d'attaque avec
    détection automatique des chemins critiques, dashboards consolidés multi-périmètres.
  - Crédibilité institutionnelle (label, référence défense).
- **Points faibles**
  - Produit **grand compte** : coût non public, commercialisé sur devis, déploiement
    accompagné ; surdimensionné pour une PME, une collectivité ou un consultant indépendant.
  - Richesse fonctionnelle (GRC complet) qui **éloigne de la méthode** : l'utilisateur
    occasionnel doit apprendre la plateforme avant de dérouler les ateliers.
  - Écosystème fermé : formats propriétaires, dépendance à l'éditeur pour les bibliothèques.
  - La quantification financière reste peu exploitable sans données de fréquence fiables.

### ALL4TEC — Agile Risk Manager

- **Positionnement** : premier outil labellisé (2019), « 2 000+ RSSI », éditeur français,
  focalisé **on-premise et environnements déconnectés** (OIV/OSE).
- **Points forts**
  - Déroulé guidé et fidèle des 5 ateliers, représentations graphiques des résultats,
    génération de rapports en un clic (Word, Excel, PDF), pas d'enfermement des données.
  - Mode « analyse flash » (saisie minimale par atelier).
  - Bibliothèques de référentiels (NIS2, ISO 2700x, DORA, HDS, ReCyF…), journal d'audit,
    connecteurs IA « souverains ».
- **Points faibles**
  - Pas d'offre cloud managée : installation, sauvegardes et montées de version à la charge
    du client.
  - Outil commercial sur devis ; licences par utilisateur peu adaptées aux contributeurs
    ponctuels (métiers, direction) qu'EBIOS RM suppose pourtant de faire participer.
  - Les tableaux de bord n'apparaissent que si chaque phase est renseignée (limite
    documentée par l'éditeur).

### Airbus Protect — Fence

- **Positionnement** : outil né chez les consultants d'Airbus Protect, 400+ utilisateurs,
  standalone (réseaux isolés) ou web on-premise.
- **Points forts** : conçu **par des praticiens** (gains de productivité sur la saisie),
  catalogues ISO 27002, NIST 800-53 et **MITRE ATT&CK**, génération Word par gabarits,
  SSO SAML2/LDAP, RBAC, chiffrement de la base, suivi du plan de traitement (courbes « waterfall »).
- **Points faibles** : orienté consultant expert, peu pédagogique pour un néophyte ; pas de
  SaaS ; ergonomie centrée sur les tableaux plus que sur les visuels ; offre sur devis.

### CISO Assistant (intuitem) — open source

- **Positionnement** : GRC « tout-en-un » open source (AGPLv3), 150+ référentiels, module
  EBIOS RM dédié, édition Pro SaaS/on-premise (lecteurs gratuits jusqu'à 100).
- **Points forts**
  - Gratuit, Docker/Helm, données souveraines, communauté active.
  - Modèle objet dédié EBIOS RM (pas un risque générique maquillé) ; formule de dangerosité
    `(D × P)/(M × C)` ; **radar écosystème** initial/résiduel ; éditeur de graphes (kill chain en
    4 colonnes Connaître/Rentrer/Trouver/Exploiter, opérateurs ET/OU) ; export Excel
    multi-onglets ; rapport PDF.
  - Réutilise l'inventaire d'actifs et les audits de conformité de la plateforme pour le socle.
- **Points faibles** (documentation et tickets publics)
  - **Aucun visuel** aux ateliers 1 et 2 (pas de radar SR/OV, pas de carte valeurs
    métier/biens supports) ; le radar SR/OV est pourtant une exigence du label (EXI_M2_09).
  - Vraisemblance : en mode *express*, max des modes opératoires ; **pas de calcul standard ou
    avancé** à partir des actions élémentaires (probabilité de succès / difficulté technique
    propagées dans le graphe) ; un seul enchaînement par mode opératoire.
  - Construction des modes opératoires laborieuse : le choix des prédécesseurs n'est pas filtré
    par étape (ticket #3399) ; sources de risque longtemps non personnalisables (#1822).
  - Pas de **gestion de versions x.y** stratégique/opérationnelle ni de mention de protection
    au sens du label ; import ARM avec perte d'information.
  - Complexité d'une plateforme GRC complète pour qui veut seulement faire une EBIOS RM.

### Autres labellisés (Oligo Risk Manager, Phinasoft, C2R, ARIMES)

- **Points forts** : label, acteurs de niche (cabinets de conseil ou petits éditeurs),
  proximité avec leurs clients, versions standalone pour les environnements sensibles (Oligo,
  ARIMES).
- **Points faibles** : faible visibilité publique (peu de documentation, captures ou démos),
  écosystèmes restreints, pérennité et rythme d'évolution incertains, souvent adossés à une
  offre de conseil.

### Modèle Excel ANSSI et bricolages bureautiques

- **Points forts** : gratuit, connu, zéro installation, structure fidèle aux ateliers (feuilles
  Organisation, Métriques, Missions, ER, GAP, SROV, PP, carto PP, SS, SO, Risques).
- **Points faibles** : aucune cohérence référentielle (les liens ER ↔ OV ↔ scénarios sont
  recopiés à la main), `#DIV/0!` dans la feuille PP, graphes d'attaque à dessiner à part, aucun
  calcul de vraisemblance, pas de versions, pas de droits, pas de journal, collaboration par
  envoi de fichiers ; illisible dès que l'étude grossit.

## 3. Synthèse comparative

| Critère | Egerie | Agile RM | Fence | CISO Assistant | Excel ANSSI |
|---|---|---|---|---|---|
| Couverture 5 ateliers | ●●● | ●●● | ●●● | ●●○ | ●●○ |
| Fidélité sémantique au guide | ●●○ | ●●● | ●●● | ●●○ | ●●● |
| Radar SR/OV | ●●● | ●●○ | ●●○ | ○○○ | ○○○ |
| Radar dangerosité PP init./résid. | ●●● | ●●● | ●●○ | ●●● | ●○○ |
| Scénarios stratégiques visuels | ●●○ | ●●○ | ●●○ | ●○○ | ○○○ |
| Graphe d'attaque + calcul vraisemblance std/avancé | ●●○ | ●●○ | ●●○ | ●○○ | ○○○ |
| Matrice des risques init./résid. interactive | ●●● | ●●○ | ●●○ | ●●○ | ●○○ |
| Versions x.y + mention de protection | ●●○ | ●●● | ●●● | ●○○ | ○○○ |
| Prise en main par un non-expert | ●○○ | ●●○ | ●○○ | ●○○ | ●●○ |
| Coût d'entrée / auto-hébergement | ○○○ | ●○○ | ●○○ | ●●● | ●●● |
| Ouverture des formats | ●○○ | ●●○ | ●●○ | ●●● | ●●● |

Lecture : ●●● très bon, ○○○ absent ou faible, d'après la documentation publique.

## 4. Enseignements pour notre produit

1. **Rester un outil de méthode, pas un GRC** : l'atelier courant et la chaîne
   SR/OV → scénario stratégique → chemin → scénario opérationnel → risque doivent être visibles
   en permanence. Pas de modules satellites qui diluent la démarche.
2. **Tout est lié, rien n'est recopié** : une valeur métier, un ER ou une partie prenante est
   saisi une fois et référencé partout ; gravité et vraisemblance se propagent
   automatiquement, avec « forçage » explicite et visible (EXI_M3_11, M3_22, M4_16, M5_09).
3. **Visuels natifs à chaque atelier**, là où les concurrents s'arrêtent à l'atelier 3 :
   carte valeurs métier/biens supports et radar de conformité (A1), radar SR/OV et
   croisement OV/ER (A2), radar de dangerosité initial/résiduel et diagramme de scénario
   stratégique en couloirs (A3), éditeur de graphe d'attaque avec calcul Pr/difficulté et mode
   opératoire critique surligné (A4), matrices initiale/résiduelle glisser-déposer, couverture
   ER, carte de la menace SR → OV → valeurs métier → risques (A5).
4. **Calculs de la fiche 8 exacts** (méthodes expresse, standard et avancée) : c'est le
   différenciateur le plus net face à CISO Assistant et au tableur.
5. **Auto-hébergement simple et souverain** (Docker Compose ou archive hors ligne, socle Node.js /
   PostgreSQL inscrit au SILL, authentification unique OpenID Connect, chiffrement au repos
   intégré) et **formats ouverts** (JSON complet, Excel multi-onglets, Word, PDF) : on répond au
   besoin de souveraineté sans le coût d'Egerie.
6. **Collaboration** : lecteurs illimités, droits lecture/écriture par analyse et par groupe,
   journal d'audit, versions x.y conformes au label.
7. **Pédagogie intégrée** : aide contextuelle issue du guide et des fiches à chaque activité,
   exemple ANSSI (biotech vaccins) importable pour apprendre.
8. **Migration depuis le tableur** : reprise directe du modèle Excel de l'ANSSI, point d'entrée
   de la plupart des équipes qui débutent avec la méthode (lever le coût de bascule).
