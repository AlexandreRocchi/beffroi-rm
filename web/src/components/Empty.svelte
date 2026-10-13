<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, children, action }: { title: string; children?: Snippet; action?: Snippet } = $props();
</script>

<div class="empty">
  <h3>{title}</h3>
  {#if children}<p>{@render children()}</p>{/if}
  {@render action?.()}
</div>
