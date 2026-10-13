import { sankey, sankeyLinkHorizontal, type SankeyGraph } from "d3-sankey";
import { riskLevelDef, riskRows, type StudyData } from "@beffroi/shared";

interface N {
  id: string;
  label: string;
  column: number;
  color: string;
}
interface L {
  source: string;
  target: string;
  value: number;
}

const SR_COLORS = ["#3949ab", "#c62828", "#00897b", "#6a1b9a", "#ef6c00", "#5d4037", "#0277bd"];

/**
 * Carte de la menace : flux des sources de risque vers leurs objectifs visés, les valeurs métier
 * atteintes et le niveau des scénarios de risque (initial ou résiduel). Renvoie null sans données.
 */
export function threatMapLayout(data: StudyData, residual: boolean, width: number) {
  const s = data.settings;
  const rows = riskRows(data).filter((r) => r.active && r.kind === "intentional" && r.pair);
  const nodes = new Map<string, N>();
  const links = new Map<string, L>();
  const addNode = (n: N) => nodes.set(n.id, n);
  const addLink = (a: string, b: string, v: number) => {
    const k = `${a}→${b}`;
    const cur = links.get(k);
    if (cur) cur.value += v;
    else links.set(k, { source: a, target: b, value: v });
  };
  const srIndex = new Map<string, number>();
  for (const r of rows) {
    const pair = r.pair!;
    if (!srIndex.has(pair.riskSourceId)) srIndex.set(pair.riskSourceId, srIndex.size);
    const srColor = SR_COLORS[(srIndex.get(pair.riskSourceId) ?? 0) % SR_COLORS.length];
    const srId = `sr:${pair.riskSourceId}`;
    const ovId = `ov:${pair.id}`;
    addNode({ id: srId, label: r.riskSourceName, column: 0, color: srColor });
    addNode({ id: ovId, label: `${pair.ref} · ${pair.objective}`, column: 1, color: srColor });
    const lvl = residual ? r.residualLevel : r.level;
    const def = riskLevelDef(s, lvl);
    const lvId = `lv:${lvl ?? "?"}`;
    addNode({ id: lvId, label: def ? `Risque ${def.label.toLowerCase()}` : "Niveau non évalué", column: 3, color: def?.color ?? "#9e9e9e" });
    const bvs = r.businessValueIds.length ? r.businessValueIds : ["_none"];
    const w = 1 / bvs.length;
    addLink(srId, ovId, 1);
    for (const b of bvs) {
      const bv = data.businessValues.find((x) => x.id === b);
      const bvId = `bv:${b}`;
      addNode({ id: bvId, label: bv ? `${bv.ref} · ${bv.name}` : "Valeur métier non identifiée", column: 2, color: "#00897b" });
      addLink(ovId, bvId, w);
      addLink(bvId, lvId, w);
    }
  }
  if (nodes.size === 0) return null;

  const height = Math.max(320, nodes.size * 34);
  const graph = sankey<N, L>()
    .nodeId((d) => d.id)
    .nodeWidth(14)
    .nodePadding(16)
    .nodeAlign((n) => (n as unknown as N).column)
    .nodeSort((a, b) => a.column - b.column || a.label.localeCompare(b.label, "fr", { numeric: true }))
    .extent([
      [180, 40],
      [width - 240, height - 10],
    ])({ nodes: [...nodes.values()].map((n) => ({ ...n })), links: [...links.values()].map((l) => ({ ...l })) } as SankeyGraph<N, L>);
  const link = sankeyLinkHorizontal();
  return {
    height,
    headers: ["SOURCES DE RISQUE", "OBJECTIFS VISÉS", "VALEURS MÉTIER", residual ? "NIVEAU RÉSIDUEL" : "NIVEAU DE RISQUE"],
    colX: [0, 1, 2, 3].map((c) => graph.nodes.find((n) => n.column === c)?.x0 ?? 0),
    links: graph.links.map((l) => {
      const src = l.source as unknown as N;
      return {
        d: link(l as never) ?? "",
        color: src.color,
        width: Math.max(1.5, l.width ?? 1),
        title: `${src.label} → ${(l.target as unknown as N).label} : ${Math.round((l.value ?? 0) * 100) / 100} scénario(s)`,
      };
    }),
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      color: n.color,
      left: n.column === 0,
      x0: n.x0 ?? 0,
      x1: n.x1 ?? 0,
      y0: n.y0 ?? 0,
      y1: n.y1 ?? 0,
    })),
  };
}
