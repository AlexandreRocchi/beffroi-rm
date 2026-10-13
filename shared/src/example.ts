/**
 * Exemple fil rouge du guide EBIOS RM v1.5 : société de biotechnologie fabriquant des vaccins.
 * Les données reprennent le guide (p.13-81), la fiche méthode 5 (cotation des parties
 * prenantes) et la fiche méthode 8 (graphe d'attaque coté). Les compléments nécessaires au
 * déroulé complet (graphes des scénarios 2 à 5, difficultés techniques) sont cohérents avec
 * les vraisemblances globales données par le guide (p.67).
 */
import { emptyStudy, uid } from "./defaults.js";
import { REFERENTIAL_LIBRARY, instantiateReferential } from "./library.js";
import type {
  AttackPath,
  Criteria,
  GraphEdge,
  GraphNode,
  Measure,
  OperationalScenario,
  PathStep,
  Stakeholder,
  StudyData,
} from "./types.js";

const P = (s: string) => `<p>${s}</p>`;

export function exampleStudy(): StudyData {
  const d = emptyStudy(4);

  // ───────── Atelier 1 : cadre ─────────
  const people = [
    ["Directrice générale", "Direction"],
    ["RSSI", "RSSI"],
    ["DSI", "DSI"],
    ["Pharmacien responsable R&D", "Métier"],
    ["Responsable production", "Métier"],
    ["Responsable qualité", "Métier"],
    ["Analyste menace (prestataire)", "Spécialiste Threat Intel"],
    ["Architecte SI", "Architecte fonctionnel"],
  ].map(([name, role]) => ({ id: uid(), name, role, organisation: role.startsWith("Analyste") ? "Prestataire" : "BioTech" }));
  const [dg, rssi, dsi, rd, prod, qual, cti, archi] = people;
  d.framing = {
    ...d.framing,
    subject: "Société de biotechnologie fabriquant des vaccins (exemple du guide EBIOS RM)",
    purpose: "complete",
    objectives: P("Mettre en place un processus de management du risque numérique au sein de la société et identifier les axes prioritaires d'amélioration de la sécurité.") +
      "<ul><li>Niveau de maturité estimé faible en matière de sécurité du numérique</li><li>Sensibilisation basique à la prise de poste</li><li>Existence d'une charte informatique</li></ul>",
    participants: people,
    raci: {
      "1": { [dg.id]: "A", [rssi.id]: "R", [dsi.id]: "C", [rd.id]: "C", [prod.id]: "C", [qual.id]: "C" },
      "2": { [dg.id]: "A", [rssi.id]: "R", [rd.id]: "C", [cti.id]: "C" },
      "3": { [rssi.id]: "R", [archi.id]: "C", [rd.id]: "C", [dg.id]: "I" },
      "4": { [rssi.id]: "R", [dsi.id]: "C", [cti.id]: "C" },
      "5": { [dg.id]: "A", [rssi.id]: "R", [dsi.id]: "C", [rd.id]: "I", [prod.id]: "I", [qual.id]: "I" },
    },
    riskOwnerId: dg.id,
    strategicCycleMonths: 36,
    operationalCycleMonths: 12,
    assumptions: P("L'étude se concentre dans un premier temps sur les parties prenantes externes de l'écosystème."),
    constraints: P("Disponibilité limitée des équipes de production pendant la campagne de vaccination."),
    meetings: [
      { id: uid(), workshop: 1, date: "2026-01-12", title: "Atelier 1 — cadrage et socle", notes: "" },
      { id: uid(), workshop: 2, date: "2026-01-26", title: "Atelier 2 — sources de risque", notes: "" },
      { id: uid(), workshop: 3, date: "2026-02-09", title: "Atelier 3 — scénarios stratégiques", notes: "" },
      { id: uid(), workshop: 4, date: "2026-02-23", title: "Atelier 4 — scénarios opérationnels", notes: "" },
      { id: uid(), workshop: 5, date: "2026-03-09", title: "Atelier 5 — traitement du risque", notes: "" },
    ],
  };

  // ───────── Atelier 1 : périmètre ─────────
  const mission = { id: uid(), ref: "MI1", name: "Identifier et fabriquer des vaccins", description: "" };
  d.missions = [mission];
  const vm = (ref: string, name: string, nature: "process" | "information", description: string, owner: string, needs: [number, number, number, number]) => ({
    id: uid(), ref, name, nature, description: P(description), owner, ownerType: "internal" as const, missionIds: [mission.id],
    needs: { D: needs[0], I: needs[1], C: needs[2], T: needs[3] },
  });
  const vmRD = vm("VM1", "Recherche & développement (R&D)", "process", "Activité de recherche et développement des vaccins nécessitant : l'identification des antigènes ; la production des antigènes (fermentation, purification, inactivation, filtration, stockage) ; l'évaluation préclinique ; le développement clinique.", "Pharmacien", [2, 4, 4, 3]);
  const vmFab = vm("VM2", "Fabriquer des vaccins", "process", "Activité consistant à réaliser le remplissage de seringues (stérilisation, remplissage, étiquetage) et le conditionnement (étiquetage et emballage).", "Responsable production", [4, 4, 3, 3]);
  const vmTrace = vm("VM3", "Traçabilité et contrôle", "information", "Informations permettant d'assurer le contrôle qualité et la libération de lot (antigène, répartition aseptique, conditionnement, libération finale…).", "Responsable qualité", [3, 4, 2, 4]);
  d.businessValues = [vmRD, vmFab, vmTrace];

  const bs = (ref: string, name: string, typeId: string, description: string, owner: string, ownerType: "internal" | "external", bvs: string[]) => ({
    id: uid(), ref, name, typeId, description: P(description), owner, ownerType, businessValueIds: bvs,
  });
  const bsSrvInt = bs("BS1", "Serveurs bureautiques (internes)", "bs-serveur", "Serveurs bureautiques permettant de stocker l'ensemble des données de R&D et des données de traçabilité et de contrôle.", "DSI", "internal", [vmRD.id, vmTrace.id]);
  const bsSrvExt = bs("BS2", "Serveurs bureautiques (externes)", "bs-serveur", "Serveurs bureautiques permettant de stocker une partie des données de R&D.", "Laboratoires", "external", [vmRD.id]);
  const bsAntigen = bs("BS3", "Systèmes de production des antigènes", "bs-industriel", "Ensemble de machines et équipements informatiques permettant de produire des antigènes.", "Laboratoires", "external", [vmRD.id]);
  const bsProd = bs("BS4", "Systèmes de production", "bs-industriel", "Ensemble de machines et équipements informatiques permettant de fabriquer des vaccins à grande échelle.", "DSI + fournisseurs de matériel", "internal", [vmFab.id]);
  const bsPosteRD = bs("BS5", "Postes de travail R&D", "bs-terminal", "Postes de travail de l'équipe R&D (ports USB sans restriction).", "DSI", "internal", [vmRD.id]);
  const bsMail = bs("BS6", "Messagerie (service RH)", "bs-application", "Service de messagerie, notamment utilisé par le service des ressources humaines.", "DSI", "internal", [vmRD.id, vmFab.id]);
  const bsCE = bs("BS7", "Site Internet du comité d'entreprise", "bs-application", "Site du comité d'entreprise, facilement accessible depuis Internet et consulté par les salariés.", "Comité d'entreprise", "external", []);
  const bsLan = bs("BS8", "Réseaux bureautique et IT (site de Paris)", "bs-canal-info", "Réseaux internes non cloisonnés, administrés depuis des postes connectés à Internet.", "DSI", "internal", [vmRD.id, vmTrace.id]);
  const bsPersRD = bs("BS9", "Personnel de l'équipe R&D", "bs-personne", "Chercheurs et techniciens de l'équipe R&D.", "Pharmacien", "internal", [vmRD.id]);
  const bsPersEntretien = bs("BS10", "Personnel d'entretien des locaux", "bs-personne", "Personnel du prestataire d'entretien, intervenant hors heures ouvrées avec accès libre au bureau d'études.", "Services généraux", "internal", [vmRD.id]);
  const bsInternet = bs("BS11", "Poste connecté à Internet", "bs-terminal", "Poste disposant d'un accès Internet direct, utilisable comme canal de sortie.", "DSI", "internal", [vmRD.id]);
  const bsEtiquetage = bs("BS12", "Système d'étiquetage", "bs-application", "Application de gestion de l'étiquetage des vaccins.", "Responsable production", "internal", [vmFab.id]);
  d.supportingAssets = [bsSrvInt, bsSrvExt, bsAntigen, bsProd, bsPosteRD, bsMail, bsCE, bsLan, bsPersRD, bsPersEntretien, bsInternet, bsEtiquetage];

  // ───────── Atelier 1 : événements redoutés (guide p.27) ─────────
  const er = (ref: string, bv: string, name: string, criteria: ("D" | "I" | "C" | "T")[], impacts: string[], gravity: number, justification: string) => ({
    id: uid(), ref, businessValueId: bv, name, criteria, impactCategoryIds: impacts, impacts: "", gravity, justification: P(justification), expressLikelihood: null,
  });
  const er1 = er("ER1", vmRD.id, "Perte ou destruction des informations d'études et recherches conduisant à un fort impact, notamment sur les futures autorisations de mise sur le marché", ["D", "I"], ["imp-missions", "imp-financiers", "imp-gouvernance"], 3, "Impact majeur sur les autorisations de mise sur le marché et les coûts de développement.");
  const er2 = er("ER2", vmRD.id, "Altération des informations d'études et recherches aboutissant à une formule de vaccin erronée", ["I"], ["imp-humains", "imp-image", "imp-juridiques"], 3, "Formule erronée détectée lors des phases cliniques, avant mise sur le marché.");
  const er3 = er("ER3", vmRD.id, "Fuite des informations d'études et recherches de l'entreprise", ["C"], ["imp-gouvernance", "imp-financiers"], 3, "Perte d'avantage concurrentiel sur un vaccin en compétition acharnée.");
  const er4 = er("ER4", vmRD.id, "Interruption des phases de tests des vaccins pendant plus d'une semaine", ["D"], ["imp-missions", "imp-financiers"], 2, "Retard rattrapable sur le calendrier des essais.");
  const er5 = er("ER5", vmFab.id, "Fuite du savoir-faire de l'entreprise concernant le processus de fabrication des vaccins et de leurs tests qualité", ["C"], ["imp-financiers"], 2, "Savoir-faire partiellement public.");
  const er6 = er("ER6", vmFab.id, "Interruption de la production ou de la distribution de vaccins pendant plus d'une semaine pendant un pic d'épidémie", ["D"], ["imp-humains", "imp-image", "imp-financiers"], 4, "Cas le plus défavorable : pic d'épidémie ; atteinte à la santé publique et à la survie de la société.");
  const er7 = er("ER7", vmTrace.id, "Altération des résultats des contrôles qualité aboutissant à une non-conformité sanitaire", ["I", "T"], ["imp-humains", "imp-image", "imp-juridiques", "imp-financiers"], 4, "Risque sanitaire pour les patients et retrait des autorisations.");
  d.fearedEvents = [er1, er2, er3, er4, er5, er6, er7];

  // ───────── Atelier 1 : socle (guide p.30) ─────────
  const hyg = instantiateReferential(REFERENTIAL_LIBRARY[0]);
  const r8 = hyg.requirements[7];
  r8.status = "partial";
  r8.gap = "Existence d'un compte admin non nominatif pour l'administration de l'ERP";
  r8.justification = P("Solution propriétaire ne permettant pas l'administration par un autre compte.");
  const r37 = hyg.requirements[36];
  r37.status = "partial";
  r37.gap = "Politique de sauvegarde en cours de rédaction";
  r37.justification = P("Politique de sauvegarde en cours de rédaction par un groupe de travail.");
  const statuses: Record<number, "applied" | "partial" | "not_applied"> = {
    0: "not_applied", 1: "partial", 2: "not_applied", 3: "partial", 9: "applied", 13: "partial", 14: "not_applied",
    18: "not_applied", 21: "applied", 23: "partial", 25: "applied", 26: "not_applied", 27: "not_applied", 33: "not_applied", 35: "partial",
  };
  for (const [i, s] of Object.entries(statuses)) hyg.requirements[Number(i)].status = s;
  hyg.requirements[18].gap = "Réseaux internes non cloisonnés (R&D, bureautique, production)";
  hyg.requirements[33].gap = "Maintien en condition de sécurité quasi inexistant ; retard d'application des correctifs";
  hyg.requirements[14].gap = "Ports USB sans restriction sur les postes R&D";
  d.baseline = {
    referentials: [hyg],
    decision: "continue",
    decisionComment: P("Poursuite de l'étude en considérant les non-conformités : les scénarios de risque exploiteront les fragilités du socle."),
  };

  // ───────── Atelier 2 (guide p.37-42) ─────────
  const srAct = { id: uid(), ref: "SR1", categoryId: "sr-activiste", name: "Activiste", description: P("Groupes d'activistes revendiqués « anti-vaccins » ; défenseurs de la cause animale.") };
  const srConc = { id: uid(), ref: "SR2", categoryId: "sr-concurrent", name: "Concurrent", description: P("Concurrents en compétition sur les mêmes vaccins, pouvant recourir à des officines.") };
  const srCyber = { id: uid(), ref: "SR3", categoryId: "sr-crime", name: "Cybercriminel", description: P("Organisations cybercriminelles pratiquant l'extorsion par rançongiciel.") };
  d.riskSources = [srAct, srConc, srCyber];
  const pair = (ref: string, sr: string, objective: string, cat: string, m: number, r: number, a: number, retained: boolean, prio: "P1" | "P2" | null, fes: string[], just: string, excl = "") => ({
    id: uid(), ref, riskSourceId: sr, objective, objectiveCategoryId: cat, motivation: m, resources: r, activity: a,
    pertinenceForced: null, justification: P(just), priority: prio, retained, exclusionJustification: excl, fearedEventIds: fes,
  });
  const pSabotage = pair("OV1", srAct.id, "Saboter la prochaine campagne nationale de vaccination en perturbant la production ou la distribution des vaccins, pour générer un choc psychologique sur la population et discréditer les pouvoirs publics", "ov-entrave", 3, 1, 3, true, "P1", [er6.id, er7.id], "Regain d'activité médiatique de groupes d'activistes revendiqués « anti-vaccins » à la reprise du calendrier de la vaccination anti-grippale nationale.");
  const pVol = pair("OV2", srConc.id, "Voler des informations en espionnant les travaux de R&D en vue d'obtenir un avantage concurrentiel", "ov-espionnage", 3, 3, 3, true, "P1", [er3.id, er5.id], "Dernière publication scientifique de BioTech informant de l'aboutissement imminent de ses recherches concernant le vaccin sur lequel les concurrents sont en compétition acharnée.");
  const pAnimaux = pair("OV3", srAct.id, "Divulguer au grand public des informations sur la façon dont les vaccins sont conçus en collectant des photos et vidéos des tests animaliers afin de rallier l'opinion publique à sa cause", "ov-influence", 2, 1, 2, false, "P2", [er3.id], "Deux cas dans l'année écoulée d'activistes s'étant introduits dans des abattoirs pour filmer des maltraitances animales, mais aucun dans un laboratoire.", "Menace jugée moins prégnante ; couple secondaire à surveiller.");
  const pRancon = pair("OV4", srCyber.id, "Menace d'altération de la composition de vaccins distribués lors d'une campagne nationale de vaccination sous couvert de bioterrorisme à des fins d'extorsion d'une rançon", "ov-lucratif", 1, 2, 2, false, "P2", [er2.id, er7.id], "Le dernier rapport annuel de l'ANSSI indique une augmentation des attaques par rançongiciel, mais peu de cas avérés sur un système industriel.", "Pertinence faible ; la direction souhaite toutefois mettre cette menace sous surveillance.");
  d.srovPairs = [pSabotage, pVol, pAnimaux, pRancon];

  // ───────── Atelier 3 : écosystème (fiche 5) ─────────
  const noRes: Criteria = { dependency: null, penetration: null, maturity: null, trust: null };
  const pp = (ref: string, name: string, cat: string, c: [number, number, number, number], critical: boolean | null, residual = noRes, just = ""): Stakeholder => ({
    id: uid(), ref, name, categoryId: cat, description: "", rank: 1, parentId: null,
    criteria: { dependency: c[0], penetration: c[1], maturity: c[2], trust: c[3] },
    dangerForced: null, justification: just ? P(just) : "", critical, residualCriteria: residual, residualForced: null,
  });
  const c1 = pp("C1", "Établissements de santé", "pp-clients", [1, 1, 1, 3], null);
  const c2 = pp("C2", "Pharmacies", "pp-clients", [1, 1, 2, 3], null);
  const c3 = pp("C3", "Dépositaires et grossistes répartiteurs", "pp-clients", [1, 2, 2, 3], null);
  const p1 = pp("P1", "Universités", "pp-partenaires", [2, 1, 1, 2], false, noRes, "Zone de contrôle mais non retenue par le responsable projet compte tenu du contexte et de la nature des sources de risque en jeu.");
  const p2 = pp("P2", "Régulateurs", "pp-partenaires", [2, 1, 2, 4], null);
  const p3 = pp("P3", "Laboratoires", "pp-partenaires", [3, 3, 2, 2], true, { ...noRes, penetration: 2 }, "Détiennent une partie des travaux de R&D ; habitude de tout leur diffuser.");
  const f1 = pp("F1", "Fournisseurs industriels chimistes", "pp-prestataires", [4, 2, 2, 3], false, noRes, "Zone de contrôle mais non retenue après discussion avec le RSSI.");
  const f2 = pp("F2", "Fournisseurs de matériel de production", "pp-prestataires", [4, 3, 2, 3], true, { ...noRes, penetration: 2 }, "Interviennent sur le système industriel avec leurs propres équipements de maintenance.");
  const f3 = pp("F3", "Prestataire informatique", "pp-prestataires", [3, 4, 2, 2], true, { ...noRes, maturity: 3 }, "Droits d'accès élevés sur le SI ; sécurité de son propre SI faible.");
  d.stakeholders = [c1, c2, c3, p1, p2, p3, f1, f2, f3];

  // ───────── Atelier 3 : scénarios stratégiques (guide p.50-52) ─────────
  const step = (kind: "intermediate" | "feared", label: string, sh: string | null, fe: string | null): PathStep => ({ id: uid(), kind, label, stakeholderId: sh, fearedEventId: fe });
  const path = (ref: string, name: string, steps: PathStep[]): AttackPath => ({ id: uid(), ref, name, description: "", steps, retained: true });
  const ca11 = path("CA1", "Canal d'exfiltration direct sur le SI de la R&D", [step("feared", "Canal d'exfiltration direct", null, er3.id)]);
  const ca12 = path("CA2", "Canal d'exfiltration sur le SI du laboratoire (P3)", [step("intermediate", "Création d'un canal d'exfiltration sur le SI du laboratoire", p3.id, null), step("feared", "Exfiltration de la partie des informations de R&D détenue par le laboratoire", null, er3.id)]);
  const ca13 = path("CA3", "Canal d'exfiltration via le prestataire informatique (F3)", [step("intermediate", "Création d'un canal d'exfiltration depuis l'infrastructure du prestataire", f3.id, null), step("feared", "Exfiltration des informations de R&D", null, er3.id)]);
  const ss1 = {
    id: uid(), ref: "SS1", srovId: pVol.id, name: "Un concurrent vole des travaux de recherche",
    description: P("Un concurrent vole des travaux de recherche en créant un canal d'exfiltration de données : 1. portant directement sur le SI de la R&D ; 2. sur le SI du laboratoire (P3), qui détient une partie des travaux ; 3. passant par le prestataire informatique F3."),
    gravityForced: null, paths: [ca11, ca12, ca13],
  };
  const ca21 = path("CA1", "Arrêt de production par compromission de l'équipement de maintenance (F2)", [step("intermediate", "Compromission de l'outil de maintenance", f2.id, null), step("feared", "Défaillance et arrêt de la ligne de production", null, er6.id)]);
  const ca22 = path("CA2", "Altération de l'étiquetage des vaccins", [step("feared", "Altération de l'étiquetage : les vaccins ne sont pas livrés au bon endroit", null, er6.id)]);
  const ss2 = {
    id: uid(), ref: "SS2", srovId: pSabotage.id, name: "Un activiste perturbe la production ou la distribution de vaccins",
    description: P("Un activiste perturbe la production ou la distribution de vaccins : 1. en provoquant un arrêt de la production industrielle par compromission de l'équipement de maintenance du fournisseur de matériel F2 ; 2. en modifiant l'étiquetage des vaccins. Cas le plus défavorable : incident lors d'un pic d'épidémie durant plus d'une semaine."),
    gravityForced: null, paths: [ca21, ca22],
  };
  d.strategicScenarios = [ss1, ss2];

  // ───────── Atelier 4 : scénarios opérationnels (guide p.63-67, fiche 8) ─────────
  const X = { "ph-connaitre": 40, "ph-rentrer": 330, "ph-trouver": 620, "ph-exploiter": 910 } as Record<string, number>;
  const node = (phase: string, row: number, label: string, pr: number, diff: number, asset: string | null, sh: string | null = null): GraphNode => ({
    id: uid(), type: "action", x: X[phase], y: 40 + row * 110, phaseId: phase, label, supportingAssetId: asset, stakeholderId: sh,
    catalogActionId: null, probability: pr, difficulty: diff, notes: "",
  });
  const goal = (row: number, label: string): GraphNode => ({
    id: uid(), type: "goal", x: 1200, y: 40 + row * 110, phaseId: null, label, supportingAssetId: null, stakeholderId: null,
    catalogActionId: null, probability: null, difficulty: null, notes: "",
  });
  const edge = (a: GraphNode, b: GraphNode, dashed = false): GraphEdge => ({ id: uid(), source: a.id, target: b.id, ...(dashed ? { dashed } : {}) });
  const op = (ref: string, pathId: string, name: string, nodes: GraphNode[], edges: GraphEdge[], extra: Partial<OperationalScenario> = {}): OperationalScenario => ({
    id: uid(), ref, attackPathId: pathId, name, description: "", nodes, edges, operatingModes: [],
    expressLikelihood: null, expressProbability: null, expressDifficulty: null, determinedSource: false, likelihoodForced: null, justification: "", ...extra,
  });

  // SO1 : graphe du guide (p.63) coté selon la fiche 8 (indice global 3 – très vraisemblable).
  const a = node("ph-connaitre", 0, "Reconnaissance externe sources ouvertes", 3, 1, null);
  const b = node("ph-connaitre", 3, "Reconnaissance externe avancée", 2, 2, null);
  const cCanal = node("ph-rentrer", 0, "Intrusion via un canal d'accès préexistant", 2, 3, bsLan.id);
  const dMail = node("ph-rentrer", 1, "Intrusion via mail d'hameçonnage sur service RH", 4, 1, bsMail.id);
  const eCE = node("ph-rentrer", 2, "Intrusion via le site du comité d'entreprise (point d'eau)", 4, 2, bsCE.id);
  const fCorrRD = node("ph-rentrer", 3, "Corruption d'un personnel de l'équipe R&D", 1, 3, bsPersRD.id);
  const gCorrEnt = node("ph-rentrer", 4, "Corruption d'un prestataire d'entretien des locaux", 3, 2, bsPersEntretien.id);
  const hUsb = node("ph-trouver", 4, "Clé USB piégée connectée sur un poste de R&D", 3, 2, bsPosteRD.id);
  const iReco = node("ph-trouver", 1, "Reconnaissance interne réseaux bureautique & IT site de Paris", 3, 2, bsLan.id);
  const jLat = node("ph-trouver", 2, "Latéralisation vers réseau LAN R&D", 4, 1, bsLan.id);
  const kMal = node("ph-exploiter", 2, "Exploitation maliciel de collecte et d'exfiltration", 4, 2, bsSrvInt.id);
  const lCanal = node("ph-exploiter", 1, "Création et maintien d'un canal d'exfiltration via un poste Internet", 3, 2, bsInternet.id);
  const g1 = goal(2, "Vol et exploitation de données de R&D");
  const so1Nodes = [a, b, cCanal, dMail, eCE, fCorrRD, gCorrEnt, hUsb, iReco, jLat, kMal, lCanal, g1];
  const so1Edges = [
    edge(a, cCanal), edge(a, dMail), edge(a, eCE), edge(b, fCorrRD), edge(b, gCorrEnt), edge(gCorrEnt, hUsb),
    edge(cCanal, iReco), edge(dMail, iReco), edge(eCE, iReco), edge(iReco, jLat), edge(jLat, kMal), edge(hUsb, kMal),
    edge(kMal, lCanal), edge(cCanal, lCanal, true), edge(lCanal, g1), edge(fCorrRD, g1),
  ];
  const so1 = op("SO1", ca11.id, "Exfiltration directe des données de R&D", so1Nodes, so1Edges, {
    description: P("Trois modes opératoires jugés pertinents : intrusion ciblée (messagerie RH, site du CE ou canal préexistant) puis latéralisation faute de cloisonnement ; corruption d'un salarié R&D ; corruption du personnel d'entretien pour brancher une clé USB piégée."),
    justification: P("Nombreuses vulnérabilités techniques et organisationnelles : utilisateurs peu sensibilisés à l'hameçonnage, site du CE accessible depuis Internet, MCS quasi inexistant, réseaux non cloisonnés administrés depuis des postes connectés à Internet, flux sortants non supervisés, données R&D centralisées sur un serveur facilement identifiable."),
    operatingModes: [
      { id: uid(), name: "Mode 1 — intrusion ciblée et latéralisation", description: P("Messagerie RH piégée ou point d'eau sur le site du CE (voire canal préexistant), reconnaissance interne, latéralisation vers le LAN R&D, collecte et exfiltration."), likelihood: 3, nodeIds: [a.id, dMail.id, eCE.id, cCanal.id, iReco.id, jLat.id, kMal.id, lCanal.id, g1.id] },
      { id: uid(), name: "Mode 2 — corruption d'un salarié R&D", description: P("Le salarié récupère les informations depuis son poste, sans supervision."), likelihood: 1, nodeIds: [b.id, fCorrRD.id, g1.id] },
      { id: uid(), name: "Mode 3 — personnel d'entretien et clé USB piégée", description: P("Entretien hors heures ouvrées, accès libre au bureau d'études, ports USB sans restriction."), likelihood: 2, nodeIds: [b.id, gCorrEnt.id, hUsb.id, kMal.id, lCanal.id, g1.id] },
    ],
  });

  // SO2 : via le laboratoire (V2).
  const s2a = node("ph-connaitre", 0, "Reconnaissance de l'écosystème (laboratoires partenaires)", 3, 1, null);
  const s2b = node("ph-rentrer", 0, "Intrusion par rebond dans le SI du laboratoire", 2, 2, bsSrvExt.id, p3.id);
  const s2c = node("ph-trouver", 0, "Localisation des données de R&D partagées", 3, 1, bsSrvExt.id, p3.id);
  const s2d = node("ph-exploiter", 0, "Exfiltration des données de R&D", 3, 2, bsSrvExt.id, p3.id);
  const s2g = goal(0, "Vol des informations de R&D détenues par le laboratoire");
  const so2 = op("SO2", ca12.id, "Exfiltration via le laboratoire", [s2a, s2b, s2c, s2d, s2g], [edge(s2a, s2b), edge(s2b, s2c), edge(s2c, s2d), edge(s2d, s2g)]);

  // SO3 : via le prestataire informatique (V4 – quasi certain).
  const s3a = node("ph-connaitre", 0, "Reconnaissance du prestataire informatique", 4, 1, null, f3.id);
  const s3b = node("ph-rentrer", 0, "Compromission du SI du prestataire (hameçonnage)", 4, 1, null, f3.id);
  const s3c = node("ph-trouver", 0, "Rebond via les accès d'administration du prestataire", 4, 1, bsLan.id, f3.id);
  const s3d = node("ph-exploiter", 0, "Exfiltration des données de R&D", 4, 1, bsSrvInt.id);
  const s3g = goal(0, "Vol des informations de R&D");
  const so3 = op("SO3", ca13.id, "Exfiltration via le prestataire informatique", [s3a, s3b, s3c, s3d, s3g], [edge(s3a, s3b), edge(s3b, s3c), edge(s3c, s3d), edge(s3d, s3g)], {
    justification: P("Le prestataire dispose de droits d'accès élevés et la sécurité de son SI est faible : intrusion et exfiltration très faciles avec un minimum de ressources."),
  });

  // SO4 : équipement de maintenance F2 (V2).
  const s4a = node("ph-connaitre", 0, "Identification du fournisseur de matériel de production", 3, 1, null, f2.id);
  const s4b = node("ph-rentrer", 0, "Piégeage de l'équipement de maintenance du fournisseur", 2, 3, bsProd.id, f2.id);
  const s4c = node("ph-trouver", 0, "Propagation vers le système industriel lors d'une maintenance", 3, 2, bsProd.id);
  const s4d = node("ph-exploiter", 0, "Envoi de commandes provoquant l'arrêt de la ligne", 3, 3, bsProd.id);
  const s4g = goal(0, "Arrêt de la production de vaccins");
  const so4 = op("SO4", ca21.id, "Arrêt de production via la maintenance", [s4a, s4b, s4c, s4d, s4g], [edge(s4a, s4b), edge(s4b, s4c), edge(s4c, s4d), edge(s4d, s4g)]);

  // SO5 : étiquetage (V1).
  const s5a = node("ph-connaitre", 0, "Reconnaissance du processus d'étiquetage", 2, 2, null);
  const s5b = node("ph-rentrer", 0, "Intrusion sur le système d'étiquetage", 1, 3, bsEtiquetage.id);
  const s5c = node("ph-exploiter", 0, "Altération des données d'étiquetage", 2, 2, bsEtiquetage.id);
  const s5g = goal(0, "Livraison des vaccins au mauvais endroit");
  const so5 = op("SO5", ca22.id, "Modification de l'étiquetage", [s5a, s5b, s5c, s5g], [edge(s5a, s5b), edge(s5b, s5c), edge(s5c, s5g)]);
  d.operationalScenarios = [so1, so2, so3, so4, so5];

  // ───────── Atelier 5 (guide p.72-81) ─────────
  const risk = (ref: string, pathId: string, title: string, rg: number | null, rv: number | null) => ({
    id: uid(), ref, attackPathId: pathId, fearedEventId: null, title, gravityForced: null, likelihoodForced: null,
    treatment: "reduce" as const, acceptabilityForced: null, residualGravity: rg, residualLikelihood: rv,
    residualDoc: { description: "", vulnerabilities: "", aggravatingFactors: "", management: "" }, excluded: false,
  });
  const R1 = risk("R1", ca11.id, "Un concurrent vole des informations de R&D grâce à un canal d'exfiltration direct", 3, 2);
  const R2 = risk("R2", ca12.id, "Un concurrent vole des informations de R&D en exfiltrant celles détenues par le laboratoire", 3, 1);
  const R3 = risk("R3", ca13.id, "Un concurrent vole des informations de R&D grâce à un canal d'exfiltration via le prestataire informatique", 3, 3);
  const R4 = risk("R4", ca21.id, "Un activiste provoque un arrêt de la production des vaccins en compromettant l'équipement de maintenance du fournisseur de matériel", 4, 1);
  const R5 = risk("R5", ca22.id, "Un activiste perturbe la distribution de vaccins en modifiant leur étiquetage", 3, 1);
  R3.residualDoc = {
    description: P("Vol des données d'études R&D par l'intermédiaire du prestataire informatique, qui conserve des accès privilégiés."),
    vulnerabilities: P("Maturité cyber du prestataire insuffisante ; droits d'accès élevés sur le SI de la société."),
    aggravatingFactors: P("Prestataire relativement opposé à la mise en place des mesures, qui impliquent un changement profond de ses méthodes de travail."),
    management: P("La direction maintient le risque à un niveau résiduel élevé. Pistes : entrer au capital du prestataire pour en modifier la gouvernance cyber, ou changer de prestataire."),
  };
  d.risks = [R1, R2, R3, R4, R5];

  const m = (ref: string, title: string, category: Measure["category"], origin: Measure["origin"], risks: string[], owner: string, cost: 1 | 2 | 3, due: string, status: Measure["status"], extra: Partial<Measure> = {}): Measure => ({
    id: uid(), ref, title, description: "", origin, category, businessValueIds: [], supportingAssetIds: [], stakeholderIds: [], riskIds: risks,
    requirementIds: [], owner, obstacles: "", cost, effort: "", dueDate: due, priority: null, status,
    progress: status === "done" ? 100 : status === "in_progress" ? 40 : 0, comments: "", ...extra,
  });
  d.measures = [
    m("M1", "Sensibilisation renforcée à l'hameçonnage par un prestataire spécialisé", "governance", "scenario", [R1.id], "RSSI", 1, "2026-09-30", "done", { priority: "P1", effort: "10 j/h", supportingAssetIds: [bsMail.id] }),
    m("M2", "Audit de sécurité technique et organisationnel de l'ensemble du SI bureautique par un PASSI", "governance", "scenario", [R1.id], "RSSI", 2, "2026-09-30", "in_progress", { priority: "P1" }),
    m("M3", "Intégration d'une clause de garantie d'un niveau de sécurité satisfaisant dans les contrats avec les prestataires et laboratoires", "governance", "ecosystem", [R2.id, R3.id, R4.id], "RSSI / Équipe juridique", 1, "2027-03-31", "todo", { obstacles: "Effectué au fil de l'eau à la renégociation des contrats", stakeholderIds: [p3.id, f2.id, f3.id], priority: "P2" }),
    m("M4", "Mise en place d'une procédure de signalement de tout incident de sécurité ayant lieu chez un prestataire ou un laboratoire", "defense", "ecosystem", [R2.id, R3.id, R4.id], "RSSI", 1, "2026-06-30", "todo", { stakeholderIds: [p3.id, f2.id, f3.id], priority: "P2" }),
    m("M5", "Audit de sécurité organisationnel des prestataires et laboratoires clés ; mise en place et suivi des plans d'action consécutifs", "governance", "ecosystem", [R2.id, R3.id, R4.id], "RSSI", 2, "2026-12-31", "todo", { obstacles: "Acceptation de la démarche par les prestataires et laboratoires", stakeholderIds: [p3.id, f2.id, f3.id], priority: "P1" }),
    m("M6", "Limitation des données transmises aux laboratoires au juste besoin", "protection", "ecosystem", [R2.id], "Équipe R&D", 1, "2026-06-30", "in_progress", { stakeholderIds: [p3.id], description: P("Diminuer la pénétration des laboratoires (3 → 2) : mauvaise habitude actuelle de tout diffuser.") }),
    m("M7", "Protection renforcée des données de R&D sur le SI (pistes : chiffrement, cloisonnement)", "protection", "scenario", [R1.id, R3.id], "DSI", 3, "2026-12-31", "todo", { businessValueIds: [vmRD.id], supportingAssetIds: [bsSrvInt.id, bsLan.id], priority: "P1" }),
    m("M8", "Renforcement du contrôle d'accès physique au bureau R&D", "protection", "scenario", [R1.id], "Équipe sûreté", 2, "2026-09-30", "done"),
    m("M9", "Renforcement de la sécurité du système industriel selon les recommandations de l'ANSSI", "protection", "scenario", [R4.id, R5.id], "DSI", 3, "2027-09-30", "in_progress", { obstacles: "Stratégie et plan d'action à définir et valider", supportingAssetIds: [bsProd.id], priority: "P2" }),
    m("M10", "Chiffrement des échanges de données avec les laboratoires", "protection", "scenario", [R2.id], "DSI", 2, "2026-09-30", "todo", { stakeholderIds: [p3.id] }),
    m("M11", "Surveillance renforcée des flux entrants et sortants (sonde IDS) et analyse des journaux d'événements à l'aide d'un outil", "defense", "scenario", [R1.id, R5.id], "RSSI / DSI", 2, "2026-12-31", "todo", { obstacles: "Achat d'un outil, budget à provisionner", priority: "P1" }),
    m("M12", "Renforcement du plan de continuité d'activité", "resilience", "scenario", [R4.id, R5.id], "Équipe continuité d'activité", 2, "2027-03-31", "in_progress", { businessValueIds: [vmFab.id] }),
    m("M13", "Dotation de matériels de maintenance administrés par la DSI et mis à disposition du prestataire sur site", "protection", "ecosystem", [R4.id], "DSI", 2, "2026-12-31", "todo", { stakeholderIds: [f2.id], description: P("Réduire le risque de piégeage des équipements de maintenance utilisés sur le système industriel (pénétration des fournisseurs 3 → 2).") }),
    m("M14", "Accroître la maturité cyber du prestataire informatique : audit de sécurité inclus au contrat et suivi du plan d'action interne", "governance", "ecosystem", [R3.id], "RSSI", 2, "2026-12-31", "todo", { stakeholderIds: [f3.id], description: P("Maturité cyber du prestataire 2 → 3.") }),
    m("M15", "Finaliser et appliquer la politique de sauvegarde des composants critiques (règle 37)", "resilience", "baseline", [], "DSI", 1, "2026-06-30", "in_progress", { requirementIds: [r37.id] }),
    m("M16", "Créer des comptes d'administration nominatifs pour l'ERP ou compenser par un bastion journalisé (règle 8)", "protection", "baseline", [], "DSI", 2, "2026-12-31", "todo", { requirementIds: [r8.id] }),
  ];

  d.monitoring.nextCommitteeDate = "2026-09-15";
  d.monitoring.committeeMembers = "Directrice générale, RSSI, DSI, responsables R&D, production et qualité";
  d.monitoring.triggers.push({ id: uid(), description: "Surveillance de la menace cybercriminelle (couple OV4), jugée peu pertinente mais source de préoccupation forte pour la direction", owner: "RSSI" });
  return d;
}
