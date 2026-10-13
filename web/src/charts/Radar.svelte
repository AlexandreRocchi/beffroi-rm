<script lang="ts">
  import type { RadarPoint, RadarRing, RadarSector } from "./radar";
  import { FONT, wrap } from "./svg";

  /** Radar polaire générique : secteurs (catégories), anneaux (zones), points. */
  let { sectors, rings, points, size = 620, onPointClick, selectedId, centerLabel, title }: {
    sectors: RadarSector[]; rings: RadarRing[]; points: RadarPoint[]; size?: number; onPointClick?: (id: string) => void; selectedId?: string | null; centerLabel?: string; title?: string;
  } = $props();

  const W = $derived(size);
  const H = $derived(size);
  const cx = $derived(W / 2);
  const cy = $derived(H / 2 + (title ? 10 : 0));
  const R = $derived(size / 2 - 74);
  const span = $derived((2 * Math.PI) / Math.max(1, sectors.length));
  const angle0 = -Math.PI / 2;
  const at = (a: number, r: number) => [cx + Math.cos(a) * r * R, cy + Math.sin(a) * r * R] as const;

  const positioned = $derived(
    sectors.flatMap((s, si) => {
      const pts = points.filter((p) => p.sectorId === s.id).sort((a, b) => a.r - b.r);
      return pts.map((p, i) => {
        const a = angle0 + si * span + ((i + 1) / (pts.length + 1)) * span;
        const [x, y] = at(a, Math.max(0.04, p.r));
        return { p, x, y, a };
      });
    }),
  );
  const labels = $derived(
    sectors.map((s, i) => {
      const a = angle0 + (i + 0.5) * span;
      const [x, y] = at(a, 1.08);
      const lines = wrap(s.label, 18, 3);
      const anchor = Math.abs(Math.cos(a)) < 0.25 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
      return { s, x, y, lines, anchor };
    }),
  );
</script>

<svg class="viz" viewBox="0 0 {W} {H + (title ? 20 : 0)}" role="img" aria-label={title ?? "Radar"} style="font-family: {FONT}; max-width: {size}px">
  {#if title}<text x={W / 2} y="16" text-anchor="middle" font-weight="700" font-size="14" fill="#1b2333">{title}</text>{/if}
  {#each [...rings].sort((a, b) => b.r1 - a.r1) as ring (ring.label)}
    <circle {cx} {cy} r={ring.r1 * R} fill={ring.fill} stroke="#fff" stroke-width="2" />
  {/each}
  {#each rings as ring (ring.label)}
    <text x={cx + 4} y={cy - ((ring.r0 + ring.r1) / 2) * R} font-size="11.5" fill="#37474f" font-weight="650" dominant-baseline="middle" opacity="0.9" stroke="#fff" stroke-width="3" paint-order="stroke">{ring.label}</text>
  {/each}
  {#each sectors as s, i (s.id)}
    {@const end = at(angle0 + i * span, 1.02)}
    <line x1={cx} y1={cy} x2={end[0]} y2={end[1]} stroke="#fff" stroke-width="2" />
  {/each}
  {#each labels as l (l.s.id)}
    <text x={l.x} y={l.y - ((l.lines.length - 1) * 13) / 2} text-anchor={l.anchor} font-size="13.5" font-weight="750" fill={l.s.color ?? "#1b2333"}>
      {#each l.lines as line, k (k)}<tspan x={l.x} dy={k === 0 ? 0 : 13} dominant-baseline="middle">{line}</tspan>{/each}
    </text>
  {/each}
  {#if centerLabel}
    <g>
      <circle {cx} {cy} r="16" fill="#1b2333" />
      <text x={cx} y={cy} text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="8.5" font-weight="700">{centerLabel}</text>
    </g>
  {/if}
  {#each positioned as { p, x, y, a } (p.id)}
    <g style:cursor={onPointClick ? "pointer" : "default"} onclick={() => onPointClick?.(p.id)}>
      <title>{p.title ?? p.label}</title>
      <circle cx={x} cy={y} r={p.size} fill={p.fill} stroke={selectedId === p.id ? "#1d3b72" : p.stroke} stroke-width={selectedId === p.id ? 3.5 : (p.strokeWidth ?? 1.5)} stroke-dasharray={p.dashed ? "3 2" : undefined} />
      <text x={x + (Math.cos(a) >= 0 ? p.size + 3 : -p.size - 3)} {y} text-anchor={Math.cos(a) >= 0 ? "start" : "end"} dominant-baseline="middle" font-size="12" font-weight={p.bold ? 800 : 600} fill="#1b2333" stroke="#fff" stroke-width="3" paint-order="stroke">{p.label}</text>
    </g>
  {/each}
</svg>
