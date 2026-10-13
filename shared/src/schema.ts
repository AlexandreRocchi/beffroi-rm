/**
 * Schéma de validation (zod) d'un document d'étude. Utilisé par le serveur pour toute
 * sauvegarde et tout import : un document invalide est refusé.
 */
import { z } from "zod";
import type { StudyData } from "./types.js";

const id = z.string().min(1).max(100);
const str = (max = 500) => z.string().max(max);
const rich = z.string().max(100_000);
const lvl = z.number().int().min(-1).max(10);
const nlvl = lvl.nullable();
const ids = z.array(id).max(5000);

const scaleLevel = z.object({
  value: lvl,
  label: str(200),
  description: str(5000),
  color: str(30).optional(),
});
const riskLevelDef = scaleLevel.extend({ acceptability: str(200), decision: str(2000) });
const scale = z.array(scaleLevel).min(1).max(10);
const matrix = z.record(z.string().max(4), z.record(z.string().max(4), lvl));
const category = z.object({ id, label: str(300), description: str(5000).optional() });

const criteria = z.object({ dependency: nlvl, penetration: nlvl, maturity: nlvl, trust: nlvl });

const settings = z.object({
  scaleSize: z.union([z.literal(4), z.literal(5)]),
  scales: z.object({
    gravity: scale,
    likelihood: scale,
    probability: scale,
    difficulty: scale,
    motivation: scale,
    resources: scale,
    activity: scale,
    pertinence: scale,
    dependency: scale,
    penetration: scale,
    maturity: scale,
    trust: scale,
    riskLevels: z.array(riskLevelDef).min(1).max(10),
    securityNeeds: scale,
  }),
  pertinenceMatrix: matrix,
  useActivityInPertinence: z.boolean(),
  likelihoodCross: matrix,
  riskMatrix: matrix,
  likelihoodMethod: z.enum(["express", "standard", "advanced"]),
  longChainThreshold: z.number().int().min(0).max(100),
  dangerosity: z.object({
    weights: z.object({
      dependency: z.number().min(0).max(5),
      penetration: z.number().min(0).max(5),
      maturity: z.number().min(0).max(5),
      trust: z.number().min(0).max(5),
    }),
    thresholds: z.object({ watch: z.number().min(0), control: z.number().min(0), danger: z.number().min(0) }),
  }),
  catalogs: z.object({
    riskSourceCategories: z.array(category).max(500),
    targetObjectiveCategories: z.array(category).max(500),
    stakeholderCategories: z.array(category.extend({ internal: z.boolean() })).max(500),
    impactCategories: z.array(category).max(500),
    supportingAssetTypes: z.array(category.extend({ group: str(200) })).max(500),
    attackPhases: z.array(z.object({ id, label: str(200), description: str(5000), color: str(30) })).min(1).max(20),
    elementaryActions: z
      .array(z.object({ id, phaseId: id, category: str(300), label: str(500), description: str(5000).optional(), attack: z.array(str(30)).max(50).optional() }))
      .max(5000),
    cotationHints: z.array(z.object({ id, category: str(300), criteria: z.array(str(2000)).max(100) })).max(500),
  }),
});

const needs = z.object({ D: nlvl, I: nlvl, C: nlvl, T: nlvl });

