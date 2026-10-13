<script lang="ts">
  import Icon from "./Icon.svelte";

  let { value, onChange, placeholder = "Filtrer…" }: { value: string; onChange: (v: string) => void; placeholder?: string } = $props();
</script>

<div style="position: relative; width: 240px">
  <input type="search" {value} oninput={(e) => onChange(e.currentTarget.value)} {placeholder} style="padding-left: 28px" aria-label={placeholder} />
  <Icon name="search" size={14} style="position: absolute; left: 9px; top: 10px; color: var(--text-3)" />
</div>
