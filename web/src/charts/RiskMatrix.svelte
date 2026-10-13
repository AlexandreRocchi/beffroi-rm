<script module lang="ts">
  export interface MatrixItem {
    id: string;
    ref: string;
    g: number | null;
    v: number | null;
    title: string;
    color?: string;
    forced?: boolean;
  }

  export interface MatrixArrow {
    id: string;
    from: { g: number; v: number };
    to: { g: number; v: number };
  }
</script>

<script lang="ts">
  import { lookup, riskLevelDef, type StudySettings } from "@beffroi/shared";
  import { FONT, wrap } from "./svg";

  /**
   * Cartographie du risque (grille gravité × vraisemblance). En mode interactif,
   * les risques peuvent être glissés vers une nouvelle case (réévaluation résiduelle, EXI_M5_08).
   */
  let { settings, items, onMove, onSelect, selectedId, arrows, title, draggable = false }: {
    settings: StudySettings; items: MatrixItem[]; onMove?: (id: string, g: number, v: number) => void; onSelect?: (id: string) => void;
    selectedId?: string | null; arrows?: MatrixArrow[]; title?: string; draggable?: boolean;
  } = $props();

  const CW = 118;
  const CH = 74;
  const LEFT = 128;
  const TOP = 26;
  const gs = $derived([...settings.scales.gravity].sort((a, b) => b.value - a.value));
  const vs = $derived([...settings.scales.likelihood].sort((a, b) => a.value - b.value));
  const W = $derived(LEFT + vs.length * CW + 10);
  const top = $derived(TOP + (title ? 20 : 0));
  const H = $derived(top + gs.length * CH + 58);
  let svgEl: SVGSVGElement | undefined = $state();
  let drag = $state<{ id: string; x: number; y: number } | null>(null);
  // Identifiant unique du marqueur de flèche (plusieurs matrices sur une même page).
  const markerId = `fleche-${Math.random().toString(36).slice(2, 8)}`;

  const cellX = (v: number) => LEFT + vs.findIndex((l) => l.value === v) * CW;
  const cellY = (g: number) => top + gs.findIndex((l) => l.value === g) * CH;

  const positions = $derived.by(() => {
    const byCell = new Map<string, MatrixItem[]>();
    for (const it of items) {
      if (it.g === null || it.v === null) continue;
      const k = `${it.g}:${it.v}`;
      byCell.set(k, [...(byCell.get(k) ?? []), it]);
    }
    const out = new Map<string, { x: number; y: number }>();
    for (const list of byCell.values()) {
      const perRow = 4;
      const rows = Math.ceil(list.length / perRow);
      list.forEach((it, i) => {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, list.length - row * perRow);
        out.set(it.id, {
          x: cellX(it.v as number) + CW / 2 + (col - (inRow - 1) / 2) * 27,
          y: cellY(it.g as number) + CH / 2 + (row - (rows - 1) / 2) * 27,
        });
      });
    }
    return out;
  });
  const placed = $derived(items.filter((i) => i.g !== null && i.v !== null));
  const unplaced = $derived(items.filter((i) => i.g === null || i.v === null));

  function toSvg(e: PointerEvent) {
    if (!svgEl) return { x: 0, y: 0 };
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svgEl.getScreenCTM();
    const p = m ? pt.matrixTransform(m.inverse()) : pt;
    return { x: p.x, y: p.y };
  }

  function cellAt(x: number, y: number) {
    const vi = Math.floor((x - LEFT) / CW);
    const gi = Math.floor((y - top) / CH);
    if (vi < 0 || vi >= vs.length || gi < 0 || gi >= gs.length) return null;
    return { g: gs[gi].value, v: vs[vi].value };
  }

  function up(e: PointerEvent) {
    if (!drag) return;
    const p = toSvg(e);
    const c = cellAt(p.x, p.y);
    if (c && onMove) onMove(drag.id, c.g, c.v);
    drag = null;
  }
</script>

