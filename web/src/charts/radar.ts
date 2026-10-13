import { evaluateStakeholder, pertinence, type StudyData } from "@beffroi/shared";

export interface RadarSector {
  id: string;
  label: string;
  color?: string;
}
export interface RadarRing {
  r0: number;
  r1: number;
  label: string;
  fill: string;
}
export interface RadarPoint {
  id: string;
  sectorId: string;
  /** 0 = centre, 1 = bord. */
  r: number;
  label: string;
  size: number;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  title?: string;
  bold?: boolean;
  dashed?: boolean;
}

const PALETTE = ["#3949ab", "#00897b", "#ef6c00", "#c62828", "#6a1b9a", "#2e7d32", "#5d4037", "#0277bd", "#ad1457", "#546e7a"];

/** Cartographie des sources de risque (EXI_M2_09) : distance radiale = pertinence. */
export function srovRadar(data: StudyData, mode: "source" | "objective", onlyRetained = false) {
  const s = data.settings;
  const pairs = data.srovPairs.filter((p) => !onlyRetained || p.retained);
  const sectors: RadarSector[] =
    mode === "source"
      ? data.riskSources.filter((r) => pairs.some((p) => p.riskSourceId === r.id)).map((r, i) => ({ id: r.id, label: r.name, color: PALETTE[i % PALETTE.length] }))
      : [
          ...s.catalogs.targetObjectiveCategories.filter((c) => pairs.some((p) => p.objectiveCategoryId === c.id)).map((c, i) => ({ id: c.id, label: c.label, color: PALETTE[i % PALETTE.length] })),
          ...(pairs.some((p) => !p.objectiveCategoryId) ? [{ id: "_none", label: "Sans catégorie", color: "#757575" }] : []),
        ];
  const levels = [...s.scales.pertinence].sort((a, b) => b.value - a.value);
  const n = levels.length + 1;
  const ringFill = ["#f8c9c4", "#fde3bf", "#e3f0d3", "#eceff1", "#f5f5f5"];
  const rings: RadarRing[] = [
    ...levels.map((l, i) => ({ r0: i / n, r1: (i + 1) / n, label: `Pertinence ${l.label.toLowerCase()}`, fill: ringFill[i] ?? "#eceff1" })),
    { r0: levels.length / n, r1: 1, label: "Non évaluée", fill: "#f5f5f5" },
  ];
  const points: RadarPoint[] = pairs.map((p) => {
    const pert = pertinence(s, p).value;
    const k = pert === null ? levels.length : Math.max(0, levels.findIndex((l) => l.value === pert));
    // Position dans l'anneau affinée par motivation + ressources (plus menaçant = plus central).
    const intensity = ((p.motivation ?? 0) + (p.resources ?? 0)) / 8;
    const r = (k + 0.8 - 0.6 * intensity) / n;
    const sectorId = mode === "source" ? p.riskSourceId : (p.objectiveCategoryId ?? "_none");
    const sector = sectors.find((x) => x.id === sectorId);
    const src = data.riskSources.find((x) => x.id === p.riskSourceId)?.name ?? "";
    return {
      id: p.id,
      sectorId,
      r,
      label: p.ref,
      size: 9 + (p.priority === "P1" ? 3 : 0),
      fill: p.retained ? (sector?.color ?? "#1d3b72") : "#fff",
      stroke: sector?.color ?? "#1d3b72",
      strokeWidth: 2,
      title: `${p.ref} — ${src} : ${p.objective}\nPertinence : ${pert ?? "non évaluée"}${p.retained ? " · retenu" : " · non retenu"}${p.priority ? ` · ${p.priority}` : ""}`,
      bold: p.retained,
    };
  });
  return { sectors, rings, points };
}

export function reliabilityColor(rel: number | null): string {
  if (rel === null) return "#b0bec5";
  if (rel < 4) return "#e53935";
  if (rel <= 5) return "#fb8c00";
  if (rel <= 7) return "#fdd835";
  return "#43a047";
}

export function exposureSize(exp: number | null): number {
  if (exp === null) return 6;
  if (exp < 3) return 7;
  if (exp <= 6) return 10;
  if (exp <= 9) return 13;
  return 16;
}

/** Position radiale d'un niveau de dangerosité : zones de largeur égale, du centre vers l'extérieur. */
export function dangerRadius(data: StudyData, d: number | null): number {
  const t = data.settings.dangerosity.thresholds;
  if (d === null) return 0.97;
  const all = data.stakeholders.map((s) => evaluateStakeholder(data.settings, s).initial.value ?? 0);
  const dmax = Math.max(t.danger * 2, ...all, d);
  if (d >= t.danger) return Math.max(0.03, 0.25 * (1 - (d - t.danger) / Math.max(0.001, dmax - t.danger)));
  if (d >= t.control) return 0.25 + (0.25 * (t.danger - d)) / Math.max(0.001, t.danger - t.control);
  if (d >= t.watch) return 0.5 + (0.25 * (t.control - d)) / Math.max(0.001, t.control - t.watch);
  return 0.75 + (0.22 * (t.watch - d)) / Math.max(0.001, t.watch);
}

/** Cartographie de dangerosité de l'écosystème (EXI_M3_13 / M3_26). */
export function stakeholderRadar(data: StudyData, residual = false) {
  const s = data.settings;
  const t = s.dangerosity.thresholds;
  const cats = s.catalogs.stakeholderCategories.filter((c) => data.stakeholders.some((x) => x.categoryId === c.id));
  const sectors: RadarSector[] = [
    ...cats.map((c, i) => ({ id: c.id, label: c.label, color: PALETTE[i % PALETTE.length] })),
    ...(data.stakeholders.some((x) => !x.categoryId) ? [{ id: "_none", label: "Sans catégorie", color: "#757575" }] : []),
  ];
  const rings: RadarRing[] = [
    { r0: 0, r1: 0.25, label: `Danger ≥ ${t.danger}`, fill: "#f6b6ae" },
    { r0: 0.25, r1: 0.5, label: `Contrôle ≥ ${t.control}`, fill: "#fcd9a8" },
    { r0: 0.5, r1: 0.75, label: `Veille ≥ ${t.watch}`, fill: "#d9ebc8" },
    { r0: 0.75, r1: 1, label: "Hors périmètre", fill: "#eef1f4" },
  ];
  const points: RadarPoint[] = data.stakeholders.map((sh) => {
    const ev = evaluateStakeholder(s, sh);
    const d = residual ? ev.residual.value : ev.initial.value;
    const exp = residual ? ev.residualExposure : ev.exposure;
    const rel = residual ? ev.residualReliability : ev.reliability;
    return {
      id: sh.id,
      sectorId: sh.categoryId ?? "_none",
      r: dangerRadius(data, d),
      label: sh.ref,
      size: exposureSize(exp),
      fill: reliabilityColor(rel),
      stroke: ev.critical ? "#1b2333" : "#607d8b",
      strokeWidth: ev.critical ? 3 : 1,
      bold: ev.critical,
      dashed: residual ? sh.residualForced !== null : sh.dangerForced !== null,
      title: `${sh.ref} — ${sh.name}\nDangerosité ${residual ? "résiduelle" : "initiale"} : ${d ?? "non évaluée"}\nExposition (D×P) : ${exp ?? "—"} · Fiabilité cyber (M×C) : ${rel ?? "—"}${ev.critical ? "\nPartie prenante critique" : ""}`,
    };
  });
  return { sectors, rings, points };
}
