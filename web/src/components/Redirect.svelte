<script lang="ts">
  import { router } from "../lib/router.svelte";

  let { to, state }: { to: string; state?: Record<string, unknown> } = $props();
  $effect(() => router.navigate(to, { replace: true, state }));
</script>
