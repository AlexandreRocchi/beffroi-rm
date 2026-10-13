# EBIOS Risk Manager — synthèse de la méthode

Synthèse des documents officiels de l'ANSSI, collectés dans [`docs/sources/`](sources/).
Tout ce qui figure ici a été vérifié contre les textes sources ; les numéros de page renvoient
au guide v1.5.

## 0. Corpus collecté

| Document | Fichier | Licence |
|---|---|---|
| Guide *La méthode EBIOS Risk Manager* v1.5 (sept. 2024, ANSSI-PA-048) | `250129_np_anssi_guide_ebios_fr_final_collection_WEB.pdf` | Licence Ouverte Etalab v1 |
| Fiche méthode 1 — Identifier le périmètre métier et technique (atelier 1) | `Fiche_methode-Identifier_le_perimetre_metier_et_technique-atelier_1.pdf` | idem |
| Fiche méthode 3 — Évaluer la gravité des événements redoutés (ateliers 1 et 3) | `Fiche_methode-Evaluer_la_gravite_des_evenements_redoute-atelier_1.pdf` | idem |
| Fiche méthode 4 — Identifier et caractériser les sources de risque (atelier 2) | `Fiche_methode-Identifier_et_caracteriser_les_sources_de_risque-atelier_2.pdf` | idem |
| Fiche méthode 5 — Dangerosité des parties prenantes (atelier 3) | `Fiche_methode-Construire_lestimation_de_la_dangerosite_...-atelier_3.pdf` | idem |
| Fiche méthode 6 — Mesures de sécurité pour l'écosystème (atelier 3) | `Fiche_methode-Definir_des_mesures_de_securite_pour_l_ecosysteme-atelier_3.pdf` | idem |
| Fiche méthode 7 — Graphes d'attaque (atelier 4) | `Fiche_methode-Elaborer_des_graphes_d_attaque-atelier_4.pdf` | idem |
| Fiche méthode 8 — Vraisemblance des scénarios opérationnels (atelier 4) | `Fiche_methode-Evaluer_la_vraisemblance_des_scenarios_operationnels-atelier_4.pdf` | idem |
| Fiche méthode 9 — Structurer les mesures de traitement (atelier 5) | `Fiche_methode-Structurer_les_mesures_de_traitement_du_risque-atelier_5.pdf` | idem |
| Modèle de tableur des ateliers | `EBIOS_RM_Ateliers_modele.xlsx` | idem |
| Cahier des charges du label EBIOS RM v3.1 (01/10/2024) | `Cahier-des-Charges-Label-EBIOS-RM-v3.1.pdf` | — |
| Procédure d'obtention du label | `ANSSI_Procedure_obtention_label_EBIOS_RM.pdf` | — |
| Guide d'hygiène informatique (42 mesures, v2.0 2017) | `guide_hygiene_informatique_anssi.pdf` | Licence Ouverte Etalab v1 |

Les extractions texte brutes sont dans [`docs/sources/text/`](sources/text/).

## 1. Principes

- **Double approche** (pyramide p.5) : *conformité* (socle de sécurité : hygiène, cadre
  réglementaire et normatif) pour les risques courants et accidentels, *scénarios* pour les
  attaques ciblées ou sophistiquées.
- **Deux cycles** définis à l'atelier 1 : **stratégique** (revisite toute l'étude, typiquement
  3 ans pour une homologation) et **opérationnel** (scénarios opérationnels, typiquement 1 an).
- **Chaîne de valeur de l'analyse** (figure 3, p.10) :

```
Couple SR/OV (A2) ──► Scénario stratégique (A3) ──► chemin d'attaque 1..n
                                                        │
                                                        ▼
                                         Scénario opérationnel 1..n (A4)
                                                        │
                                                        ▼
                                           Scénario de risque 1..n (A5)
GRAVITÉ = celle du scénario stratégique (commune à tous ses chemins)
VRAISEMBLANCE = propre à chaque scénario opérationnel
NIVEAU DE RISQUE = f(gravité, vraisemblance)
```

  « Un scénario de risque correspond à l'association d'un chemin d'attaque et de son scénario
  opérationnel. »

