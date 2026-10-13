<script lang="ts">
  import type { StudyData } from "@beffroi/shared";
  import Radar from "./Radar.svelte";
  import { srovRadar } from "./radar";

  let { data, mode, onlyRetained = false, onPointClick, selectedId, size }: {
    data: StudyData; mode: "source" | "objective"; onlyRetained?: boolean; onPointClick?: (id: string) => void; selectedId?: string | null; size?: number;
  } = $props();
  const r = $derived(srovRadar(data, mode, onlyRetained));
</script>

<Radar sectors={r.sectors} rings={r.rings} points={r.points} {onPointClick} {selectedId} centerLabel="OBJET" {size} />
