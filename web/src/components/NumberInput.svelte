<script lang="ts">
  let { value, onChange, min, max, step, disabled = false }: { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; disabled?: boolean } = $props();
  let txt = $state("");
  $effect.pre(() => {
    txt = value === null ? "" : String(value);
  });
  function input(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    txt = v;
    if (v === "") return onChange(null);
    const n = Number(v);
    if (Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
  }
</script>

<input type="number" value={txt} {min} {max} {step} {disabled} oninput={input} />
