<script lang="ts">
  import type { StudySettings } from "@beffroi/shared";

  let { settings }: { settings: StudySettings } = $props();
</script>

<div class="legend">
  {#each settings.scales.riskLevels as l (l.value)}
    <span title={l.decision}><span class="sw" style:background={l.color}></span>{l.label} — {l.acceptability}</span>
  {/each}
</div>
