import type {
  Catalogs,
  Matrix,
  RiskLevelDef,
  ScaleLevel,
  Scales,
  StudyData,
  StudySettings,
} from "./types.js";

export function uid(): string {
  return globalThis.crypto.randomUUID();
}

const L = (value: number, label: string, description = "", color?: string): ScaleLevel =>
  color ? { value, label, description, color } : { value, label, description };

// ─────────────── Échelles (guide p.26, p.66 ; fiches 3, 4, 5, 8) ───────────────

const GRAVITY_5: ScaleLevel[] = [
  L(1, "Mineure", "Conséquences négligeables pour l'organisation. Aucun impact opérationnel ni sur les performances de l'activité ni sur la sécurité des personnes et des biens. L'organisation surmontera la situation sans trop de difficultés (consommation des marges).", "#8bc34a"),
  L(2, "Significative", "Conséquences significatives mais limitées pour l'organisation. Dégradation des performances de l'activité sans impact sur la sécurité des personnes et des biens. L'organisation surmontera la situation malgré quelques difficultés (fonctionnement en mode dégradé).", "#ffc107"),
  L(3, "Grave", "Conséquences importantes pour l'organisation. Forte dégradation des performances de l'activité, avec d'éventuels impacts significatifs sur la sécurité des personnes et des biens. L'organisation surmontera la situation avec de sérieuses difficultés (fonctionnement en mode très dégradé), sans impact sectoriel ou étatique.", "#ff7043"),
  L(4, "Critique", "Conséquences désastreuses pour l'organisation avec d'éventuels impacts sur l'écosystème. Incapacité pour l'organisation d'assurer la totalité ou une partie de son activité, avec d'éventuels impacts graves sur la sécurité des personnes et des biens. L'organisation ne surmontera vraisemblablement pas la situation (sa survie est menacée).", "#d32f2f"),
  L(5, "Catastrophique", "Conséquences sectorielles ou régaliennes au-delà de l'organisation. Écosystème(s) sectoriel(s) impacté(s) de façon importante, avec des conséquences éventuellement durables. Et/ou : difficulté pour l'État, voire incapacité, d'assurer une fonction régalienne ou une de ses missions d'importance vitale. Et/ou : impacts critiques sur la sécurité des personnes et des biens.", "#6a1b1a"),
];

const LIKELIHOOD_5: ScaleLevel[] = [
  L(0, "Invraisemblable", "La source de risque a très peu de chances d'atteindre son objectif visé en empruntant l'un des modes opératoires envisagés. La vraisemblance du scénario de risque est très faible.", "#b3e5fc"),
  L(1, "Peu vraisemblable", "La source de risque a relativement peu de chances d'atteindre son objectif en empruntant l'un des modes opératoires envisagés. La vraisemblance du scénario de risque est faible.", "#81d4fa"),
  L(2, "Vraisemblable", "La source de risque est susceptible d'atteindre son objectif en empruntant l'un des modes opératoires envisagés. La vraisemblance du scénario de risque est significative.", "#29b6f6"),
  L(3, "Très vraisemblable", "La source de risque va probablement atteindre son objectif en empruntant l'un des modes opératoires envisagés. La vraisemblance du scénario de risque est élevée.", "#0277bd"),
  L(4, "Quasi certain", "La source de risque va très certainement atteindre son objectif en empruntant l'un des modes opératoires envisagés. La vraisemblance du scénario de risque est très élevée.", "#01386b"),
];

const PROBABILITY_5: ScaleLevel[] = [
  L(0, "Très faible", "Probabilité de succès très faible (< 3 %)."),
  L(1, "Faible", "Probabilité de succès faible (< 20 %)."),
  L(2, "Significative", "Probabilité de succès significative (> 20 %)."),
  L(3, "Très élevée", "Probabilité de succès très élevée (> 60 %)."),
  L(4, "Quasi certaine", "Probabilité de succès quasi certaine (> 90 %)."),
];

const DIFFICULTY_5: ScaleLevel[] = [
  L(0, "Négligeable", "Difficulté négligeable, voire nulle : les ressources engagées par l'attaquant seront négligeables ou déjà disponibles."),
  L(1, "Faible", "Difficulté faible : les ressources engagées par l'attaquant seront faibles."),
  L(2, "Modérée", "Difficulté modérée : l'attaquant engagera des ressources significatives pour mener à bien son action."),
  L(3, "Élevée", "Difficulté élevée : l'attaquant engagera des ressources importantes pour mener à bien son action."),
  L(4, "Très élevée", "Difficulté très élevée : l'attaquant engagera des ressources très importantes pour mener à bien son action."),
];

