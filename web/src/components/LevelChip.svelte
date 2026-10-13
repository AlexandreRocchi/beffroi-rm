<script lang="ts">
  import type { ScaleLevel } from "@beffroi/shared";
  import { isLight, levelColor } from "../lib/levels";

  let { scale, value, prefix = "", showLabel = false, forced = false, title }: { scale: ScaleLevel[]; value: number | null | undefined; prefix?: string; showLabel?: boolean; forced?: boolean; title?: string } = $props();
  const l = $derived(scale.find((x) => x.value === value));
  const c = $derived(levelColor(scale, value));
</script>

{#if value === null || value === undefined}
  <span class="level-chip empty">—</span>
{:else}
  <span class="level-chip" class:light={isLight(c)} class:forced-mark={forced} style:background={c} title={title ?? (l ? `${l.label} — ${l.description}` : undefined)}>{prefix}{value}{showLabel && l ? ` · ${l.label}` : ""}</span>
{/if}
