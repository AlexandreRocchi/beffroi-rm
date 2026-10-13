<script lang="ts">
  import { sanitize } from "../lib/sanitize";

  let { html, clamp = false, class: cls = "" }: { html: string; clamp?: boolean; class?: string } = $props();
</script>

{#if html}<div class="rich {cls}" class:clamp>{@html sanitize(html)}</div>{/if}
