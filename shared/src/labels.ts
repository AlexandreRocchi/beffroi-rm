import type {
  MeasureCategory,
  MeasureOrigin,
  MeasureStatus,
  ReferentialType,
  RequirementStatus,
  TreatmentOption,
} from "./types.js";

export const REQUIREMENT_STATUS: Record<RequirementStatus, { label: string; color: string }> = {
  applied: { label: "Appliquée", color: "#2e7d32" },
  partial: { label: "Appliquée avec restrictions", color: "#ef6c00" },
  not_applied: { label: "Non appliquée", color: "#c62828" },
  na: { label: "Non applicable", color: "#757575" },
  unknown: { label: "Non évaluée", color: "#9e9e9e" },
};

export const BASELINE_STATUS: Record<"applied" | "partial" | "not_applied", { label: string; color: string }> = {
  applied: { label: "Appliqué sans restriction", color: "#2e7d32" },
  partial: { label: "Appliqué avec restrictions", color: "#ef6c00" },
  not_applied: { label: "Non appliqué", color: "#c62828" },
};

export const REFERENTIAL_TYPES: Record<ReferentialType, string> = {
  hygiene: "Règles d'hygiène et bonnes pratiques",
  internal: "Règles internes (PSSI…)",
  third_party: "Exigences de tiers",
  standard: "Normes",
  regulation: "Réglementation",
  other: "Autre",
};

export const TREATMENT: Record<TreatmentOption, string> = {
  reduce: "Réduire",
  accept: "Accepter",
  transfer: "Transférer / partager",
  avoid: "Refuser / éviter",
};

export const MEASURE_CATEGORY: Record<MeasureCategory, { label: string; color: string; description: string }> = {
  governance: { label: "Gouvernance", color: "#5e35b1", description: "Gouvernance et anticipation : management du risque, homologation, maîtrise de l'écosystème, facteur humain, audits, veille." },
  protection: { label: "Protection", color: "#1e88e5", description: "Cloisonnement, authentification et contrôle d'accès, administration, protection des données, MCS, sécurité physique, chaîne d'approvisionnement." },
  defense: { label: "Défense", color: "#fb8c00", description: "Surveillance des événements, détection et classification d'incidents, réponse à incident." },
  resilience: { label: "Résilience", color: "#43a047", description: "Continuité d'activité (sauvegarde, restauration, modes dégradés), reprise d'activité, gestion de crise cyber." },
};

export const MEASURE_ORIGIN: Record<MeasureOrigin, string> = {
  baseline: "Socle de sécurité (A1)",
  ecosystem: "Écosystème (A3)",
  scenario: "Scénarios (A4/A5)",
  other: "Autre",
};

export const MEASURE_STATUS: Record<MeasureStatus, { label: string; color: string }> = {
  todo: { label: "À lancer", color: "#757575" },
  in_progress: { label: "En cours", color: "#1e88e5" },
  done: { label: "Terminé", color: "#2e7d32" },
  abandoned: { label: "Abandonné", color: "#b0bec5" },
};

export const COST_LABELS: Record<1 | 2 | 3, string> = { 1: "+", 2: "++", 3: "+++" };

export const CRITERIA_LABELS = { D: "Disponibilité", I: "Intégrité", C: "Confidentialité", T: "Traçabilité" } as const;

export interface ActivityHelp {
  title: string;
  objective: string;
  participants: string;
  duration?: string;
  outputs: string[];
  tips: string[];
  source: string;
}