export const studyDataSchema = z.object({
  schemaVersion: z.literal(1),
  settings,
  framing: z.object({
    subject: str(2000),
    purpose: z.enum(["baseline", "compliance", "ecosystem_threat", "high_level_scenarios", "preliminary", "complete", "audit", "soc"]),
    objectives: rich,
    participants: z.array(z.object({ id, name: str(200), role: str(200), organisation: str(200), email: str(200).optional() })).max(500),
    raci: z.record(z.string().max(2), z.record(id, z.enum(["", "R", "A", "C", "I"]))),
    riskOwnerId: id.nullable(),
    strategicCycleMonths: z.number().int().min(0).max(600),
    operationalCycleMonths: z.number().int().min(0).max(600),
    assumptions: rich,
    constraints: rich,
    meetings: z.array(z.object({ id, workshop: z.number().int().min(0).max(5), date: str(40), title: str(300), notes: str(5000) })).max(500),
    workshopsEnabled: z.object({ 1: z.boolean(), 2: z.boolean(), 3: z.boolean(), 4: z.boolean(), 5: z.boolean() }),
  }),
  missions: z.array(z.object({ id, ref: str(30), name: str(500), description: rich })).max(1000),
  businessValues: z
    .array(
      z.object({
        id, ref: str(30), name: str(500), nature: z.enum(["process", "information"]), description: rich,
        owner: str(300), ownerType: z.enum(["internal", "external"]), missionIds: ids, needs,
      }),
    )
    .max(2000),
  supportingAssets: z
    .array(
      z.object({
        id, ref: str(30), name: str(500), typeId: id.nullable(), description: rich, owner: str(300),
        ownerType: z.enum(["internal", "external"]), businessValueIds: ids,
      }),
    )
    .max(5000),
  fearedEvents: z
    .array(
      z.object({
        id, ref: str(30), businessValueId: id.nullable(), name: str(1000), criteria: z.array(z.enum(["D", "I", "C", "T"])).max(4),
        impactCategoryIds: ids, impacts: rich, gravity: nlvl, justification: rich, expressLikelihood: nlvl,
      }),
    )
    .max(5000),
  baseline: z.object({
    referentials: z
      .array(
        z.object({
          id,
          type: z.enum(["hygiene", "internal", "third_party", "standard", "regulation", "other"]),
          name: str(500),
          description: str(5000),
          statusForced: z.enum(["applied", "partial", "not_applied"]).nullable(),
          collapsed: z.boolean().optional(),
          requirements: z
            .array(
              z.object({
                id, ref: str(60), title: str(2000), description: str(10000).optional(), section: str(300).optional(),
                status: z.enum(["applied", "partial", "not_applied", "na", "unknown"]), gap: str(5000), justification: rich,
              }),
            )
            .max(5000),
        }),
      )
      .max(200),
    decision: z.enum(["continue", "strengthen_first", "undecided"]),
    decisionComment: rich,
  }),
  riskSources: z.array(z.object({ id, ref: str(30), categoryId: id.nullable(), name: str(500), description: rich })).max(1000),
  srovPairs: z
    .array(
      z.object({
        id, ref: str(30), riskSourceId: id, objective: str(2000), objectiveCategoryId: id.nullable(),
        motivation: nlvl, resources: nlvl, activity: nlvl, pertinenceForced: nlvl, justification: rich,
        priority: z.enum(["P1", "P2"]).nullable(), retained: z.boolean(), exclusionJustification: str(5000), fearedEventIds: ids,
      }),
    )
    .max(2000),
  stakeholders: z
    .array(
      z.object({
        id, ref: str(30), name: str(500), categoryId: id.nullable(), description: rich,
        rank: z.union([z.literal(1), z.literal(2), z.literal(3)]), parentId: id.nullable(), criteria,
        dangerForced: z.number().min(0).max(1000).nullable(), justification: rich, critical: z.boolean().nullable(),
        residualCriteria: criteria, residualForced: z.number().min(0).max(1000).nullable(),
      }),
    )
    .max(2000),
  strategicScenarios: z
    .array(
      z.object({
        id, ref: str(30), srovId: id, name: str(1000), description: rich, gravityForced: nlvl,
        paths: z
          .array(
            z.object({
              id, ref: str(30), name: str(1000), description: rich, retained: z.boolean(),
              steps: z
                .array(z.object({ id, kind: z.enum(["intermediate", "feared"]), label: str(1000), stakeholderId: id.nullable(), fearedEventId: id.nullable() }))
                .max(100),
            }),
          )
          .max(100),
      }),
    )
    .max(1000),
  operationalScenarios: z
    .array(
      z.object({
        id, ref: str(30), attackPathId: id, name: str(1000), description: rich,
        nodes: z
          .array(
            z.object({
              id, type: z.enum(["action", "and", "or", "goal"]), x: z.number().finite(), y: z.number().finite(),
              phaseId: id.nullable(), label: str(1000), supportingAssetId: id.nullable(), stakeholderId: id.nullable(),
              catalogActionId: id.nullable(), probability: nlvl, difficulty: nlvl, notes: str(5000),
            }),
          )
          .max(500),
        edges: z.array(z.object({ id, source: id, target: id, dashed: z.boolean().optional() })).max(2000),
        operatingModes: z.array(z.object({ id, name: str(500), description: rich, likelihood: nlvl, nodeIds: ids })).max(100),
        expressLikelihood: nlvl,
        expressProbability: nlvl,
        expressDifficulty: nlvl,
        determinedSource: z.boolean(),
        likelihoodForced: nlvl,
        justification: rich,
      }),
    )
    .max(2000),
  risks: z
    .array(
      z.object({
        id, ref: str(30), attackPathId: id.nullable(), fearedEventId: id.nullable(), title: str(2000),
        gravityForced: nlvl, likelihoodForced: nlvl, treatment: z.enum(["reduce", "accept", "transfer", "avoid"]).nullable(),
        acceptabilityForced: nlvl, residualGravity: nlvl, residualLikelihood: nlvl,
        residualDoc: z.object({ description: rich, vulnerabilities: rich, aggravatingFactors: rich, management: rich }),
        excluded: z.boolean(),
      }),
    )
    .max(5000),
  measures: z
    .array(
      z.object({
        id, ref: str(30), title: str(1000), description: rich,
        origin: z.enum(["baseline", "ecosystem", "scenario", "other"]),
        category: z.enum(["governance", "protection", "defense", "resilience"]),
        businessValueIds: ids, supportingAssetIds: ids, stakeholderIds: ids, riskIds: ids, requirementIds: ids,
        owner: str(300), obstacles: str(5000), cost: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
        effort: str(200), dueDate: str(40), priority: z.enum(["P1", "P2", "P3"]).nullable(),
        status: z.enum(["todo", "in_progress", "done", "abandoned"]), progress: z.number().min(0).max(100), comments: rich,
      }),
    )
    .max(5000),
  monitoring: z.object({
    indicators: z.array(z.object({ id, name: str(500), target: str(200), current: str(200), frequency: str(200), owner: str(200) })).max(500),
    committeeFrequencyMonths: z.number().int().min(0).max(120),
    nextCommitteeDate: str(40),
    committeeMembers: str(2000),
    triggers: z.array(z.object({ id, description: str(2000), owner: str(200) })).max(500),
    notes: rich,
  }),
});