- Conformité ISO 27005:2022 et ISO 31000:2018. Correspondances de vocabulaire :
  valeur métier = bien primaire (ISO) = bien essentiel (EBIOS 2010) ; événement redouté =
  conséquence ; événement intermédiaire = conséquence intermédiaire ; partie prenante = partie
  intéressée ; plan de traitement du risque = ex-PACS.

## 2. Atelier 1 — Cadrage et socle de sécurité

**Participants** : Direction, Métiers, RSSI, DSI. **Durée indicative** : 1 à 3 demi-journées.

| Étape | Contenu | Données de sortie |
|---|---|---|
| A. Cadre de l'étude | objectifs, participants et rôles (RACI), **personne qui accepte les risques résiduels**, cadre temporel (cycles), planning, hypothèses et contraintes | éléments de cadrage |
| B. Périmètre métier et technique | missions → valeurs métier (processus ou information, description, responsable interne/externe) → biens supports (description, responsable). 5 à 10 valeurs métier, 1 à 3 biens supports par valeur | périmètre |
| C. Événements redoutés | par valeur métier : atteintes D/I/C/traçabilité, impacts (catégories), **gravité** (échelle), justification ; possibilité d'ER non liés à une valeur métier (risques non intentionnels) | ER + gravité |
| D. Socle de sécurité | référentiels applicables (hygiène, PSSI, exigences tiers, normes, réglementation), état d'application (vert/orange/rouge), écarts et justification ; décision de poursuivre | socle + écarts |

**Catégories d'impacts** (fiche 3) : missions et services ; humains, matériels ou
environnementaux ; gouvernance ; financiers ; juridiques ; image et confiance.

**Échelle de gravité générique** (fiche 3) : G1 Mineure, G2 Significative, G3 Grave,
G4 Critique, G5 Catastrophique (5 niveaux si des impacts sectoriels/régaliens sont à mesurer,
sinon 4).

