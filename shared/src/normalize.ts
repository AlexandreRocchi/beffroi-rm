/**
 * Maintient la cohérence référentielle d'un document après modification :
 * supprime les références vers des objets disparus et les objets qui n'ont plus de sens
 * sans leur parent (ER d'une valeur métier supprimée, couples d'une source supprimée…).
 * Mutation en place (compatible avec les brouillons immer).
 */
import { syncRisks } from "./engine.js";
import type { StudyData } from "./types.js";

const ids = (arr: { id: string }[]) => new Set(arr.map((x) => x.id));
const keep = (list: string[], set: Set<string>) => list.filter((x) => set.has(x));

export function normalizeStudy(d: StudyData): StudyData {
  const participants = ids(d.framing.participants);
  for (const w of Object.keys(d.framing.raci)) {
    for (const pid of Object.keys(d.framing.raci[w])) if (!participants.has(pid)) delete d.framing.raci[w][pid];
  }
  if (d.framing.riskOwnerId && !participants.has(d.framing.riskOwnerId)) d.framing.riskOwnerId = null;

  const missions = ids(d.missions);
  for (const b of d.businessValues) b.missionIds = keep(b.missionIds, missions);
  const bvs = ids(d.businessValues);
  for (const a of d.supportingAssets) a.businessValueIds = keep(a.businessValueIds, bvs);
  d.fearedEvents = d.fearedEvents.filter((e) => e.businessValueId === null || bvs.has(e.businessValueId));
  const fes = ids(d.fearedEvents);

  const sources = ids(d.riskSources);
  d.srovPairs = d.srovPairs.filter((p) => sources.has(p.riskSourceId));
  for (const p of d.srovPairs) p.fearedEventIds = keep(p.fearedEventIds, fes);
  const pairs = ids(d.srovPairs);

  const shs = ids(d.stakeholders);
  for (const s of d.stakeholders) if (s.parentId && !shs.has(s.parentId)) s.parentId = null;

  d.strategicScenarios = d.strategicScenarios.filter((s) => pairs.has(s.srovId));
  for (const s of d.strategicScenarios) {
    for (const p of s.paths) {
      p.steps = p.steps.filter(
        (st) => (st.kind === "intermediate" ? !st.stakeholderId || shs.has(st.stakeholderId) : !st.fearedEventId || fes.has(st.fearedEventId)),
      );
      for (const st of p.steps) {
        if (st.kind === "intermediate") st.fearedEventId = null;
        else st.stakeholderId = null;
      }
    }
  }
  const paths = new Set(d.strategicScenarios.flatMap((s) => s.paths.map((p) => p.id)));
  d.operationalScenarios = d.operationalScenarios.filter((o) => paths.has(o.attackPathId));

  const assets = ids(d.supportingAssets);
  const phases = ids(d.settings.catalogs.attackPhases);
  const catalog = ids(d.settings.catalogs.elementaryActions);
  for (const o of d.operationalScenarios) {
    const nodes = ids(o.nodes);
    o.edges = o.edges.filter((e) => nodes.has(e.source) && nodes.has(e.target) && e.source !== e.target);
    for (const n of o.nodes) {
      if (n.supportingAssetId && !assets.has(n.supportingAssetId)) n.supportingAssetId = null;
      if (n.stakeholderId && !shs.has(n.stakeholderId)) n.stakeholderId = null;
      if (n.phaseId && !phases.has(n.phaseId)) n.phaseId = null;
      if (n.catalogActionId && !catalog.has(n.catalogActionId)) n.catalogActionId = null;
    }
    for (const m of o.operatingModes) m.nodeIds = keep(m.nodeIds, nodes);
  }

  d.risks = syncRisks(d);
  const risks = ids(d.risks);
  const reqs = new Set(d.baseline.referentials.flatMap((r) => r.requirements.map((q) => q.id)));
  for (const m of d.measures) {
    m.businessValueIds = keep(m.businessValueIds, bvs);
    m.supportingAssetIds = keep(m.supportingAssetIds, assets);
    m.stakeholderIds = keep(m.stakeholderIds, shs);
    m.riskIds = keep(m.riskIds, risks);
    m.requirementIds = keep(m.requirementIds, reqs);
  }
  return d;
}

/** Décompte des objets supprimés en cascade (pour la confirmation de suppression). */
export function cascadeImpact(before: StudyData, after: StudyData): string[] {
  const out: string[] = [];
  const diff = (label: string, a: unknown[], b: unknown[]) => {
    const n = a.length - b.length;
    if (n > 0) out.push(`${n} ${label}`);
  };
  diff("événement(s) redouté(s)", before.fearedEvents, after.fearedEvents);
  diff("couple(s) SR/OV", before.srovPairs, after.srovPairs);
  diff("scénario(s) stratégique(s)", before.strategicScenarios, after.strategicScenarios);
  diff(
    "étape(s) de chemin d'attaque",
    before.strategicScenarios.flatMap((s) => s.paths.flatMap((p) => p.steps)),
    after.strategicScenarios.flatMap((s) => s.paths.flatMap((p) => p.steps)),
  );
  diff("scénario(s) opérationnel(s)", before.operationalScenarios, after.operationalScenarios);
  diff("scénario(s) de risque", before.risks, after.risks);
  return out;
}
