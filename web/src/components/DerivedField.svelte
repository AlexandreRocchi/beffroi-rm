<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ScaleLevel } from "@beffroi/shared";
  import LevelChip from "./LevelChip.svelte";
  import LevelSelect from "./LevelSelect.svelte";
  import NumberInput from "./NumberInput.svelte";

  /** Valeur calculée avec possibilité de forçage (exigences EXI_M3_11, M3_22, M4_16, M5_09). */
  let { label, computed, forced, onForce, scale, format, disabled = false, numeric }: {
    label?: string; computed: number | null; forced: number | null; onForce: (v: number | null) => void; scale?: ScaleLevel[];
    format?: Snippet<[number | null]>; disabled?: boolean; numeric?: { min: number; max: number; step: number };
  } = $props();
  let editing = $state(false);
</script>

{#snippet fmt(v: number | null)}
  {#if format}{@render format(v)}{:else if scale}<LevelChip {scale} value={v} showLabel />{:else}{v === null ? "—" : String(v)}{/if}
{/snippet}

<div class="field">
  {#if label}<span class="label">{label}</span>{/if}
  <div class="row wrap">
    {#if forced !== null}
      <span class="badge forced" title="Valeur forcée par l'utilisateur">✎ forcé</span>
      {@render fmt(forced)}
      <span class="muted small">calculé : {#if computed === null}—{:else}{@render fmt(computed)}{/if}</span>
      {#if !disabled}
        <button class="btn sm ghost" onclick={() => onForce(null)} title="Revenir à la valeur calculée">Rétablir le calcul</button>
      {/if}
    {:else}
      {@render fmt(computed)}
      <span class="muted small">calculé</span>
      {#if !disabled && !editing}
        <button class="btn sm ghost" onclick={() => (editing = true)}>Forcer…</button>
      {/if}
    {/if}
    {#if editing && forced === null && !disabled}
      <div style="width: 200px">
        {#if scale}
          <LevelSelect {scale} value={null} placeholder="Choisir la valeur forcée" onChange={(v) => { if (v !== null) onForce(v); editing = false; }} />
        {:else}
          <NumberInput value={null} min={numeric?.min} max={numeric?.max} step={numeric?.step} onChange={(v) => { if (v !== null) { onForce(v); editing = false; } }} />
        {/if}
      </div>
    {/if}
  </div>
</div>