const DIFFICULTY_4: ScaleLevel[] = [
  L(1, "Faible", "Difficulté négligeable à faible : les ressources engagées par l'attaquant seront faibles ou déjà disponibles."),
  L(2, "Modérée", "Difficulté modérée : l'attaquant engagera des ressources significatives pour mener à bien son action."),
  L(3, "Élevée", "Difficulté élevée : l'attaquant engagera des ressources importantes pour mener à bien son action."),
  L(4, "Très élevée", "Difficulté très élevée : l'attaquant engagera des ressources très importantes pour mener à bien son action."),
];

const MOTIVATION: ScaleLevel[] = [
  L(1, "Faible", "La source de risque est peu intéressée par l'objectif visé."),
  L(2, "Significative", "La source de risque est intéressée par l'objectif visé."),
  L(3, "Importante", "La source de risque est très intéressée par l'objectif visé ; elle y consacrera des efforts soutenus."),
  L(4, "Maximale", "La source de risque est fortement déterminée à atteindre l'objectif visé, quel qu'en soit le coût."),
];

const RESOURCES: ScaleLevel[] = [
  L(1, "Faibles", "Ressources financières, compétences et infrastructures d'attaque limitées (outils disponibles en ligne)."),
  L(2, "Significatives", "Ressources et compétences significatives ; capacité à utiliser des outils du marché."),
  L(3, "Importantes", "Ressources importantes, compétences élevées, capacité à développer ses propres outils ou à recourir à des officines."),
  L(4, "Maximales", "Ressources quasi illimitées (acteur étatique), capacité à acquérir ou découvrir des vulnérabilités jour zéro."),
];

const ACTIVITY: ScaleLevel[] = [
  L(1, "Faible", "Aucune attaque connue de cette source de risque dans le secteur ou un secteur similaire."),
  L(2, "Modérée", "Attaques connues dans une industrie similaire."),
  L(3, "Importante", "Attaques connues dans l'industrie ou l'écosystème concernés."),
  L(4, "Forte", "Attaques récentes contre l'objet de l'étude ou son écosystème direct."),
];

const PERTINENCE: ScaleLevel[] = [
  L(1, "Faible", "Couple SR/OV peu pertinent : peut être écarté ou placé en surveillance.", "#9ccc65"),
  L(2, "Moyenne", "Couple SR/OV moyennement pertinent.", "#ffb300"),
  L(3, "Élevée", "Couple SR/OV très pertinent : à retenir en priorité.", "#e53935"),
];

const DEPENDENCY: ScaleLevel[] = [
  L(1, "Non nécessaire", "Pas de lien avec le SI de la partie prenante pour réaliser la mission."),
  L(2, "Utile", "Lien avec le SI de la partie prenante utile à la réalisation de la mission."),
  L(3, "Indispensable non exclusive", "Lien avec le SI de la partie prenante indispensable mais non exclusif (possible substitution)."),
  L(4, "Indispensable et unique", "Lien avec le SI de la partie prenante indispensable et unique (pas de substitution possible)."),
];

const PENETRATION: ScaleLevel[] = [
  L(1, "Accès utilisateur", "Pas d'accès ou accès avec privilèges de type utilisateur à des terminaux utilisateurs (poste de travail, ordiphone, etc.)."),
  L(2, "Admin terminaux / accès physique", "Accès avec privilèges de type administrateur à des terminaux utilisateurs (parc informatique, flotte de terminaux mobiles, etc.) ou accès physique aux bureaux de l'organisme."),
  L(3, "Admin serveurs métier", "Accès avec privilèges de type administrateur à des serveurs « métier » (serveur de fichiers, bases de données, serveur web, serveur d'application, etc.)."),
  L(4, "Admin infrastructure", "Accès avec privilèges de type administrateur à des équipements d'infrastructure (annuaires d'entreprise, DNS, DHCP, commutateurs, pare-feu, hyperviseurs, baies de stockage, etc.) ou accès physique aux salles serveurs de l'organisme."),
];

const MATURITY: ScaleLevel[] = [
  L(1, "Ponctuelle", "Des règles d'hygiène sont appliquées ponctuellement et non formalisées. La capacité de réaction sur incident est incertaine."),
  L(2, "Réactive", "Les règles d'hygiène et la réglementation sont prises en compte, sans intégration dans une politique globale. La sécurité numérique est conduite selon un mode réactif."),
  L(3, "Politique globale", "Une politique globale est appliquée en matière de sécurité numérique. Celle-ci est assurée selon un mode réactif, avec une recherche de centralisation et d'anticipation sur certains risques."),
  L(4, "Proactive", "La partie prenante met en œuvre une politique de management du risque. La politique est intégrée et prend pleinement en compte une dimension proactive."),
];

const TRUST: ScaleLevel[] = [
  L(1, "Inconnues", "Les intentions de la partie prenante ne peuvent être évaluées."),
  L(2, "Neutres", "Les intentions de la partie prenante sont considérées comme neutres."),
  L(3, "Positives", "Les intentions de la partie prenante sont connues et probablement positives."),
  L(4, "Compatibles", "Les intentions de la partie prenante sont parfaitement connues et pleinement compatibles avec celles de l'organisation étudiée."),
];

