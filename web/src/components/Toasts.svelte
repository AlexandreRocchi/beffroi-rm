<script lang="ts">
  import { toasts } from "../lib/feedback.svelte";
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts as t (t.id)}<div class="toast {t.kind}">{t.text}</div>{/each}
</div>
