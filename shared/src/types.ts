/**
 * Modèle de données d'une étude EBIOS Risk Manager (guide ANSSI v1.5).
 * Une version d'étude est un document StudyData complet ; les valeurs dérivées
 * (pertinence, dangerosité, gravité, vraisemblance, niveau de risque) sont
 * calculées par engine.ts et ne sont stockées que lorsqu'elles sont « forcées ».
 */

export type Id = string;

/** Texte enrichi (HTML assaini : gras, italique, souligné, listes, couleurs). */
export type RichText = string;

export interface ScaleLevel {
  value: number;
  label: string;
  description: string;
  color?: string;
}

export interface Category {
  id: Id;
  label: string;
  description?: string;
}

// ───────────────────────────── Paramètres ─────────────────────────────

export interface Scales {
  gravity: ScaleLevel[];
  likelihood: ScaleLevel[];
  /** Probabilité de succès d'une action élémentaire (fiche 8). */
  probability: ScaleLevel[];
  /** Difficulté technique d'une action élémentaire (fiche 8). */
  difficulty: ScaleLevel[];
  motivation: ScaleLevel[];
  resources: ScaleLevel[];
  activity: ScaleLevel[];
  pertinence: ScaleLevel[];
  dependency: ScaleLevel[];
  penetration: ScaleLevel[];
  maturity: ScaleLevel[];
  trust: ScaleLevel[];
  /** Niveaux de risque (Faible / Moyen / Élevé) avec acceptabilité associée. */
  riskLevels: RiskLevelDef[];
  /** Besoins de sécurité D/I/C/T des valeurs métier. */
  securityNeeds: ScaleLevel[];
}

export interface RiskLevelDef extends ScaleLevel {
  acceptability: string;
  decision: string;
}

/** matrix[rowValue][colValue] = résultat. Clés numériques sérialisées en chaîne. */
export type Matrix = Record<string, Record<string, number>>;

export type LikelihoodMethod = "express" | "standard" | "advanced";

export interface DangerositySettings {
  /** Exposants de pondération ; 0 retire le critère de la formule. */
  weights: { dependency: number; penetration: number; maturity: number; trust: number };
  thresholds: { watch: number; control: number; danger: number };
}

export interface AttackPhase {
  id: Id;
  label: string;
  description: string;
  color: string;
}

export interface CatalogAction {
  id: Id;
  phaseId: Id;
  category: string;
  label: string;
  description?: string;
  /** Techniques MITRE ATT&CK associées (identifiants Txxxx), facultatif. */
  attack?: string[];
}

export interface CotationHint {
  id: Id;
  category: string;
  criteria: string[];
}

export interface Catalogs {
  riskSourceCategories: Category[];
  targetObjectiveCategories: Category[];
  stakeholderCategories: (Category & { internal: boolean })[];
  impactCategories: Category[];
  supportingAssetTypes: (Category & { group: string })[];
  attackPhases: AttackPhase[];
  elementaryActions: CatalogAction[];
  cotationHints: CotationHint[];
}

export interface StudySettings {
  scaleSize: 4 | 5;
  scales: Scales;
  /** pertinenceMatrix[ressources][motivation] = pertinence */
  pertinenceMatrix: Matrix;
  /** L'activité de la SR module la pertinence (±1) si activée. */
  useActivityInPertinence: boolean;
  /** likelihoodCross[probabilité][difficulté] = vraisemblance */
  likelihoodCross: Matrix;
  /** riskMatrix[gravité][vraisemblance] = niveau de risque */
  riskMatrix: Matrix;
  likelihoodMethod: LikelihoodMethod;
  /** Correction des chaînes longues (fiche 8) : seuil d'AE, 0 = désactivé. */
  longChainThreshold: number;
  dangerosity: DangerositySettings;
  catalogs: Catalogs;
}

// ───────────────────────────── Atelier 1 ─────────────────────────────

export type RaciValue = "" | "R" | "A" | "C" | "I";

export interface Participant {
  id: Id;
  name: string;
  role: string;
  organisation: string;
  email?: string;
}

export interface Meeting {
  id: Id;
  workshop: number;
  date: string;
  title: string;
  notes: string;
}

export type StudyPurpose =
  | "baseline"
  | "compliance"
  | "ecosystem_threat"
  | "high_level_scenarios"
  | "preliminary"
  | "complete"
  | "audit"
  | "soc";

export interface Framing {
  subject: string;
  purpose: StudyPurpose;
  objectives: RichText;
  participants: Participant[];
  /** raci[workshop "1".."5"][participantId] */
  raci: Record<string, Record<Id, RaciValue>>;
  riskOwnerId: Id | null;
  strategicCycleMonths: number;
  operationalCycleMonths: number;
  assumptions: RichText;
  constraints: RichText;
  meetings: Meeting[];
  /** Ateliers conduits dans cette étude (ex. sans atelier 4 pour une étude préliminaire). */
  workshopsEnabled: { 1: boolean; 2: boolean; 3: boolean; 4: boolean; 5: boolean };
}

