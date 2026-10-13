<script lang="ts">
  import type { StudyData } from "@beffroi/shared";
  import { FONT, wrap } from "./svg";
  import { threatMapLayout } from "./threatMap";

  let { data, residual = false, width = 1100 }: { data: StudyData; residual?: boolean; width?: number } = $props();
  const g = $derived(threatMapLayout(data, residual, width));
</script>

{#if !g}
  <div class="empty">Aucun scénario de risque intentionnel à représenter : complétez les ateliers 2 et 3.</div>
{:else}
  <svg class="viz" viewBox="0 0 {width} {g.height}" style="font-family: {FONT}" role="img" aria-label="Carte de la menace">
    {#each g.headers as h, i (h)}
      <text x={g.colX[i] + 7} y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#4a5468" letter-spacing="1">{h}</text>
    {/each}
    {#each g.links as l, i (i)}
      <path d={l.d} fill="none" stroke={l.color} stroke-opacity="0.16" stroke-width={l.width}><title>{l.title}</title></path>
    {/each}
    {#each g.nodes as n (n.id)}
      {@const lines = wrap(n.label, n.left ? 26 : 30, 2)}
      {@const x = n.left ? n.x0 - 6 : n.x1 + 6}
      {@const y = (n.y0 + n.y1) / 2}
      <g>
        <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(2, n.y1 - n.y0)} fill={n.color} rx="2"><title>{n.label}</title></rect>
        <text {x} y={y - ((lines.length - 1) * 12) / 2} text-anchor={n.left ? "end" : "start"} font-size="11.5" fill="#1b2333" font-weight="650" stroke="#fff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">
          {#each lines as t, k (k)}<tspan {x} dy={k === 0 ? 0 : 12} dominant-baseline="middle">{t}</tspan>{/each}
        </text>
      </g>
    {/each}
  </svg>
{/if}