const RISK_LEVELS: RiskLevelDef[] = [
  { value: 1, label: "Faible", description: "Risque faible.", color: "#43a047", acceptability: "Acceptable en l'état", decision: "Aucune action n'est à entreprendre." },
  { value: 2, label: "Moyen", description: "Risque moyen.", color: "#fb8c00", acceptability: "Tolérable sous contrôle", decision: "Un suivi en termes de gestion du risque est à mener et des actions sont à mettre en place dans le cadre d'une amélioration continue sur le moyen et long terme." },
  { value: 3, label: "Élevé", description: "Risque élevé.", color: "#e53935", acceptability: "Inacceptable", decision: "Des mesures de réduction du risque doivent impérativement être prises à court terme. Dans le cas contraire, tout ou partie de l'activité sera refusé." },
];

const SECURITY_NEEDS: ScaleLevel[] = [
  L(1, "Négligeable", "Besoin de sécurité négligeable."),
  L(2, "Modéré", "Besoin de sécurité modéré."),
  L(3, "Important", "Besoin de sécurité notable."),
  L(4, "Très important", "Besoin de sécurité très important."),
];

function buildMatrix(rows: number[], cols: number[], f: (r: number, c: number) => number): Matrix {
  const m: Matrix = {};
  for (const r of rows) {
    m[String(r)] = {};
    for (const c of cols) m[String(r)][String(c)] = f(r, c);
  }
  return m;
}

/** Fiche 4 : pertinence = f(ressources, motivation). */
const PERTINENCE_TABLE: Record<number, number[]> = {
  4: [2, 2, 3, 3],
  3: [1, 2, 3, 3],
  2: [1, 1, 2, 3],
  1: [1, 1, 2, 2],
};

/** Fiche 8 : vraisemblance = f(probabilité de succès 0..4, difficulté 0..4). */
const CROSS_5: Record<number, number[]> = {
  4: [4, 4, 3, 2, 1],
  3: [4, 3, 3, 2, 1],
  2: [3, 3, 2, 2, 1],
  1: [2, 2, 2, 1, 0],
  0: [1, 1, 1, 0, 0],
};

export function defaultScales(size: 4 | 5): Scales {
  return {
    gravity: size === 5 ? GRAVITY_5 : GRAVITY_5.slice(0, 4),
    likelihood: size === 5 ? LIKELIHOOD_5 : LIKELIHOOD_5.slice(1),
    probability: size === 5 ? PROBABILITY_5 : PROBABILITY_5.slice(1),
    difficulty: size === 5 ? DIFFICULTY_5 : DIFFICULTY_4,
    motivation: MOTIVATION,
    resources: RESOURCES,
    activity: ACTIVITY,
    pertinence: PERTINENCE,
    dependency: DEPENDENCY,
    penetration: PENETRATION,
    maturity: MATURITY,
    trust: TRUST,
    riskLevels: RISK_LEVELS,
    securityNeeds: SECURITY_NEEDS,
  };
}

export function defaultLikelihoodCross(size: 4 | 5): Matrix {
  if (size === 5) return buildMatrix([0, 1, 2, 3, 4], [0, 1, 2, 3, 4], (p, d) => CROSS_5[p][d]);
  // 4 niveaux : on retire la ligne Pr0 et la colonne D0 de la grille de la fiche 8,
  // les valeurs sont bornées à l'échelle V1..V4.
  return buildMatrix([1, 2, 3, 4], [1, 2, 3, 4], (p, d) => Math.max(1, CROSS_5[p][d]));
}

/**
 * Matrice de niveau de risque par défaut : produit G × V comparé à des seuils.
 * En 4 niveaux (G1..G4 × V1..V4) : ≤ 3 Faible, 4–8 Moyen, ≥ 9 Élevé — ce qui reproduit
 * exactement les niveaux R1..R5 de l'exemple du guide (p.72-75).
 */
export function defaultRiskMatrix(size: 4 | 5): Matrix {
  if (size === 4) {
    return buildMatrix([1, 2, 3, 4], [1, 2, 3, 4], (g, v) => {
      const p = g * v;
      return p <= 3 ? 1 : p <= 8 ? 2 : 3;
    });
  }
  return buildMatrix([1, 2, 3, 4, 5], [0, 1, 2, 3, 4], (g, v) => {
    const p = g * (v + 1);
    return p <= 4 ? 1 : p <= 11 ? 2 : 3;
  });
}

export function defaultPertinenceMatrix(): Matrix {
  return buildMatrix([1, 2, 3, 4], [1, 2, 3, 4], (r, m) => PERTINENCE_TABLE[r][m - 1]);
}

// ─────────────── Bases de connaissances (fiches 1, 3, 4, 5, 7, 8) ───────────────

