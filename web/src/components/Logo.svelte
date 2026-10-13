<script lang="ts">
  import { BRAND } from "../lib/brand";
  import LogoMark from "./LogoMark.svelte";

  /** Logo complet : écusson + nom du produit (+ signature facultative). */
  let { size = 34, inverted = false, tagline = false }: { size?: number; inverted?: boolean; tagline?: boolean } = $props();
</script>

<span class="logo" class:inverted>
  <LogoMark {size} {inverted} />
  <span class="logo-text">
    <span class="logo-name">{BRAND.name}</span>
    {#if tagline}<span class="logo-tagline">{BRAND.tagline}</span>{/if}
  </span>
</span>
