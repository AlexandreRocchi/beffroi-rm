<script lang="ts" generics="T extends string">
  let { tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void } = $props();
</script>

<div class="tabs" role="tablist">
  {#each tabs as t (t.id)}
    <button role="tab" aria-selected={t.id === value} class:active={t.id === value} onclick={() => onChange(t.id)}>{t.label}</button>
  {/each}
</div>