export interface Mission {
  id: Id;
  ref: string;
  name: string;
  description: RichText;
}

export type OwnerType = "internal" | "external";

export interface BusinessValue {
  id: Id;
  ref: string;
  name: string;
  nature: "process" | "information";
  description: RichText;
  owner: string;
  ownerType: OwnerType;
  missionIds: Id[];
  needs: { D: number | null; I: number | null; C: number | null; T: number | null };
}

export interface SupportingAsset {
  id: Id;
  ref: string;
  name: string;
  typeId: Id | null;
  description: RichText;
  owner: string;
  ownerType: OwnerType;
  businessValueIds: Id[];
}

export type SecurityCriterion = "D" | "I" | "C" | "T";

export interface FearedEvent {
  id: Id;
  ref: string;
  /** null = événement redouté non lié à une valeur métier (risque non intentionnel). */
  businessValueId: Id | null;
  name: string;
  criteria: SecurityCriterion[];
  impactCategoryIds: Id[];
  impacts: RichText;
  gravity: number | null;
  justification: RichText;
  /** Vraisemblance (méthode expresse) pour un ER non lié à une valeur métier. */
  expressLikelihood: number | null;
}

export type RequirementStatus = "applied" | "partial" | "not_applied" | "na" | "unknown";

export interface Requirement {
  id: Id;
  ref: string;
  title: string;
  description?: string;
  /** Rubrique du référentiel (axe du radar de conformité). */
  section?: string;
  status: RequirementStatus;
  gap: string;
  justification: RichText;
}

export type ReferentialType = "hygiene" | "internal" | "third_party" | "standard" | "regulation" | "other";

export interface Referential {
  id: Id;
  type: ReferentialType;
  name: string;
  description: string;
  /** Indicateur global forcé ; null = calculé à partir des exigences. */
  statusForced: "applied" | "partial" | "not_applied" | null;
  requirements: Requirement[];
  collapsed?: boolean;
}

export interface Baseline {
  referentials: Referential[];
  decision: "continue" | "strengthen_first" | "undecided";
  decisionComment: RichText;
}

// ───────────────────────────── Atelier 2 ─────────────────────────────

export interface RiskSource {
  id: Id;
  ref: string;
  categoryId: Id | null;
  name: string;
  description: RichText;
}

export interface SrovPair {
  id: Id;
  ref: string;
  riskSourceId: Id;
  objective: string;
  objectiveCategoryId: Id | null;
  motivation: number | null;
  resources: number | null;
  activity: number | null;
  pertinenceForced: number | null;
  justification: RichText;
  priority: "P1" | "P2" | null;
  retained: boolean;
  exclusionJustification: string;
  /** Croisement OV / ER (fin d'atelier 2). */
  fearedEventIds: Id[];
}

// ───────────────────────────── Atelier 3 ─────────────────────────────

export interface Criteria {
  dependency: number | null;
  penetration: number | null;
  maturity: number | null;
  trust: number | null;
}

export interface Stakeholder {
  id: Id;
  ref: string;
  name: string;
  categoryId: Id | null;
  description: RichText;
  rank: 1 | 2 | 3;
  parentId: Id | null;
  criteria: Criteria;
  dangerForced: number | null;
  justification: RichText;
  /** null = suggestion automatique selon la zone ; booléen = choix de l'utilisateur. */
  critical: boolean | null;
  /** Niveaux cibles après mesures écosystème (null = inchangé). */
  residualCriteria: Criteria;
  residualForced: number | null;
}

export type PathStepKind = "intermediate" | "feared";

export interface PathStep {
  id: Id;
  kind: PathStepKind;
  label: string;
  stakeholderId: Id | null;
  fearedEventId: Id | null;
}

export interface AttackPath {
  id: Id;
  ref: string;
  name: string;
  description: RichText;
  steps: PathStep[];
  retained: boolean;
}

export interface StrategicScenario {
  id: Id;
  ref: string;
  srovId: Id;
  name: string;
  description: RichText;
  gravityForced: number | null;
  paths: AttackPath[];
}

// ───────────────────────────── Atelier 4 ─────────────────────────────

export type GraphNodeType = "action" | "and" | "or" | "goal";

export interface GraphNode {
  id: Id;
  type: GraphNodeType;
  x: number;
  y: number;
  phaseId: Id | null;
  label: string;
  supportingAssetId: Id | null;
  stakeholderId: Id | null;
  catalogActionId: Id | null;
  probability: number | null;
  difficulty: number | null;
  notes: string;
}

export interface GraphEdge {
  id: Id;
  source: Id;
  target: Id;
  /** Pointillé : lien hypothétique (ex. canal préexistant à confirmer). */
  dashed?: boolean;
}

