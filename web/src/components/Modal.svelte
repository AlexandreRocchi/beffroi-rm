<script lang="ts">
  import type { Snippet } from "svelte";
  import { escape } from "../lib/actions";
  import Icon from "./Icon.svelte";

  let { title, onClose, children, footer, wide = false }: { title: string | Snippet; onClose: () => void; children: Snippet; footer?: Snippet; wide?: boolean } = $props();
</script>

<div class="modal-backdrop" onclick={onClose}></div>
<div class="modal" class:wide role="dialog" aria-modal="true" use:escape={onClose}>
  <div class="drawer-head">
    <h2>{#if typeof title === "function"}{@render title()}{:else}{title}{/if}</h2>
    <button class="btn ghost icon" onclick={onClose} title="Fermer"><Icon name="close" /></button>
  </div>
  <div class="drawer-body">{@render children()}</div>
  {#if footer}<div class="drawer-foot">{@render footer()}</div>{/if}
</div>
