<script lang="ts">
  import { PROTECTION_MARKS } from "@beffroi/shared";

  let { mark }: { mark: string } = $props();
  const m = $derived(PROTECTION_MARKS.find((x) => x.id === mark));
</script>

<div class="protection-banner" style:background={m?.color ?? "#555"} title="Mention de protection de l'analyse de risque">{m?.label ?? mark}</div>