**Types de biens supports** (fiche 1) : matériels (terminal utilisateur, périphérique,
téléphone, équipement de stockage, serveur, moyen d'administration, équipement réseau,
équipement de sécurité, équipement industriel), logiciels (service d'infrastructure,
application, intergiciel, OS/hyperviseur, microgiciel, logiciel de sécurité), réseaux/canaux,
organisations (personne, support papier, échange verbal, élément d'ingénierie sociale), locaux
(site/bâtiment/salle, système de sécurité physique, système de sûreté de fonctionnement).

**Règle** : si la sécurité d'un élément ne dépend pas du commanditaire, c'est une **partie
prenante**, pas un bien support.

## 3. Atelier 2 — Sources de risque

**Participants** : Direction (au moins à la fin), Métiers, RSSI, éventuellement spécialiste
Threat Intel. **Durée** : 2 h à 1 j.

- A. Identifier les **sources de risque (SR)** et leurs **objectifs visés (OV)** → couples SR/OV.
- B. Évaluer la **pertinence** de chaque couple : motivation, ressources, activité.
- C. Sélectionner **3 à 6 couples** prioritaires (P1) ; couples secondaires (P2) à surveiller.
- Sortie : couples retenus/secondaires + **cartographie des sources de risque** (radar : distance
  radiale = pertinence, secteurs par SR ou par OV, plus proche du centre = plus dangereux).
- Croisement **OV ↔ ER** : chaque ER doit être relié à un couple et réciproquement ; les OV
  **héritent de la gravité** des ER associés.

**Catégories de SR** (fiche 4) : organisation étatique, organisation criminelle,
organisation terroriste, concurrent, activiste, officine spécialisée, amateur, collaborateur,
tiers opportuniste. Trois grands types : menace activiste/isolée, systémique, stratégique.

**Catégories d'OV** : espionnage, prépositionnement stratégique, influence, entrave au
fonctionnement, lucratif, défi/amusement.

**Métrique de pertinence** (fiche 4, motivation × ressources) :

| Ressources \ Motivation | Faible | Significative | Importante | Maximale |
|---|---|---|---|---|
| **Maximales** | Moyen | Moyen | Élevé | Élevé |
| **Importantes** | Faible | Moyen | Élevé | Élevé |
| **Significatives** | Faible | Faible | Moyen | Élevé |
| **Faibles** | Faible | Faible | Moyen | Moyen |

## 4. Atelier 3 — Scénarios stratégiques

**Participants** : Métiers, Achats/Juridique, architectes fonctionnels, RSSI, spécialiste cyber.

### A. Cartographie de dangerosité de l'écosystème (fiche 5)

Parties prenantes (PP) externes (clients, partenaires/cotraitants, prestataires) et internes
(services connexes techniques, services connexes métier, filiales).

```
                      Dépendance × Pénétration          (EXPOSITION)
Niveau de dangerosité = ─────────────────────────
                      Maturité cyber × Confiance         (FIABILITÉ CYBER)
```

Formule pondérable (ex. retirer la confiance si la PP n'est qu'un intermédiaire).
Chaque critère coté de 1 à 4 :

| Niv. | Dépendance | Pénétration | Maturité cyber | Confiance |
|---|---|---|---|---|
| 1 | Pas de lien avec le SI de la PP pour réaliser la mission | Pas d'accès ou accès utilisateur à des terminaux utilisateurs | Règles d'hygiène appliquées ponctuellement, non formalisées ; réaction incertaine | Intentions non évaluables |
| 2 | Lien utile à la mission | Accès admin à des terminaux utilisateurs ou accès physique aux sites | Hygiène et réglementation prises en compte sans politique globale ; mode réactif | Intentions neutres |
| 3 | Lien indispensable mais non exclusif | Accès admin à des serveurs « métier » | Politique globale appliquée ; réactif avec recherche d'anticipation | Intentions connues, probablement positives |
| 4 | Lien indispensable et unique | Accès admin à des équipements d'infrastructure ou accès physique aux salles serveurs | Politique de management du risque intégrée et proactive | Intentions parfaitement connues et compatibles |

**Zones** (seuils fixés par la gouvernance ; exemple du guide : veille 0,2 / contrôle 0,9 /
danger 2,5) : **danger** (inacceptable) ; **contrôle** (tolérable sous contrôle) ;
**veille** (acceptable en l'état) ; hors périmètre. Les PP en zones danger et contrôle sont
**critiques** (PPC) et entrent dans les scénarios. À défaut d'arbitrage : 10 % danger / 40 %
contrôle / 40 % veille / 10 % hors périmètre. Profondeur : rang 1 d'abord ; rang 3 pour une PP en
zone de danger, rang 2 en zone de contrôle.

Vérification sur l'exemple du guide : P3 Laboratoires (3×3)/(2×2) = 2,25 ; F3 Prestataire
informatique (3×4)/(2×2) = 3 ; F2 (4×3)/(2×3) = 2.

### B. Scénarios stratégiques

Pour chaque couple SR/OV retenu : quelles valeurs métier viser ? quelles PPC exploiter ?
Le scénario = **séquencement d'événements** : **événements intermédiaires** (sur une PP de
l'écosystème) puis **événements redoutés** (sur une valeur métier). 1 à 3 **chemins
d'attaque** par couple (attaque directe, par rebond, sur PP seule). Représentation en graphe
d'attaque ou superposée à la vue écosystème.
**Gravité** du scénario = gravité des ER impliqués (celle associée à l'OV). Sans atelier 4, la
**pertinence du couple SR/OV** sert d'indicateur de vraisemblance.

### C. Mesures sur l'écosystème (fiche 6)

| Niveau de menace | Acceptabilité | Recommandations |
|---|---|---|
| Très élevé — zone de danger | Inacceptable | Aucune PP dans cette zone : réduction du risque ou refus de l'interaction |
| Élevé — zone de contrôle | Tolérable sous contrôle | Enrôlement dans le management du risque : surveillance, audits, réduction/transfert |
| Faible — zone de veille | Acceptable en l'état | Sans objet |

Mesures formulées en **niveaux cibles** de critères (ex. pénétration 3 → 2), donnant une
**dangerosité résiduelle** (cartographie résiduelle, mêmes seuils). Une mesure ne réduit la
dangerosité actuelle que si elle est réellement mise en œuvre.

## 5. Atelier 4 — Scénarios opérationnels

**Participants** : RSSI, DSI, spécialiste cyber. Période : cycle opérationnel.

- Un scénario opérationnel par chemin d'attaque (pas obligatoire pour tous).
- **Graphe d'attaque** : enchaînement d'**actions élémentaires** (AE) portant sur des **biens
  supports** ; plusieurs **modes opératoires** ; opérateurs **ET / OU**. Règles : départ
  accessible par la SR, arrivée liée à l'OV, chaque AE remplit les conditions de la suivante.
- **Séquence d'attaque type** (fiche 7) : **Connaître** (reconnaissance externe, recrutement
  d'une source), **Rentrer** (intrusion depuis Internet ou réseaux tiers, intrusion ou piège
  physique), **Trouver** (reconnaissance interne, latéralisation et élévation de privilèges),
  **Exploiter** (pilotage et exploitation : espionnage, entrave, lucratif, influence).
  MITRE ATT&CK utilisable.

### Vraisemblance (fiche 8)

Échelle générique : V4 Quasi-certain, V3 Très vraisemblable, V2 Vraisemblable, V1 Peu
vraisemblable, (V0 Invraisemblable si 5 niveaux).

Trois méthodes, **choisies pour toute l'étude et modifiables à tout moment** :

1. **Expresse** : cotation directe du scénario (et éventuellement de chaque mode opératoire),
   ou croisement probabilité de succès × difficulté technique au niveau du scénario.
2. **Standard** : probabilité de succès (Pr) par AE. Propagation :
   `Pr_cumulé(AEn) = min(Pr(AEn), max(Pr_cumulé(prédécesseurs)))` ; valeur globale = max sur
   les modes aboutissant à l'étape finale. Correction possible : −1 niveau en bout de chaîne
   longue (~10 AE).
3. **Avancée** : Pr + difficulté technique (D) par AE.
   `D_cumulé(AEn) = max(D(AEn), min(D_cumulé(prédécesseurs)))` ; vraisemblance d'un mode =
   croisement Pr × D ; scénario = mode le plus vraisemblable ; +1 niveau possible si SR très
   déterminée. Attention à ne pas croiser Pr et D issus de modes différents.

Échelles : Pr 4 quasi-certaine (>90 %), 3 très élevée (>60 %), 2 significative (>20 %),
1 faible (<20 %), 0 très faible (<3 %) ; D 0 négligeable … 4 très élevée.

Matrice de croisement (fiche 8) :

| Pr \ D | 0 Négligeable | 1 Faible | 2 Modérée | 3 Élevée | 4 Très élevée |
|---|---|---|---|---|---|
| 4 Quasi-certaine | 4 | 4 | 3 | 2 | 1 |
| 3 Très élevée | 4 | 3 | 3 | 2 | 1 |
| 2 Significative | 3 | 3 | 2 | 2 | 1 |
| 1 Faible | 2 | 2 | 2 | 1 | 0 |
| 0 Très faible | 1 | 1 | 1 | 0 | 0 |

La fiche fournit une base de connaissance de critères de cotation par catégorie d'AE
(nombre de cibles, sensibilisation, filtrage, cloisonnement, SOC, MCS, etc.).

## 6. Atelier 5 — Traitement du risque

**Participants** : ceux de l'atelier 1. **Durée** : 2 à 4 demi-journées.

- A. **Synthèse** des scénarios de risque, cartographie du **risque initial** (grille
  gravité × vraisemblance, radar ou diagramme de Farmer), vues par SR/OV ; **matrice de
  couverture** ER ↔ scénarios (angles morts).
- B. **Stratégie de traitement** : acceptabilité par niveau de risque :

| Niveau | Acceptabilité | Décision |
|---|---|---|
| Faible | Acceptable en l'état | Aucune action |
| Moyen | Tolérable sous contrôle | Suivi et amélioration continue moyen/long terme |
| Élevé | Inacceptable | Réduction impérative à court terme, sinon refus de tout ou partie de l'activité |

- C. **Mesures** et **plan de traitement du risque** (PTR) : mesure, scénarios de risque
  associés, responsable, freins et difficultés, coût/complexité (+ / ++ / +++), charge estimée,
  échéance, priorité, statut ; catégories **Gouvernance / Protection / Défense / Résilience**
  (fiche 9 ; actions SMART).
- D. **Risques résiduels** : gravité et vraisemblance résiduelles, cartographie résiduelle
  (mêmes échelles), fiche RR (description, vulnérabilités résiduelles, facteurs aggravants,
  ER concernés, mesures existantes/complémentaires, gravité/vraisemblance/niveau initiaux et
  résiduels, gestion du risque résiduel). Cartographies par jalon (T0+3 mois, T0+6 mois…).
- E. **Cadre de suivi** : indicateurs (comités tenus, % mesures avancées, budget, j/h, écarts
  du socle réduits), comité de pilotage tous les 6 mois (montée en puissance) ou 12 mois.
- F. **Surveillance** : déclencheurs de mise à jour (nouvelle menace, évolution de
  l'écosystème, nouvelles vulnérabilités…).

Exemple fil rouge (biotech vaccins) : R1 G3/V3, R2 G3/V2, R3 G3/V4, R4 G4/V2, R5 G4/V1 ;
niveaux Élevé, Moyen, Élevé, Moyen, Moyen. Une matrice « produit G×V » avec seuils
≤3 Faible / 4–8 Moyen / ≥9 Élevé reproduit exactement ces niveaux : c'est la matrice par défaut
de l'application (modifiable).

## 7. Exigences du label ANSSI (cahier des charges v3.1)

Le cahier des charges du label est la meilleure spécification fonctionnelle disponible. Il est
tracé par groupes d'exigences dans [`03-conception-produit.md`](03-conception-produit.md) §9.
Points structurants :

- dérouler les 5 ateliers de façon itérative et exporter des livrables à chaque étape ;
- **mention de protection** obligatoire sur l'analyse (non protégé, sensible, DR, confidentiel…) ;
- **gestion de versions x.y** : mise à jour opérationnelle (y+1) ou stratégique (x+1), motif,
  ateliers concernés, synthèse des modifications ;
- valeurs **« forcées »** possibles (dangerosité, gravité, vraisemblance, résiduels) et
  **visuellement distinguées** ;
- bases de connaissances modifiables (catégories SR/OV, PP, AE, métriques) ;
- sécurité : compte admin distinct, comptes nominatifs, droits lecture/écriture par analyse et
  par groupe, **journalisation** (sessions, comptes, accès aux analyses, manipulation des
  journaux, événements applicatifs), confidentialité et intégrité au repos et en transit ;
- ergonomie : atelier courant toujours visible, navigation libre, seules les métriques utiles
  affichées, annuler, raccourcis clavier, sauvegarde auto, texte enrichi, listes triées avec
  saisie prédictive, en-têtes de tableaux figés.