export interface OperatingMode {
  id: Id;
  name: string;
  description: RichText;
  likelihood: number | null;
  nodeIds: Id[];
}

export interface OperationalScenario {
  id: Id;
  ref: string;
  attackPathId: Id;
  name: string;
  description: RichText;
  nodes: GraphNode[];
  edges: GraphEdge[];
  operatingModes: OperatingMode[];
  /** Méthode expresse : vraisemblance directe, ou croisement Pr × D global. */
  expressLikelihood: number | null;
  expressProbability: number | null;
  expressDifficulty: number | null;
  /** Méthode avancée : +1 niveau si la SR est particulièrement déterminée. */
  determinedSource: boolean;
  likelihoodForced: number | null;
  justification: RichText;
}

// ───────────────────────────── Atelier 5 ─────────────────────────────

export type TreatmentOption = "reduce" | "accept" | "transfer" | "avoid";

export interface ResidualDoc {
  description: RichText;
  vulnerabilities: RichText;
  aggravatingFactors: RichText;
  management: RichText;
}

export interface RiskRecord {
  id: Id;
  ref: string;
  /** Chemin d'attaque (risque intentionnel) ou ER non intentionnel. */
  attackPathId: Id | null;
  fearedEventId: Id | null;
  title: string;
  gravityForced: number | null;
  likelihoodForced: number | null;
  treatment: TreatmentOption | null;
  /** Niveau de risque forcé pour la stratégie (couleur d'acceptabilité). */
  acceptabilityForced: number | null;
  residualGravity: number | null;
  residualLikelihood: number | null;
  residualDoc: ResidualDoc;
  excluded: boolean;
}

export type MeasureCategory = "governance" | "protection" | "defense" | "resilience";
export type MeasureOrigin = "baseline" | "ecosystem" | "scenario" | "other";
export type MeasureStatus = "todo" | "in_progress" | "done" | "abandoned";

export interface Measure {
  id: Id;
  ref: string;
  title: string;
  description: RichText;
  origin: MeasureOrigin;
  category: MeasureCategory;
  businessValueIds: Id[];
  supportingAssetIds: Id[];
  stakeholderIds: Id[];
  riskIds: Id[];
  requirementIds: Id[];
  owner: string;
  obstacles: string;
  cost: 1 | 2 | 3 | null;
  effort: string;
  dueDate: string;
  priority: "P1" | "P2" | "P3" | null;
  status: MeasureStatus;
  progress: number;
  comments: RichText;
}

export interface Indicator {
  id: Id;
  name: string;
  target: string;
  current: string;
  frequency: string;
  owner: string;
}

export interface Trigger {
  id: Id;
  description: string;
  owner: string;
}

export interface Monitoring {
  indicators: Indicator[];
  committeeFrequencyMonths: number;
  nextCommitteeDate: string;
  committeeMembers: string;
  triggers: Trigger[];
  notes: RichText;
}

// ───────────────────────────── Document ─────────────────────────────

export interface StudyData {
  schemaVersion: 1;
  settings: StudySettings;
  framing: Framing;
  missions: Mission[];
  businessValues: BusinessValue[];
  supportingAssets: SupportingAsset[];
  fearedEvents: FearedEvent[];
  baseline: Baseline;
  riskSources: RiskSource[];
  srovPairs: SrovPair[];
  stakeholders: Stakeholder[];
  strategicScenarios: StrategicScenario[];
  operationalScenarios: OperationalScenario[];
  risks: RiskRecord[];
  measures: Measure[];
  monitoring: Monitoring;
}

export const PROTECTION_MARKS = [
  { id: "NP", label: "Non protégé", color: "#2e7d32" },
  { id: "DR", label: "Diffusion Restreinte", color: "#c62828" },
  { id: "C2", label: "C2 — Interne (entreprise)", color: "#ef6c00" },
  { id: "C3", label: "C3 — Confidentiel (entreprise)", color: "#ad1457" },
  { id: "SENS", label: "Sensible", color: "#6a1b9a" },
] as const;
export type ProtectionMark = (typeof PROTECTION_MARKS)[number]["id"];

/** Métadonnées d'étude exposées par l'API (hors document). */
export interface StudyMeta {
  id: Id;
  name: string;
  reference: string;
  organisation: string;
  protection: ProtectionMark;
  major: number;
  minor: number;
  versionId: Id;
  rev: number;
  frozen: boolean;
  createdAt: string;
  updatedAt: string;
  ownerName: string;
  access: "read" | "write" | "owner";
}

export interface VersionInfo {
  id: Id;
  major: number;
  minor: number;
  changeType: "initial" | "operational" | "strategic";
  summary: string;
  workshops: number[];
  frozen: boolean;
  createdAt: string;
  createdBy: string;
  diff: DiffEntry[] | null;
}

export interface DiffEntry {
  workshop: number;
  activity: string;
  added: number;
  modified: number;
  removed: number;
}
