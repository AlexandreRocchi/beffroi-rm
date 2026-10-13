<script lang="ts">
  import { evaluateGraph, type OperationalScenario, type StudyData } from "@beffroi/shared";
  import { ACTION_H, ACTION_W, LANE_W, nodeSize } from "./attackGraph";
  import MultiText from "./MultiText.svelte";
  import { FONT, wrap } from "./svg";

  /** Rendu SVG statique d'un graphe d'attaque (rapports et exports). */
  let { data, scenario }: { data: StudyData; scenario: OperationalScenario } = $props();

  const G = $derived.by(() => {
    const s = data.settings;
    const phases = s.catalogs.attackPhases;
    const method = s.likelihoodMethod === "express" ? "standard" : s.likelihoodMethod;
    const ev = evaluateGraph(s, scenario, method);
    const crit = new Set(ev.criticalNodeIds);
    const critE = new Set(ev.criticalEdgeIds);
    const maxX = Math.max((phases.length + 1) * LANE_W, ...scenario.nodes.map((n) => n.x + nodeSize(n.type).w + 20));
    const maxY = Math.max(260, ...scenario.nodes.map((n) => n.y + nodeSize(n.type).h + 30));
    const nodes = new Map(scenario.nodes.map((n) => [n.id, n]));
    const assets = new Map(data.supportingAssets.map((a) => [a.id, a]));
    const sh = new Map(data.stakeholders.map((a) => [a.id, a]));
    const edges = scenario.edges.flatMap((e) => {
      const a = nodes.get(e.source), b = nodes.get(e.target);
      if (!a || !b) return [];
      const sa = nodeSize(a.type), sb = nodeSize(b.type);
      let d: string;
      if (b.x < a.x + sa.w - 10 && b.x + sb.w > a.x + 10) {
        // Nœuds dans le même couloir : liaison verticale.
        const down = b.y > a.y;
        const x1 = a.x + sa.w / 2, y1 = down ? a.y + sa.h : a.y, x2 = b.x + sb.w / 2, y2 = down ? b.y - 2 : b.y + sb.h + 2;
        const my = (y1 + y2) / 2;
        d = `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
      } else {
        const x1 = a.x + sa.w, y1 = a.y + sa.h / 2, x2 = b.x, y2 = b.y + sb.h / 2;
        const mx = (x1 + x2) / 2;
        d = `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 2} ${y2}`;
      }
      return [{ id: e.id, d, critical: critE.has(e.id), dashed: e.dashed }];
    });
    const actions = scenario.nodes.map((n) => {
      const r = ev.nodes[n.id];
      return {
        n,
        critical: crit.has(n.id),
        phase: phases.find((p) => p.id === n.phaseId),
        asset: n.supportingAssetId ? assets.get(n.supportingAssetId)?.name : n.stakeholderId ? sh.get(n.stakeholderId)?.name : null,
        badge: method === "advanced" ? `Pr ${n.probability ?? "?"} · D ${n.difficulty ?? "?"}` : `Pr ${n.probability ?? "?"}`,
        cum: method === "advanced" ? `(${r?.pr ?? "–"}/${r?.diff ?? "–"})` : `(${r?.pr ?? "–"})`,
      };
    });
    return { lanes: [...phases, { id: "goal", label: "Objectif visé", color: "#1b2333" }], maxX, maxY, edges, actions };
  });
</script>

<svg class="viz" viewBox="0 0 {G.maxX} {G.maxY}" style="font-family: {FONT}; max-width: {G.maxX}px" role="img" aria-label="Graphe d'attaque {scenario.ref}">
  <defs>
    <marker id="sag-{scenario.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#607d8b" /></marker>
    <marker id="sag-c-{scenario.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#d32f2f" /></marker>
  </defs>
  {#each G.lanes as p, i (p.id)}
    <rect x={i * LANE_W} y="0" width={LANE_W} height={G.maxY} fill={i % 2 ? "#f8f9fc" : "#ffffff"} />
    <rect x={i * LANE_W} y="0" width={LANE_W} height="4" fill={p.color} />
    <text x={i * LANE_W + LANE_W / 2} y="20" text-anchor="middle" font-size="12" font-weight="800" fill={p.color} letter-spacing="1">{p.label.toUpperCase()}</text>
  {/each}
  {#each G.edges as e (e.id)}
    <path d={e.d} fill="none" stroke={e.critical ? "#d32f2f" : "#90a4ae"} stroke-width={e.critical ? 2.6 : 1.6} stroke-dasharray={e.dashed ? "6 4" : undefined} marker-end="url(#{e.critical ? 'sag-c-' : 'sag-'}{scenario.id})" />
  {/each}
  {#each G.actions as { n, critical, phase, asset, badge, cum } (n.id)}
    {#if n.type === "and" || n.type === "or"}
      <circle cx={n.x + 23} cy={n.y + 23} r="23" fill={n.type === "and" ? "#37474f" : "#6d4c41"} stroke={critical ? "#d32f2f" : "#fff"} stroke-width={critical ? 3 : 2} />
      <text x={n.x + 23} y={n.y + 23} text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="11" font-weight="800">{n.type === "and" ? "ET" : "OU"}</text>
    {:else if n.type === "goal"}
      <rect x={n.x} y={n.y} width="190" height="56" rx="10" fill="#1b2333" stroke={critical ? "#d32f2f" : "none"} stroke-width="3" />
      <MultiText x={n.x + 95} y={n.y + 28} lines={wrap(n.label, 30, 3)} fill="#fff" fontSize={11} fontWeight={700} />
    {:else}
      <rect x={n.x} y={n.y} width={ACTION_W} height={ACTION_H} rx="7" fill="#fff" stroke={critical ? "#d32f2f" : "#c3cad8"} stroke-width={critical ? 2.4 : 1.2} />
      <rect x={n.x} y={n.y} width={ACTION_W} height="4" fill={phase?.color ?? "#2c5aa8"} />
      <MultiText x={n.x + ACTION_W / 2} y={n.y + 26} lines={wrap(n.label, 34, 2)} fontSize={10.5} fontWeight={650} fill="#1b2333" />
      {#if asset}<text x={n.x + 8} y={n.y + 52} font-size="9.5" fill="#4a5468">{wrap(asset, 38, 1)[0]}</text>{/if}
      <text x={n.x + 8} y={n.y + 68} font-size="10" font-weight="700" fill="#1d3b72">{badge}</text>
      <text x={n.x + ACTION_W - 8} y={n.y + 68} text-anchor="end" font-size="10" font-style="italic" fill={critical ? "#d32f2f" : "#4a5468"}>{cum}</text>
    {/if}
  {/each}
</svg>