/** Aide contextuelle issue du guide EBIOS RM v1.5 et des fiches méthodes. */
export const HELP: Record<string, ActivityHelp> = {
  "a1-cadre": {
    title: "Atelier 1 · Définir le cadre de l'étude",
    objective: "Exposer l'objet et les attendus, s'accorder sur les objectifs (processus de management du risque, homologation, certification…), identifier les participants, leurs rôles (RACI) et la personne qui acceptera les risques résiduels, définir le cadre temporel et les hypothèses.",
    participants: "Direction, Métiers, RSSI, DSI",
    duration: "1 à 3 demi-journées pour l'atelier complet",
    outputs: ["Objectifs de l'étude", "Rôles et responsabilités", "Cadre temporel (cycles stratégique et opérationnel)"],
    tips: [
      "Pour une homologation, les cycles sont couramment de 3 ans (stratégique) et 1 an (opérationnel).",
      "Il est indispensable d'identifier dès maintenant qui acceptera les risques résiduels.",
      "L'objectif de l'étude détermine la granularité et les ateliers à conduire (grille des usages, guide p.14).",
    ],
    source: "Guide EBIOS RM v1.5, p.18-20",
  },
  "a1-perimetre": {
    title: "Atelier 1 · Délimiter le périmètre métier et technique",
    objective: "Recenser les missions, les valeurs métier (processus ou informations à protéger) et les biens supports sur lesquels elles reposent.",
    participants: "Direction, Métiers, RSSI, DSI",
    outputs: ["Missions", "Valeurs métier et responsables", "Biens supports et responsables"],
    tips: [
      "5 à 10 valeurs métier suffisent généralement ; privilégier des ensembles d'informations.",
      "Limiter à 1 à 3 biens supports par valeur métier à ce stade ; ils seront complétés à l'atelier 4.",
      "Si la sécurité d'un élément ne dépend pas du commanditaire, c'est une partie prenante et non un bien support.",
    ],
    source: "Guide p.20-24 ; fiche méthode 1",
  },
  "a1-er": {
    title: "Atelier 1 · Identifier les événements redoutés",
    objective: "Pour chaque valeur métier, identifier les atteintes (disponibilité, intégrité, confidentialité, traçabilité) préjudiciables, leurs impacts et estimer leur gravité.",
    participants: "Direction, Métiers, RSSI, DSI",
    outputs: ["Événements redoutés", "Impacts", "Niveau de gravité justifié"],
    tips: [
      "Pour la disponibilité, préciser le seuil (ex. indisponibilité > 2 heures) : cela ancre la notion de mode dégradé.",
      "Considérer tous les impacts : internes, externes, directs, indirects.",
      "Conserver la justification de la cotation de l'impact le plus grave.",
      "Un ER non lié à une valeur métier permet d'intégrer un risque non intentionnel (vraisemblance en mode express).",
    ],
    source: "Guide p.24-27 ; fiche méthode 3",
  },
  "a1-socle": {
    title: "Atelier 1 · Déterminer le socle de sécurité",
    objective: "Identifier les référentiels applicables, évaluer leur état d'application, identifier et justifier les écarts, puis décider de la manière de poursuivre l'étude.",
    participants: "RSSI, DSI",
    outputs: ["Référentiels applicables", "État d'application", "Écarts justifiés"],
    tips: [
      "Vert : appliqué sans restriction ; orange : avec restrictions ; rouge : non appliqué.",
      "En cas d'écarts trop significatifs, renforcer le socle avant d'évaluer des risques ciblés.",
      "Les mesures du socle font partie intégrante du plan de traitement du risque.",
    ],
    source: "Guide p.28-31",
  },
  "a2-couples": {
    title: "Atelier 2 · Identifier et évaluer les couples SR/OV",
    objective: "Qui ou quoi pourrait porter atteinte aux missions et valeurs métier, et dans quel but ? Identifier les sources de risque et leurs objectifs visés, puis évaluer la pertinence de chaque couple.",
    participants: "Direction, Métiers, RSSI, spécialiste en analyse de la menace",
    duration: "2 heures à une journée",
    outputs: ["Couples SR/OV prioritaires (P1)", "Couples secondaires (P2) à surveiller"],
    tips: [
      "Rechercher des couples variés pour ne laisser aucun angle mort sur les valeurs métier.",
      "Critères : motivation, ressources (financières, compétences, infrastructures), activité dans le secteur.",
      "Ne pas confondre l'objectif visé avec la motivation.",
      "3 à 6 couples constituent généralement une base suffisante.",
    ],
    source: "Guide p.34-40 ; fiche méthode 4",
  },
  "a2-carto": {
    title: "Atelier 2 · Cartographie des sources de risque et croisement OV/ER",
    objective: "Représenter les couples sur un radar (distance = pertinence) pour sélectionner les couples retenus, puis relier chaque objectif visé aux événements redoutés de l'atelier 1.",
    participants: "Direction, Métiers, RSSI",
    outputs: ["Cartographie des sources de risque", "Croisement OV / ER"],
    tips: [
      "Privilégier des couples proches du centre et suffisamment éloignés les uns des autres.",
      "Chaque ER doit être relié à un couple SR/OV et réciproquement ; les OV héritent de la gravité des ER.",
    ],
    source: "Guide p.39-40 ; fiche méthode 4",
  },
  "a3-ecosysteme": {
    title: "Atelier 3 · Cartographie de dangerosité de l'écosystème",
    objective: "Évaluer la dangerosité de chaque partie prenante (exposition : dépendance × pénétration ; fiabilité cyber : maturité × confiance) et sélectionner les parties prenantes critiques.",
    participants: "Métiers, Achats/Juridique, architectes fonctionnels, RSSI",
    outputs: ["Cartographie de dangerosité", "Parties prenantes critiques"],
    tips: [
      "La dangerosité ne préjuge d'aucune intention malveillante : elle mesure la capacité d'une SR à exploiter la relation.",
      "Les PP en zones de danger et de contrôle sont critiques et entrent dans les scénarios stratégiques.",
      "Commencer par les PP de rang 1 ; approfondir au rang 2 (zone de contrôle) ou 3 (zone de danger).",
    ],
    source: "Guide p.44-49 ; fiche méthode 5",
  },
  "a3-scenarios": {
    title: "Atelier 3 · Élaborer les scénarios stratégiques",
    objective: "Pour chaque couple SR/OV retenu, décrire les chemins d'attaque : événements intermédiaires sur l'écosystème puis événements redoutés sur les valeurs métier.",
    participants: "Métiers, architectes fonctionnels, RSSI, spécialiste cyber",
    outputs: ["Scénarios stratégiques et chemins d'attaque", "Gravité des scénarios"],
    tips: [
      "Questions : quelles valeurs métier viser ? quelles PP critiques exploiter ?",
      "1 à 3 chemins par couple suffisent (attaque directe, par rebond, sur PP uniquement).",
      "Raisonner en moindre effort ; ne pas détailler excessivement.",
      "La gravité est celle des ER associés à l'OV.",
    ],
    source: "Guide p.48-52",
  },
  "a3-mesures": {
    title: "Atelier 3 · Mesures de sécurité sur l'écosystème",
    objective: "Réduire la dangerosité des parties prenantes critiques (niveaux cibles de dépendance, pénétration, maturité, confiance) et agir sur le déroulement des scénarios stratégiques.",
    participants: "Direction (arbitrages), RSSI, Achats/Juridique",
    outputs: ["Mesures sur l'écosystème", "Cartographie de dangerosité résiduelle"],
    tips: [
      "Agir en priorité sur le critère le plus pénalisant, le moins coûteux ou le plus efficace au regard des scénarios.",
      "Une mesure ne réduit la dangerosité actuelle que si elle est effectivement mise en œuvre.",
    ],
    source: "Guide p.53-55 ; fiche méthode 6",
  },
  "a4-scenarios": {
    title: "Atelier 4 · Scénarios opérationnels",
    objective: "Décrire les modes opératoires (actions élémentaires sur les biens supports) permettant de réaliser chaque chemin d'attaque, puis évaluer leur vraisemblance.",
    participants: "RSSI, DSI, spécialiste cyber",
    duration: "1 à 3 demi-journées",
    outputs: ["Scénarios opérationnels", "Vraisemblance"],
    tips: [
      "Structurer selon la séquence Connaître / Rentrer / Trouver / Exploiter (ou MITRE ATT&CK).",
      "Le point de départ est accessible par la SR ; l'arrivée a un lien clair avec l'objectif visé.",
      "Stresser les limites et non-conformités du socle de sécurité.",
      "Opérateurs ET / OU entre actions élémentaires.",
    ],
    source: "Guide p.58-68 ; fiches méthodes 7 et 8",
  },
  "a5-synthese": {
    title: "Atelier 5 · Synthèse des scénarios de risque",
    objective: "Positionner les scénarios de risque selon leur gravité et leur vraisemblance (cartographie du risque initial) et vérifier la couverture des événements redoutés.",
    participants: "Direction, Métiers, RSSI, DSI",
    duration: "2 à 4 demi-journées pour l'atelier complet",
    outputs: ["Cartographie du risque initial", "Matrice de couverture ER / risques"],
    tips: [
      "Les risques sont usuellement décrits par leurs scénarios stratégiques.",
      "Identifier les ER graves non couverts : ils peuvent justifier une itération des ateliers 2 à 4.",
    ],
    source: "Guide p.71-73",
  },
  "a5-traitement": {
    title: "Atelier 5 · Stratégie et plan de traitement",
    objective: "Décider de l'acceptabilité de chaque risque, puis définir les mesures (socle, écosystème, scénarios) dans un plan échelonné : responsable, freins, coût, échéance, priorité, statut.",
    participants: "Direction, Métiers, RSSI, DSI",
    outputs: ["Stratégie de traitement", "Plan de traitement du risque"],
    tips: [
      "Sécuriser en priorité les actions élémentaires les plus vraisemblables et les nœuds par lesquels passe la SR.",
      "Structurer les mesures : gouvernance, protection, défense, résilience ; actions SMART.",
    ],
    source: "Guide p.74-78 ; fiche méthode 9",
  },
  "a5-residuels": {
    title: "Atelier 5 · Risques résiduels",
    objective: "Réévaluer gravité et vraisemblance après mesures, documenter chaque risque résiduel et produire la cartographie du risque résiduel (aide à la décision d'acceptation).",
    participants: "Direction, RSSI",
    outputs: ["Cartographie du risque résiduel", "Fiches de risque résiduel"],
    tips: ["Associer une cartographie résiduelle à chaque grand jalon (T0+3 mois, T0+6 mois…).", "Reformuler le risque pour faire apparaître le risque résiduel persistant."],
    source: "Guide p.78-81",
  },
  "a5-suivi": {
    title: "Atelier 5 · Cadre de suivi et surveillance",
    objective: "Définir les indicateurs de pilotage, la gouvernance (comité semestriel en montée en puissance, annuel en rythme de croisière) et les déclencheurs de mise à jour de l'étude.",
    participants: "Direction, RSSI",
    outputs: ["Indicateurs", "Comité de pilotage", "Mécanismes de surveillance"],
    tips: ["Répartir les déclencheurs dans l'organisation (juridique : réglementation ; DSI : vulnérabilités…)."],
    source: "Guide p.81-82",
  },
};