export function defaultCatalogs(): Catalogs {
  return {
    riskSourceCategories: [
      { id: "sr-etat", label: "Organisation étatique", description: "États, agences de renseignement. Opérations offensives longues, outils adaptés à la cible, capacité à acquérir des vulnérabilités jour zéro et à attaquer la chaîne d'approvisionnement." },
      { id: "sr-crime", label: "Organisation criminelle", description: "Mafias, gangs, crime organisé : arnaques, rançongiciels, réseaux de robots, fraude. Opérations de plus en plus sophistiquées à des fins lucratives." },
      { id: "sr-terro", label: "Organisation terroriste", description: "Cyberterroristes, cybermilices : attaques peu sophistiquées mais déterminées, à des fins de déstabilisation et de destruction (déni de service, sabotage)." },
      { id: "sr-concurrent", label: "Concurrent", description: "Concurrents déloyaux, pouvant recourir à des officines : vol d'information ou sabotage pour obtenir un avantage concurrentiel." },
      { id: "sr-activiste", label: "Activiste", description: "Cyber-activistes, groupements d'intérêt, sectes : véhiculer une idéologie ou un message, modes opératoires proches des cyberterroristes." },
      { id: "sr-officine", label: "Officine spécialisée", description: "Hackers chevronnés organisés en officines proposant des services de piratage, conception d'outils et kits d'attaque ; motivation financière." },
      { id: "sr-amateur", label: "Amateur", description: "Script-kiddies ou hackers doués, en quête de reconnaissance, d'amusement ou de défi ; attaques basiques avec des kits en ligne." },
      { id: "sr-collaborateur", label: "Collaborateur", description: "Collaborateur actuel ou passé : connaissance interne des systèmes et processus, pouvoir de nuisance important." },
      { id: "sr-tiers", label: "Tiers opportuniste", description: "Client malhonnête, escroc, fraudeur : découvre fortuitement une vulnérabilité et tente de l'exploiter." },
    ],
    targetObjectiveCategories: [
      { id: "ov-espionnage", label: "Espionnage", description: "Opération de renseignement (étatique, économique), souvent installée durablement et discrètement dans le SI." },
      { id: "ov-prepositionnement", label: "Prépositionnement stratégique", description: "Prépositionnement en vue d'une attaque à long terme, sans finalité clairement établie (ex. compromission d'opérateurs, constitution de réseaux de robots)." },
      { id: "ov-influence", label: "Influence", description: "Diffuser de fausses informations, détruire des réputations, divulguer des informations confidentielles : déstabilisation ou modification des perceptions." },
      { id: "ov-entrave", label: "Entrave au fonctionnement", description: "Sabotage : rendre indisponible un service, une ressource numérique ou une installation physique (DDoS, commandes industrielles malveillantes)." },
      { id: "ov-lucratif", label: "Lucratif", description: "Gain financier direct ou indirect : escroquerie, extorsion, rançongiciel, fraude, usurpation d'identité." },
      { id: "ov-defi", label: "Défi, amusement", description: "Réaliser un exploit à des fins de reconnaissance sociale, de défi ou d'amusement." },
    ],
    stakeholderCategories: [
      { id: "pp-clients", label: "Clients", internal: false },
      { id: "pp-partenaires", label: "Partenaires, cotraitants", internal: false },
      { id: "pp-prestataires", label: "Prestataires (sous-traitants, fournisseurs)", internal: false },
      { id: "pp-services-techniques", label: "Services connexes techniques", internal: true, description: "Ex. services supports proposés par une DSI." },
      { id: "pp-services-metier", label: "Services connexes métier", internal: true, description: "Ex. entité commerciale utilisatrice des données métier." },
      { id: "pp-filiales", label: "Filiales", internal: true },
    ],
    impactCategories: [
      { id: "imp-missions", label: "Missions et services de l'organisation" },
      { id: "imp-humains", label: "Humains, matériels ou environnementaux" },
      { id: "imp-gouvernance", label: "Gouvernance" },
      { id: "imp-financiers", label: "Financiers" },
      { id: "imp-juridiques", label: "Juridiques" },
      { id: "imp-image", label: "Image et confiance" },
    ],
    supportingAssetTypes: [
      { id: "bs-terminal", group: "Matériels", label: "Terminal utilisateur", description: "Ordinateur fixe, portable, tablette, téléphone mobile." },
      { id: "bs-peripherique", group: "Matériels", label: "Périphérique", description: "Imprimante, scanner, caméra, objet connecté." },
      { id: "bs-telephone", group: "Matériels", label: "Téléphone", description: "Téléphone fixe ou mobile analogique ou IP." },
      { id: "bs-stockage", group: "Matériels", label: "Équipement de stockage", description: "Clé USB, disque dur, carte mémoire." },
      { id: "bs-serveur", group: "Matériels", label: "Serveur", description: "Mainframe, serveur lame, serveur rack." },
      { id: "bs-admin", group: "Matériels", label: "Moyen d'administration", description: "Poste d'administration, bastion." },
      { id: "bs-reseau", group: "Matériels", label: "Équipement réseau", description: "Commutateur, routeur, passerelle, borne Wi-Fi." },
      { id: "bs-securite", group: "Matériels", label: "Équipement de sécurité", description: "Pare-feu, sonde IDS/IPS, passerelle VPN." },
      { id: "bs-industriel", group: "Matériels", label: "Équipement industriel", description: "Automate, capteur, actionneur, SCADA, système instrumenté de sécurité." },
      { id: "bs-infra", group: "Logiciels", label: "Service d'infrastructure", description: "Annuaire, DHCP, DNS, contrôleur de domaine, serveur d'impression." },
      { id: "bs-application", group: "Logiciels", label: "Application / service applicatif", description: "Serveur web, messagerie, base de données, progiciels (RH, CRM, ERP)." },
      { id: "bs-middleware", group: "Logiciels", label: "Intergiciel (middleware)", description: "EAI, ETL, ODBC." },
      { id: "bs-os", group: "Logiciels", label: "Système d'exploitation, hyperviseur", description: "Windows, Linux, macOS, Xen." },
      { id: "bs-firmware", group: "Logiciels", label: "Microgiciel (firmware)", description: "BIOS, UEFI, firmware de téléphone ou de clé USB." },
      { id: "bs-logiciel-securite", group: "Logiciels", label: "Logiciel de sécurité", description: "SIEM, EDR, antivirus." },
      { id: "bs-canal-info", group: "Réseaux / canaux", label: "Réseau / canal informatique", description: "Câble réseau, fibre optique, liaison radio (Wi-Fi, Bluetooth)." },
      { id: "bs-canal-tel", group: "Réseaux / canaux", label: "Réseau / canal téléphonique", description: "Ligne téléphonique." },
      { id: "bs-personne", group: "Organisations", label: "Personne", description: "Employé, stagiaire, prestataire, personnel d'entretien." },
      { id: "bs-papier", group: "Organisations", label: "Support papier", description: "Document manuscrit ou imprimé." },
      { id: "bs-verbal", group: "Organisations", label: "Échange verbal", description: "Réunion, échange informel." },
      { id: "bs-social", group: "Organisations", label: "Élément d'ingénierie sociale", description: "Information partagée sur les réseaux sociaux." },
      { id: "bs-site", group: "Locaux et installations", label: "Site / bâtiment / salle", description: "Siège, usine, site de stockage, salle serveur." },
      { id: "bs-surete", group: "Locaux et installations", label: "Système de sécurité physique", description: "Contrôle d'accès par badge, détection d'intrusion, vidéoprotection." },
      { id: "bs-fonctionnement", group: "Locaux et installations", label: "Système de sûreté de fonctionnement", description: "Climatisation, sécurité incendie, alimentation électrique." },
    ],
    attackPhases: [
      { id: "ph-connaitre", label: "Connaître", color: "#5c6bc0", description: "Ciblage, reconnaissance et découverte externes : cartographie de l'écosystème, recherche d'informations sur les personnes et systèmes clés, recherche de vulnérabilités." },
      { id: "ph-rentrer", label: "Rentrer", color: "#26a69a", description: "Intrusion numérique ou physique, directe dans le SI de la cible ou dans celui de son écosystème (attaque par rebond), généralement via des biens supports périmétriques exposés." },
      { id: "ph-trouver", label: "Trouver", color: "#ffa726", description: "Reconnaissance interne, latéralisation, élévation de privilèges et persistance pour localiser les données et biens supports recherchés, en restant discret." },
      { id: "ph-exploiter", label: "Exploiter", color: "#ef5350", description: "Exploitation des données et biens supports trouvés : déclenchement d'une charge (sabotage), recueil et exfiltration discrète (espionnage), rançongiciel, etc." },
    ],
    elementaryActions: defaultElementaryActions(),
    cotationHints: defaultCotationHints(),
  };
}

