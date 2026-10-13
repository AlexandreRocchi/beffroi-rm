<script lang="ts">
  import type { Snippet } from "svelte";

  let { label, hint, required = false, error, children }: { label?: string | Snippet; hint?: string | Snippet | null; required?: boolean; error?: string | null; children: Snippet } = $props();
</script>

<div class="field">
  {#if label}<label class:req={required}>{#if typeof label === "function"}{@render label()}{:else}{label}{/if}</label>{/if}
  {@render children()}
  {#if hint}<div class="hint">{#if typeof hint === "function"}{@render hint()}{:else}{hint}{/if}</div>{/if}
  {#if error}<div class="error">{error}</div>{/if}
</div>
