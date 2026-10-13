<script lang="ts">
  import { ICONS } from "./icons";

  let { name, size = 16, style }: { name: string; size?: number; style?: string } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {style}>
  <path d={ICONS[name] ?? ICONS.info} />
</svg>
