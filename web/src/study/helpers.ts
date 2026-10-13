import { stripHtml, type StudyData, type Zone } from "@beffroi/shared";
import type { Option } from "../lib/levels";

export function buildOptions(d: StudyData) {
  const cat = d.settings.catalogs;
  const mission: Option[] = d.missions.map((m) => ({ value: m.id, label: `${m.ref} · ${m.name}` }));
  const bv: Option[] = d.businessValues.map((b) => ({ value: b.id, label: `${b.ref} · ${b.name}` }));
  const asset: Option[] = d.supportingAssets.map((a) => ({
    value: a.id,
    label: `${a.ref} · ${a.name}`,
    group: cat.supportingAssetTypes.find((t) => t.id === a.typeId)?.group ?? "Autres",
  }));
  const fe: Option[] = d.fearedEvents.map((e) => ({
    value: e.id,
    label: `${e.ref} · ${e.name}`,
    group: d.businessValues.find((b) => b.id === e.businessValueId)?.name ?? "Non liés à une valeur métier",
  }));
  const sh: Option[] = d.stakeholders.map((s) => ({ value: s.id, label: `${s.ref} · ${s.name}`, group: cat.stakeholderCategories.find((c) => c.id === s.categoryId)?.label ?? "Sans catégorie" }));
  const sr: Option[] = d.riskSources.map((s) => ({ value: s.id, label: `${s.ref} · ${s.name}` }));
  const pair: Option[] = d.srovPairs.map((p) => ({
    value: p.id,
    label: `${d.riskSources.find((s) => s.id === p.riskSourceId)?.name ?? "?"} / ${p.objective}`,
    group: p.retained ? "Couples retenus" : "Couples non retenus",
  }));
  const path: Option[] = d.strategicScenarios.flatMap((s) => s.paths.map((p) => ({ value: p.id, label: `${s.ref}.${p.ref} · ${p.name}`, group: `${s.ref} · ${s.name}` })));
  const risk: Option[] = d.risks.map((r) => ({ value: r.id, label: `${r.ref} · ${r.title}` }));
  const req: Option[] = d.baseline.referentials.flatMap((r) => r.requirements.map((q) => ({ value: q.id, label: `${q.ref} · ${q.title}`, group: r.name })));
  const category = {
    sr: cat.riskSourceCategories.map((c) => ({ value: c.id, label: c.label, hint: c.description })),
    ov: cat.targetObjectiveCategories.map((c) => ({ value: c.id, label: c.label, hint: c.description })),
    pp: cat.stakeholderCategories.map((c) => ({ value: c.id, label: c.label, group: c.internal ? "Internes" : "Externes" })),
    impact: cat.impactCategories.map((c) => ({ value: c.id, label: c.label })),
    assetType: cat.supportingAssetTypes.map((c) => ({ value: c.id, label: c.label, group: c.group, hint: c.description })),
    phase: cat.attackPhases.map((p) => ({ value: p.id, label: p.label })),
  };
  return { mission, bv, asset, fe, sh, sr, pair, path, risk, req, category };
}

export function nameOf<T extends { id: string; name?: string; title?: string; ref?: string }>(list: T[], id: string | null | undefined, withRef = false): string {
  const x = list.find((i) => i.id === id);
  if (!x) return "—";
  const n = x.name ?? x.title ?? "";
  return withRef && x.ref ? `${x.ref} · ${n}` : n;
}

export function shortText(html: string, max = 140): string {
  const t = stripHtml(html).replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function pct(n: number) {
  return `${Math.round(n * 100)} %`;
}

export const ZONE_BADGE: Record<Zone, string> = { danger: "red", control: "orange", watch: "green", out: "" };

/** Critères de cotation des parties prenantes (fiche méthode 5). */
export const STAKEHOLDER_CRITERIA = [
  ["dependency", "D", "Dépendance"],
  ["penetration", "P", "Pénétration"],
  ["maturity", "M", "Maturité cyber"],
  ["trust", "C", "Confiance"],
] as const;
