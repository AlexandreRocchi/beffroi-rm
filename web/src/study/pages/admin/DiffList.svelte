<script lang="ts">
  import type { DiffEntry } from "@beffroi/shared";
  import { WS_COLORS } from "../../nav";

  let { diff }: { diff: DiffEntry[] } = $props();
  const describe = (x: DiffEntry) => [x.added && `${x.added} ajout(s)`, x.modified && `${x.modified} modification(s)`, x.removed && `${x.removed} suppression(s)`].filter(Boolean).join(", ");
</script>

{#if diff.length}
  <ul style="margin: 0; padding-left: 18px" class="small">
    {#each diff as x (x.activity)}
      <li><strong style:color={WS_COLORS[x.workshop]}>{x.workshop ? `A${x.workshop}` : "Paramètres"}</strong> · {x.activity} : {describe(x)}</li>
    {/each}
  </ul>
{:else}
  <span class="muted small">Aucune modification.</span>
{/if}
