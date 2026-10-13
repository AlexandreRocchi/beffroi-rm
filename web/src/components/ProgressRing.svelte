<script lang="ts">
  let { ratio, size = 18, color = "var(--primary-2)" }: { ratio: number; size?: number; color?: string } = $props();
  const r = $derived(size / 2 - 2);
  const c = $derived(2 * Math.PI * r);
</script>

<svg class="progress-ring" width={size} height={size} viewBox="0 0 {size} {size}" aria-label="{Math.round(ratio * 100)} %">
  <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--surface-3)" stroke-width="3" />
  <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={ratio >= 1 ? "var(--success)" : color} stroke-width="3" stroke-dasharray="{c * Math.min(1, ratio)} {c}" transform="rotate(-90 {size / 2} {size / 2})" stroke-linecap="round" />
  {#if ratio >= 1}
    <path d="M{size * 0.3} {size * 0.52} l{size * 0.14} {size * 0.14} l{size * 0.26} -{size * 0.3}" stroke="var(--success)" stroke-width="2" fill="none" />
  {/if}
</svg>
