<script lang="ts">
  import { closeConfirm, confirmState } from "../lib/feedback.svelte";
  import Modal from "./Modal.svelte";
</script>

{#if confirmState.current}
  {@const c = confirmState.current}
  <Modal title={c.title} onClose={() => closeConfirm(false)}>
    <div>
      <p>{c.message}</p>
      {#if c.warning}<div class="callout warning">{c.warning}</div>{/if}
      {#if c.note}<p class="muted small">{c.note}</p>{/if}
    </div>
    {#snippet footer()}
      <button class="btn" onclick={() => closeConfirm(false)}>Annuler</button>
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn {c.danger ? 'danger solid' : 'primary'}" onclick={() => closeConfirm(true)} autofocus>{c.confirmLabel ?? "Confirmer"}</button>
    {/snippet}
  </Modal>
{/if}
