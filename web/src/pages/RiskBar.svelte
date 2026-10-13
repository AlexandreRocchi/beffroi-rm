<script lang="ts">
  import { defaultScales } from "@beffroi/shared";

  let { counts }: { counts: Record<string, number> } = $props();
  const LEVELS = [...defaultScales(4).riskLevels].reverse();
  const total = $derived(Object.values(counts).reduce((a, b) => a + b, 0));
</script>

{#if !total}
  <div class="muted small">Aucun scénario de risque</div>
{:else}
  <div>
    <div class="row" style="height: 8px; gap: 0; border-radius: 4px; overflow: hidden">
      {#each LEVELS as l (l.value)}
        {#if counts[l.value]}<div style="flex: {counts[l.value]}; background: {l.color}; height: 100%" title="{l.label} : {counts[l.value]}"></div>{/if}
      {/each}
      {#if counts["?"]}<div style="flex: {counts['?']}; background: #cfd8dc; height: 100%" title="Non évalués : {counts['?']}"></div>{/if}
    </div>
    <div class="row small muted" style="margin-top: 4px; gap: 10px">
      {#each LEVELS as l (l.value)}<span><strong style:color={l.color}>{counts[l.value] ?? 0}</strong> {l.label.toLowerCase()}</span>{/each}
    </div>
  </div>
{/if}
