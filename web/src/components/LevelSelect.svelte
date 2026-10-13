<script lang="ts">
  import type { ScaleLevel } from "@beffroi/shared";
  import { levelColor } from "../lib/levels";

  let { scale, value, onChange, allowNull = true, disabled = false, placeholder = "—", prefix = "", ariaLabel }: {
    scale: ScaleLevel[]; value: number | null; onChange: (v: number | null) => void; allowNull?: boolean; disabled?: boolean; placeholder?: string; prefix?: string; ariaLabel?: string;
  } = $props();
  const l = $derived(scale.find((x) => x.value === value));
</script>

<select value={value ?? ""} {disabled} title={l?.description} aria-label={ariaLabel} onchange={(e) => onChange(e.currentTarget.value === "" ? null : Number(e.currentTarget.value))} style:border-left={value !== null ? `4px solid ${levelColor(scale, value)}` : undefined}>
  {#if allowNull}<option value="">{placeholder}</option>{/if}
  {#each scale as s (s.value)}
    <option value={s.value} title={s.description}>{prefix}{s.value} – {s.label}</option>
  {/each}
</select>
