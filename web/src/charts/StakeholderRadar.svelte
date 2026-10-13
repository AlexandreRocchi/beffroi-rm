<script lang="ts">
  import type { StudyData } from "@beffroi/shared";
  import Radar from "./Radar.svelte";
  import { stakeholderRadar } from "./radar";

  let { data, residual = false, onPointClick, selectedId, size, title }: {
    data: StudyData; residual?: boolean; onPointClick?: (id: string) => void; selectedId?: string | null; size?: number; title?: string;
  } = $props();
  const r = $derived(stakeholderRadar(data, residual));
</script>

<Radar sectors={r.sectors} rings={r.rings} points={r.points} {onPointClick} {selectedId} centerLabel="OBJET" {size} {title} />
