<script lang="ts">
  import { sanitize } from "../lib/sanitize";
  import RichView from "./RichView.svelte";

  /** Éditeur de texte enrichi minimal : gras, italique, souligné, listes, couleur, surlignage. */
  let { value, onChange, placeholder = "", disabled = false, minHeight = 60, ariaLabel }: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; minHeight?: number; ariaLabel?: string } = $props();
  const COLORS = ["#1b2333", "#c62828", "#ef6c00", "#2e7d32", "#1d3b72", "#7b3fb5"];
  let el: HTMLDivElement | undefined = $state();
  let last = "";

  $effect(() => {
    if (el && value !== last) {
      el.innerHTML = sanitize(value);
      last = value;
    }
  });

  function emit() {
    if (!el) return;
    let html = sanitize(el.innerHTML);
    if (html === "<br>" || html === "<p><br></p>" || (!el.textContent?.trim() && !html.includes("<li"))) html = "";
    last = html;
    if (html !== value) onChange(html);
  }

  function cmd(c: string, arg?: string) {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(c, false, arg);
    el?.focus();
    emit();
  }

  function paste(e: ClipboardEvent) {
    e.preventDefault();
    const html = e.clipboardData?.getData("text/html") ?? "";
    const text = e.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertHTML", false, html ? sanitize(html) : text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string).replace(/\n/g, "<br>"));
    emit();
  }
</script>

{#if disabled}
  <div class="rte"><div class="rte-content"><RichView html={value} /></div></div>
{:else}
  <div class="rte">
    <div class="rte-toolbar" onmousedown={(e) => e.preventDefault()} role="toolbar" tabindex="-1">
      <button type="button" onclick={() => cmd("bold")} title="Gras (Ctrl+B)"><b>G</b></button>
      <button type="button" onclick={() => cmd("italic")} title="Italique (Ctrl+I)"><i>I</i></button>
      <button type="button" onclick={() => cmd("underline")} title="Souligné (Ctrl+U)"><u>S</u></button>
      <button type="button" onclick={() => cmd("insertUnorderedList")} title="Liste à puces">• ─</button>
      <button type="button" onclick={() => cmd("insertOrderedList")} title="Liste numérotée">1. ─</button>
      <span style="width: 8px"></span>
      {#each COLORS as c (c)}
        <button type="button" onclick={() => cmd("foreColor", c)} title="Couleur du texte" style="min-width: 18px">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: {c}"></span>
        </button>
      {/each}
      <button type="button" onclick={() => cmd("hiliteColor", "#fff59d")} title="Surligner" style="background: #fff59d">ab</button>
      <button type="button" onclick={() => cmd("removeFormat")} title="Effacer la mise en forme">⌫</button>
    </div>
    <div bind:this={el} class="rte-content" contenteditable="true" data-placeholder={placeholder} style="min-height: {minHeight}px"
      oninput={emit} onblur={emit} onpaste={paste} role="textbox" aria-multiline="true" aria-label={ariaLabel ?? placeholder} tabindex="0"></div>
  </div>
{/if}
