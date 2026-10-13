<script lang="ts">
  import type { Snippet } from "svelte";

  let { checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label?: string | Snippet; disabled?: boolean } = $props();
</script>

<label class="checkbox" onclick={(e) => e.stopPropagation()}>
  <input type="checkbox" {checked} {disabled} onchange={(e) => onChange(e.currentTarget.checked)} />
  {#if typeof label === "function"}{@render label()}{:else if label}{label}{/if}
</label>
