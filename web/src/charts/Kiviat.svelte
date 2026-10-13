<script lang="ts">
  import { FONT, wrap } from "./svg";

  /** Diagramme de Kiviat (radar) de couverture, 0 à 100 % par axe (guide p.29, note 14). */
  let { axes, size = 520, title }: { axes: { label: string; value: number | null }[]; size?: number; title?: string } = $props();
  const W = $derived(size + 240);
  const H = $derived(size);
  const cx = $derived(W / 2);
  const cy = $derived(H / 2 + (title ? 8 : 0));
  const R = $derived(size / 2 - 60);
  const n = $derived(Math.max(3, axes.length));
  const pts = $derived(axes.map((a, i) => ({ ang: -Math.PI / 2 + (i / n) * 2 * Math.PI, a })));
  const xy = (ang: number, r: number) => `${cx + Math.cos(ang) * r * R},${cy + Math.sin(ang) * r * R}`;
</script>

<svg class="viz" viewBox="0 0 {W} {H + (title ? 12 : 0)}" style="font-family: {FONT}; max-width: {W}px" role="img" aria-label={title ?? "Radar de conformité"}>
  {#if title}<text x={cx} y="16" text-anchor="middle" font-weight="700" font-size="14" fill="#1b2333">{title}</text>{/if}
  {#each [0.25, 0.5, 0.75, 1] as r (r)}
    <polygon points={pts.map((p) => xy(p.ang, r)).join(" ")} fill={r === 1 ? "#f8f9fc" : "none"} stroke="#cfd6e4" stroke-width="1" />
    <text x={cx + 3} y={cy - r * R} font-size="11" fill="#7a8497">{r * 100} %</text>
  {/each}
  {#each pts as p, i (i)}
    <line x1={cx} y1={cy} x2={cx + Math.cos(p.ang) * R} y2={cy + Math.sin(p.ang) * R} stroke="#cfd6e4" />
  {/each}
  {#if axes.length >= 1}
    <polygon points={pts.map((p) => xy(p.ang, p.a.value ?? 0)).join(" ")} fill="rgba(44,90,168,.25)" stroke="#2c5aa8" stroke-width="2" />
  {/if}
  {#each pts as p, i (i)}
    <circle cx={cx + Math.cos(p.ang) * (p.a.value ?? 0) * R} cy={cy + Math.sin(p.ang) * (p.a.value ?? 0) * R} r="3.5" fill={p.a.value === null ? "#b0bec5" : "#2c5aa8"}>
      <title>{`${p.a.label} : ${p.a.value === null ? "non évalué" : Math.round(p.a.value * 100) + " %"}`}</title>
    </circle>
  {/each}
  {#each pts as p, i (i)}
    {@const x = cx + Math.cos(p.ang) * (R + 14)}
    {@const y = cy + Math.sin(p.ang) * (R + 14)}
    {@const lines = wrap(p.a.label, 20, 3)}
    <text {x} y={y - ((lines.length - 1) * 14) / 2} text-anchor={Math.abs(Math.cos(p.ang)) < 0.2 ? "middle" : Math.cos(p.ang) > 0 ? "start" : "end"} font-size="13" fill="#1b2333" font-weight="600">
      {#each lines as l, k (k)}<tspan {x} dy={k === 0 ? 0 : 14} dominant-baseline="middle">{l}</tspan>{/each}
    </text>
  {/each}
</svg>