// Garde-fou de compilation : le schéma et les types TypeScript doivent rester alignés.
type SchemaData = z.infer<typeof studyDataSchema>;
const _check1: (d: SchemaData) => StudyData = (d) => d;
const _check2: (d: StudyData) => SchemaData = (d) => d;
void _check1;
void _check2;

/** Vérifie la cohérence référentielle et renvoie la liste des anomalies (non bloquantes). */
export function integrityIssues(d: StudyData): string[] {
  const issues: string[] = [];
  const has = (arr: { id: string }[]) => new Set(arr.map((x) => x.id));
  const bv = has(d.businessValues);
  const fe = has(d.fearedEvents);
  const sr = has(d.riskSources);
  const pairs = has(d.srovPairs);
  const sh = has(d.stakeholders);
  const paths = new Set(d.strategicScenarios.flatMap((s) => s.paths.map((p) => p.id)));
  for (const e of d.fearedEvents) if (e.businessValueId && !bv.has(e.businessValueId)) issues.push(`ER ${e.ref} : valeur métier inconnue`);
  for (const p of d.srovPairs) {
    if (!sr.has(p.riskSourceId)) issues.push(`Couple ${p.ref} : source de risque inconnue`);
    for (const f of p.fearedEventIds) if (!fe.has(f)) issues.push(`Couple ${p.ref} : ER inconnu`);
  }
  for (const s of d.strategicScenarios) {
    if (!pairs.has(s.srovId)) issues.push(`Scénario ${s.ref} : couple SR/OV inconnu`);
    for (const p of s.paths)
      for (const st of p.steps) {
        if (st.stakeholderId && !sh.has(st.stakeholderId)) issues.push(`Chemin ${p.ref} : partie prenante inconnue`);
        if (st.fearedEventId && !fe.has(st.fearedEventId)) issues.push(`Chemin ${p.ref} : ER inconnu`);
      }
  }
  for (const o of d.operationalScenarios) if (!paths.has(o.attackPathId)) issues.push(`Scénario opérationnel ${o.ref} : chemin d'attaque inconnu`);
  return issues;
}
