<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<span class="ref">{@render children()}</span>