<div>
  <svg bind:this={svgEl} class="viz" viewBox="0 0 {W} {H}" style="font-family: {FONT}; max-width: {W}px; touch-action: none" role="img" aria-label={title ?? "Cartographie du risque"}
    onpointermove={(e) => drag && (drag = { ...drag, ...toSvg(e) })} onpointerup={up} onpointerleave={() => (drag = null)}>
    <defs>
      <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#1b2333" />
      </marker>
    </defs>
    {#if title}<text x={W / 2} y="16" text-anchor="middle" font-weight="700" font-size="14" fill="#1b2333">{title}</text>{/if}
    <text x="14" y={top + (gs.length * CH) / 2} transform="rotate(-90 14 {top + (gs.length * CH) / 2})" text-anchor="middle" font-size="11" font-weight="700" fill="#4a5468" letter-spacing="1">GRAVITÉ</text>
    {#each gs as g (g.value)}
      <text x={LEFT - 8} y={cellY(g.value) + CH / 2 - 7} text-anchor="end" font-size="12" font-weight="700" fill="#1b2333">G{g.value}</text>
      <text x={LEFT - 8} y={cellY(g.value) + CH / 2 + 8} text-anchor="end" font-size="10.5" fill="#4a5468">{g.label}</text>
    {/each}
    {#each vs as v (v.value)}
      <text x={cellX(v.value) + CW / 2} y={top + gs.length * CH + 16} text-anchor="middle" font-size="12" font-weight="700" fill="#1b2333">V{v.value}</text>
      <text x={cellX(v.value) + CW / 2} y={top + gs.length * CH + 31} text-anchor="middle" font-size="10.5" fill="#4a5468">{wrap(v.label, 18, 1)[0]}</text>
    {/each}
    <text x={LEFT + (vs.length * CW) / 2} y={top + gs.length * CH + 50} text-anchor="middle" font-size="11" font-weight="700" fill="#4a5468" letter-spacing="1">VRAISEMBLANCE</text>
    {#each gs as g (g.value)}
      {#each vs as v (v.value)}
        {@const def = riskLevelDef(settings, lookup(settings.riskMatrix, g.value, v.value))}
        <rect x={cellX(v.value)} y={cellY(g.value)} width={CW} height={CH} fill={def?.color ?? "#eceff1"} fill-opacity="0.72" stroke="#fff" stroke-width="2">
          <title>{`G${g.value} × V${v.value} : ${def?.label ?? "non défini"}${def ? ` — ${def.acceptability}` : ""}`}</title>
        </rect>
      {/each}
    {/each}
    {#each arrows ?? [] as a (a.id)}
      {@const x1 = cellX(a.from.v) + CW / 2}
      {@const y1 = cellY(a.from.g) + CH / 2}
      {@const x2 = cellX(a.to.v) + CW / 2}
      {@const y2 = cellY(a.to.g) + CH / 2}
      {#if x1 !== x2 || y1 !== y2}
        <line {x1} {y1} {x2} {y2} stroke="#1b2333" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#{markerId})" opacity="0.6" />
      {/if}
    {/each}
    {#each placed as it (it.id)}
      {@const p = drag?.id === it.id ? { x: drag.x, y: drag.y } : positions.get(it.id) ?? { x: 0, y: 0 }}
      {@const selected = selectedId === it.id}
      <g transform="translate({p.x} {p.y})" style:cursor={draggable ? "grab" : onSelect ? "pointer" : "default"}
        onpointerdown={(e) => {
          if (draggable) {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            drag = { id: it.id, ...toSvg(e) };
          }
        }}
        onclick={() => onSelect?.(it.id)}>
        <title>{it.title}</title>
        <circle r="13" fill={it.color ?? "#1b2333"} stroke={selected ? "#fff" : "rgba(255,255,255,.9)"} stroke-width={selected ? 3.5 : 1.5} stroke-dasharray={it.forced ? "3 2" : undefined} />
        {#if selected}<circle r="17" fill="none" stroke="#1d3b72" stroke-width="2" />{/if}
        <text text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="800" fill="#fff" pointer-events="none">{it.ref}</text>
      </g>
    {/each}
  </svg>
  {#if unplaced.length > 0}
    <div class="muted small">Non positionnés (gravité ou vraisemblance manquante) : {unplaced.map((u) => u.ref).join(", ")}</div>
  {/if}
</div>