function defaultElementaryActions() {
  const rows: [string, string, string][] = [
    ["ph-connaitre", "Reconnaissance externe de la cible", "Reconnaissance externe via sources ouvertes (sites, réseaux sociaux, forums)"],
    ["ph-connaitre", "Reconnaissance externe de la cible", "Reconnaissance externe avancée (officines, sources non ouvertes)"],
    ["ph-connaitre", "Reconnaissance externe de la cible", "Approche directe (faux client, faux journaliste, anciens salariés)"],
    ["ph-connaitre", "Reconnaissance externe de la cible", "Collecte lors de salons et forums professionnels"],
    ["ph-connaitre", "Reconnaissance externe de la cible", "Interception de communications (renseignement d'origine électromagnétique)"],
    ["ph-connaitre", "Recrutement d'une source, corruption de personnel", "Corruption ou recrutement d'un membre du personnel (leviers MICE)"],
    ["ph-connaitre", "Recrutement d'une source, corruption de personnel", "Corruption d'un prestataire ayant accès aux locaux ou au SI"],
    ["ph-rentrer", "Intrusion depuis Internet ou des réseaux tiers", "Attaque directe d'un service exposé sur Internet"],
    ["ph-rentrer", "Intrusion depuis Internet ou des réseaux tiers", "Courriel d'hameçonnage ou de harponnage (spear phishing)"],
    ["ph-rentrer", "Intrusion depuis Internet ou des réseaux tiers", "Attaque par point d'eau (watering hole)"],
    ["ph-rentrer", "Intrusion depuis Internet ou des réseaux tiers", "Piégeage d'une mise à jour a priori légitime"],
    ["ph-rentrer", "Intrusion depuis Internet ou des réseaux tiers", "Intrusion par rebond depuis le SI d'une partie prenante"],
    ["ph-rentrer", "Intrusion depuis Internet ou des réseaux tiers", "Exploitation d'un canal d'accès préexistant (porte dérobée, télémaintenance)"],
    ["ph-rentrer", "Intrusion ou piège physique", "Utilisation d'identifiants de connexion dérobés"],
    ["ph-rentrer", "Intrusion ou piège physique", "Clé USB ou support amovible piégé"],
    ["ph-rentrer", "Intrusion ou piège physique", "Connexion d'un matériel externe au réseau"],
    ["ph-rentrer", "Intrusion ou piège physique", "Intrusion via un réseau sans fil mal sécurisé"],
    ["ph-rentrer", "Intrusion ou piège physique", "Piégeage d'un matériel via la chaîne d'approvisionnement"],
    ["ph-rentrer", "Intrusion ou piège physique", "Utilisation abusive de moyens d'accès légitimes"],
    ["ph-rentrer", "Intrusion ou piège physique", "Vol d'un terminal nomade (portable, téléphone professionnel)"],
    ["ph-trouver", "Reconnaissance interne", "Cartographie des réseaux et systèmes (scan réseau)"],
    ["ph-trouver", "Reconnaissance interne", "Cartographie avancée (dump mémoire)"],
    ["ph-trouver", "Reconnaissance interne", "Recherche de vulnérabilités internes"],
    ["ph-trouver", "Reconnaissance interne", "Accès à des données système critiques (plan d'adressage, coffres-forts, mots de passe)"],
    ["ph-trouver", "Reconnaissance interne", "Localisation des services, bases de données et biens supports d'intérêt"],
    ["ph-trouver", "Reconnaissance interne", "Dissimulation des traces"],
    ["ph-trouver", "Latéralisation et élévation de privilèges", "Exploitation de vulnérabilités logicielles ou protocolaires"],
    ["ph-trouver", "Latéralisation et élévation de privilèges", "Abus de droits sur des comptes clés (utilisateurs, administrateurs, machines)"],
    ["ph-trouver", "Latéralisation et élévation de privilèges", "Force brute, pass-the-hash, extraction d'empreintes"],
    ["ph-trouver", "Latéralisation et élévation de privilèges", "Latéralisation vers le réseau cible"],
    ["ph-trouver", "Latéralisation et élévation de privilèges", "Établissement d'une persistance"],
    ["ph-exploiter", "Pilotage et exploitation — espionnage", "Création et maintien d'un canal d'exfiltration"],
    ["ph-exploiter", "Pilotage et exploitation — espionnage", "Exfiltration de données"],
    ["ph-exploiter", "Pilotage et exploitation — espionnage", "Observation ou écoute passive à distance"],
    ["ph-exploiter", "Pilotage et exploitation — espionnage", "Interception de signaux parasites compromettants (TEMPEST)"],
    ["ph-exploiter", "Pilotage et exploitation — entrave au fonctionnement", "Déni de service distribué (DDoS)"],
    ["ph-exploiter", "Pilotage et exploitation — entrave au fonctionnement", "Atteinte à l'intégrité d'un bien support ou d'une donnée (effacement, chiffrement, altération)"],
    ["ph-exploiter", "Pilotage et exploitation — entrave au fonctionnement", "Brouillage d'un bien support"],
    ["ph-exploiter", "Pilotage et exploitation — entrave au fonctionnement", "Leurre d'un bien support"],
    ["ph-exploiter", "Pilotage et exploitation — entrave au fonctionnement", "Envoi de commandes à risque sur un système industriel"],
    ["ph-exploiter", "Pilotage et exploitation — lucratif", "Rançongiciel"],
    ["ph-exploiter", "Pilotage et exploitation — lucratif", "Modification frauduleuse d'une base de données"],
    ["ph-exploiter", "Pilotage et exploitation — lucratif", "Détournement d'usage d'une application métier"],
    ["ph-exploiter", "Pilotage et exploitation — lucratif", "Usurpation d'identité (abus de droits)"],
    ["ph-exploiter", "Pilotage et exploitation — lucratif", "Détournement ou extorsion d'argent"],
    ["ph-exploiter", "Pilotage et exploitation — influence", "Défiguration de site Internet"],
    ["ph-exploiter", "Pilotage et exploitation — influence", "Diffusion de messages via un canal d'information compromis"],
    ["ph-exploiter", "Pilotage et exploitation — influence", "Usurpation d'identité (atteinte à la réputation)"],
  ];
  return rows.map(([phaseId, category, label], i) => ({ id: `ae-${i + 1}`, phaseId, category, label }));
}

