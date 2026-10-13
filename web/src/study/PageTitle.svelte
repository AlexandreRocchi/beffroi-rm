<script lang="ts">
  import type { Snippet } from "svelte";
  import { WORKSHOPS, WS_COLORS } from "./nav";

  let { ws, title, subtitle, actions }: { ws?: number; title: string; subtitle?: string | Snippet; actions?: Snippet } = $props();
</script>

<div class="section-title">
  <div>
    {#if ws}<div class="eyebrow" style:color={WS_COLORS[ws]}>Atelier {ws} · {WORKSHOPS[ws - 1].label}</div>{/if}
    <h1>{title}</h1>
    {#if subtitle}<div class="subtitle">{#if typeof subtitle === "function"}{@render subtitle()}{:else}{subtitle}{/if}</div>{/if}
  </div>
  {#if actions}<div class="row wrap">{@render actions()}</div>{/if}
</div>
