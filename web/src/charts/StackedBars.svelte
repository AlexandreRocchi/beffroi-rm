<script module lang="ts">
  export interface StackSeries {
    key: string;
    label: string;
    color: string;
  }
</script>

<script lang="ts">
  import { FONT, wrap } from "./svg";

  /** Barres horizontales empilées (ex. mesures par catégorie et statut). */
  let { rows, series, width = 560, title }: { rows: { label: string; values: Record<string, number> }[]; series: StackSeries[]; width?: number; title?: string } = $props();
  const rowH = 30;
  const left = 150;
  const top = $derived(title ? 28 : 8);
  const H = $derived(top + rows.length * rowH + 34);
  const max = $derived(Math.max(1, ...rows.map((r) => series.reduce((s, x) => s + (r.values[x.key] ?? 0), 0))));
  const scale = $derived((width - left - 40) / max);
  /** Segments positionnés de chaque ligne. */
  const layout = $derived(
    rows.map((r) => {
      let x = left;
      const segs = series
        .filter((s) => (r.values[s.key] ?? 0) > 0)
        .map((s) => {
          const v = r.values[s.key];
          const seg = { s, v, x, w: v * scale };
          x += v * scale;
          return seg;
        });
      return { r, segs, end: x, total: series.reduce((s, x2) => s + (r.values[x2.key] ?? 0), 0) };
    }),
  );
</script>

<svg class="viz" viewBox="0 0 {width} {H}" style="font-family: {FONT}; max-width: {width}px" role="img" aria-label={title ?? "Graphique"}>
  {#if title}<text x="0" y="16" font-weight="700" font-size="13" fill="#1b2333">{title}</text>{/if}
  {#each layout as row, i (row.r.label)}
    {@const y = top + i * rowH}
    <g>
      <text x={left - 8} y={y + rowH / 2} text-anchor="end" dominant-baseline="middle" font-size="11.5" fill="#1b2333">{wrap(row.r.label, 22, 1)[0]}</text>
      {#each row.segs as seg (seg.s.key)}
        <rect x={seg.x} y={y + 5} width={seg.w} height={rowH - 10} fill={seg.s.color} rx="2"><title>{`${row.r.label} — ${seg.s.label} : ${seg.v}`}</title></rect>
        {#if seg.w > 18}<text x={seg.x + seg.w / 2} y={y + rowH / 2} text-anchor="middle" dominant-baseline="middle" font-size="10.5" font-weight="700" fill="#fff">{seg.v}</text>{/if}
      {/each}
      <text x={row.end + 6} y={y + rowH / 2} dominant-baseline="middle" font-size="11" fill="#4a5468">{row.total}</text>
    </g>
  {/each}
  <g transform="translate({left} {top + rows.length * rowH + 14})">
    {#each series as s, i (s.key)}
      <g transform="translate({i * 110} 0)">
        <rect width="11" height="11" fill={s.color} rx="2" />
        <text x="15" y="6" dominant-baseline="middle" font-size="11" fill="#4a5468">{s.label}</text>
      </g>
    {/each}
  </g>
</svg>