function defaultCotationHints() {
  return [
    { id: "ch-recrutement", category: "Recrutement d'une source, corruption de personnel", criteria: [
      "Nombre de cibles potentielles ayant accès aux informations visées, aux biens supports critiques ou à leur environnement physique.",
      "Personnels, prestataires ou fournisseurs susceptibles d'être animés par un esprit de vengeance (ex. salarié licencié récemment).",
      "Personnels ayant fait l'objet d'une habilitation de sécurité ou d'une enquête.",
      "Satisfaction des cibles à l'égard de leur salaire ou de leur considération ; adhésion aux valeurs de l'entreprise.",
    ] },
    { id: "ch-reco-ext", category: "Reconnaissance externe de la cible", criteria: [
      "Informations sur l'entité et son écosystème facilement accessibles sur Internet (sites, forums, réseaux socioprofessionnels).",
      "Participation régulière de l'entité, de ses partenaires ou d'anciens salariés à des salons ou forums.",
      "Usage du chiffrement dans les relations avec l'extérieur.",
      "Compétences particulières nécessaires pour rechercher les informations compte tenu du domaine d'activité.",
    ] },
    { id: "ch-frontale", category: "Intrusion — attaque frontale de services", criteria: [
      "Nombre de services ou d'applications exposés sur Internet.",
      "Services exposés homologués ou développés selon un processus intégrant la sécurité.",
      "Technologies de filtrage (reverse proxy, WAF).",
      "Biens supports « de frontière » certifiés ou qualifiés.",
    ] },
    { id: "ch-phishing", category: "Intrusion — hameçonnage / point d'eau", criteria: [
      "Nombre d'utilisateurs susceptibles d'être visés.",
      "Utilisateurs régulièrement sensibilisés et entraînés.",
      "Filtre anti-spam performant.",
      "Filtrage de la navigation Internet (proxy, IPS), filtrage par liste blanche.",
    ] },
    { id: "ch-wifi", category: "Intrusion via un réseau sans fil", criteria: [
      "Existence de réseaux Wi-Fi dans l'environnement bureautique ou industriel.",
      "Accès Wi-Fi sécurisés selon les recommandations de l'ANSSI.",
    ] },
    { id: "ch-maj", category: "Intrusion via un logiciel ou un correctif légitime", criteria: [
      "Politique de sécurité relative aux mises à jour (sas antivirus, contrôle d'intégrité des correctifs).",
      "Sources et canaux de confiance, vérification des signataires.",
    ] },
    { id: "ch-physique", category: "Intrusion ou piège physique", criteria: [
      "Maîtrise des interventions des prestataires (accès aux locaux, supervision, journalisation, horaires).",
      "Habilitation ou enquête pour les prestataires intervenant sur site.",
      "Matériels d'intervention fournis par l'organisation (valise de maintenance, clé USB de firmware).",
      "Nombre et accessibilité des points de connexion physique et logique ; liens de télémaintenance.",
      "Politique de sécurité de la chaîne d'approvisionnement ; sécurité de la maintenance.",
      "Contrôle d'accès physique, supervision, réactivité des équipes, nombre de barrières (au moins trois recommandées).",
      "Sensibilisation des personnels aux intrusions physiques et aux déplacements professionnels.",
    ] },
    { id: "ch-laterale", category: "Reconnaissance interne, latéralisation et élévation de privilèges", criteria: [
      "Utilisateurs administrateurs de leur poste.",
      "Gestion des profils et des droits, principe du moindre privilège.",
      "Administration depuis des machines dédiées sans accès à Internet.",
      "Existence d'un centre de supervision de la sécurité (SOC).",
      "Politique d'authentification (authentification forte, mots de passe robustes).",
      "Cloisonnement des réseaux par domaines de confiance ; administration sécurisée.",
      "Hétérogénéité du parc et nombre de services offerts (surface d'attaque).",
      "Facilité d'accès aux données critiques (en clair et centralisées, dispersées, chiffrées).",
    ] },
    { id: "ch-exploitation", category: "Pilotage et exploitation de l'attaque", criteria: [
      "Nature du canal de pilotage ou d'exfiltration nécessaire (préexistant, synchrone, asynchrone, physique).",
      "Existence d'un SOC ; dispositif anti-DDoS ; prise en compte de la menace TEMPEST.",
      "Contraintes de temps pour l'exploitation (aucune, timing précis, coordination sans Internet).",
    ] },
    { id: "ch-outils", category: "Outils malveillants", criteria: [
      "Type et ancienneté des technologies ciblées (développement ou acquisition d'outils spécifiques).",
      "Délai d'application des correctifs de sécurité (fenêtre d'exploitation de vulnérabilités publiques).",
    ] },
  ];
}

