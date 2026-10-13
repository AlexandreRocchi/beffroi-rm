<script lang="ts">
  import { outside } from "../lib/actions";
  import { normalize, type Option } from "../lib/levels";

  let { options, value, onChange, placeholder = "Ajouter…", disabled = false }: { options: Option[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string; disabled?: boolean } = $props();
  let open = $state(false);
  let q = $state("");
  const byValue = $derived(new Map(options.map((o) => [o.value, o])));
  const available = $derived(
    options
      .filter((o) => !value.includes(o.value) && normalize(o.label).includes(normalize(q)))
      .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.label.localeCompare(b.label, "fr", { numeric: true })),
  );
  function close() {
    open = false;
    q = "";
  }
  function key(e: KeyboardEvent) {
    if (e.key === "Enter" && available[0]) { onChange([...value, available[0].value]); q = ""; e.preventDefault(); }
    if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
  }
</script>

<div class="combo input" style="height: auto; padding: 0" use:outside={close}>
  <div class="chips" onclick={() => !disabled && (open = true)}>
    {#each value as v (v)}
      <span class="chip" title={byValue.get(v)?.label}>
        <span>{byValue.get(v)?.label ?? "?"}</span>
        {#if !disabled}
          <button onclick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }} aria-label="Retirer">×</button>
        {/if}
      </span>
    {/each}
    {#if !disabled}
      <input type="text" class="inline-input" style="flex: 1; min-width: 90px; height: 24px; border: 0" value={q} placeholder={value.length ? "" : placeholder} aria-label={placeholder}
        onfocus={() => (open = true)} oninput={(e) => { q = e.currentTarget.value; open = true; }} onkeydown={key} />
    {/if}
  </div>
  {#if open && !disabled}
    <div class="combo-list" role="listbox">
      {#each available as o, i (o.value)}
        {#if o.group && (i === 0 || available[i - 1].group !== o.group)}<div class="combo-group">{o.group}</div>{/if}
        <div class="combo-item" onmousedown={(e) => { e.preventDefault(); onChange([...value, o.value]); q = ""; }} title={o.hint} role="option" tabindex="-1" aria-selected="false">{o.label}</div>
      {/each}
      {#if available.length === 0}<div class="combo-item muted">Aucun élément disponible</div>{/if}
    </div>
  {/if}
</div>
