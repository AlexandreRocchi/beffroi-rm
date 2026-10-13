<script lang="ts">
  import type { Snippet } from "svelte";
  import { escape } from "../lib/actions";
  import Icon from "./Icon.svelte";

  let { title, onClose, children, footer, wide = false, extra }: { title: string | Snippet; onClose: () => void; children: Snippet; footer?: Snippet; wide?: boolean; extra?: Snippet } = $props();
</script>

<div class="drawer-backdrop" onclick={onClose}></div>
<div class="drawer" class:wide role="dialog" aria-modal="true" tabindex="-1" use:escape={onClose}>
  <div class="drawer-head">
    <h2>{#if typeof title === "function"}{@render title()}{:else}{title}{/if}</h2>
    {@render extra?.()}
    <button class="btn ghost icon" onclick={onClose} title="Fermer (Échap)"><Icon name="close" /></button>
  </div>
  <div class="drawer-body">{@render children()}</div>
  {#if footer}<div class="drawer-foot">{@render footer()}</div>{/if}
</div>