export function defaultSettings(size: 4 | 5 = 4): StudySettings {
  return {
    scaleSize: size,
    scales: defaultScales(size),
    pertinenceMatrix: defaultPertinenceMatrix(),
    useActivityInPertinence: false,
    likelihoodCross: defaultLikelihoodCross(size),
    riskMatrix: defaultRiskMatrix(size),
    likelihoodMethod: "standard",
    longChainThreshold: 0,
    dangerosity: {
      weights: { dependency: 1, penetration: 1, maturity: 1, trust: 1 },
      thresholds: { watch: 0.2, control: 0.9, danger: 2.5 },
    },
    catalogs: defaultCatalogs(),
  };
}

export function emptyStudy(size: 4 | 5 = 4): StudyData {
  return {
    schemaVersion: 1,
    settings: defaultSettings(size),
    framing: {
      subject: "",
      purpose: "complete",
      objectives: "",
      participants: [],
      raci: { "1": {}, "2": {}, "3": {}, "4": {}, "5": {} },
      riskOwnerId: null,
      strategicCycleMonths: 36,
      operationalCycleMonths: 12,
      assumptions: "",
      constraints: "",
      meetings: [],
      workshopsEnabled: { 1: true, 2: true, 3: true, 4: true, 5: true },
    },
    missions: [],
    businessValues: [],
    supportingAssets: [],
    fearedEvents: [],
    baseline: { referentials: [], decision: "undecided", decisionComment: "" },
    riskSources: [],
    srovPairs: [],
    stakeholders: [],
    strategicScenarios: [],
    operationalScenarios: [],
    risks: [],
    measures: [],
    monitoring: {
      indicators: [
        { id: uid(), name: "Comités de pilotage tenus aux échéances prévues", target: "100 %", current: "", frequency: "Semestrielle", owner: "" },
        { id: uid(), name: "Pourcentage de mesures passées de « À lancer » à « En cours » ou « Terminé »", target: "", current: "", frequency: "Trimestrielle", owner: "" },
        { id: uid(), name: "Budget consommé par les mesures", target: "", current: "", frequency: "Trimestrielle", owner: "" },
        { id: uid(), name: "Nombre d'écarts du socle de sécurité réduits", target: "", current: "", frequency: "Semestrielle", owner: "" },
      ],
      committeeFrequencyMonths: 6,
      nextCommitteeDate: "",
      committeeMembers: "",
      triggers: [
        { id: uid(), description: "Émergence d'une nouvelle menace ou d'un nouveau mode opératoire (veille CERT-FR)", owner: "RSSI" },
        { id: uid(), description: "Évolution significative de l'écosystème ou de l'objet de l'étude", owner: "" },
        { id: uid(), description: "Apparition de nouvelles vulnérabilités sur les biens supports", owner: "DSI" },
        { id: uid(), description: "Évolution réglementaire", owner: "Service juridique" },
        { id: uid(), description: "Incident de sécurité significatif", owner: "RSSI" },
      ],
      notes: "",
    },
  };
}

export const PURPOSES: { id: string; label: string; workshops: number[] }[] = [
  { id: "baseline", label: "Identifier le socle de sécurité adapté à l'objet de l'étude", workshops: [1] },
  { id: "compliance", label: "Être en conformité avec les référentiels de sécurité numérique", workshops: [1, 5] },
  { id: "ecosystem_threat", label: "Évaluer le niveau de menace de l'écosystème vis-à-vis de l'objet de l'étude", workshops: [3] },
  { id: "high_level_scenarios", label: "Identifier et analyser les scénarios de haut niveau, intégrant l'écosystème", workshops: [2, 3] },
  { id: "preliminary", label: "Réaliser une étude préliminaire de risque pour identifier les axes prioritaires d'amélioration", workshops: [1, 2, 3, 5] },
  { id: "complete", label: "Conduire une étude de risque complète et fine (ex. homologation, produit de sécurité)", workshops: [1, 2, 3, 4, 5] },
  { id: "audit", label: "Orienter un audit de sécurité et notamment un test d'intrusion", workshops: [2, 3, 4] },
  { id: "soc", label: "Orienter les dispositifs de détection et de réaction (SOC)", workshops: [2, 3, 4] },
];
