<script lang="ts">
  import { outside } from "../lib/actions";
  import { normalize, type Option } from "../lib/levels";

  /** Liste déroulante triée avec saisie prédictive (annexe A du cahier des charges). */
  let { options, value, onChange, placeholder = "Rechercher…", disabled = false, allowNull = true, sort = true, ariaLabel }: {
    options: Option[]; value: string | null; onChange: (v: string | null) => void; placeholder?: string; disabled?: boolean; allowNull?: boolean; sort?: boolean; ariaLabel?: string;
  } = $props();
  let open = $state(false);
  let q = $state("");
  let hl = $state(0);
  const sorted = $derived(sort ? [...options].sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.label.localeCompare(b.label, "fr", { numeric: true })) : options);
  const filtered = $derived(sorted.filter((o) => normalize(o.label + " " + (o.hint ?? "")).includes(normalize(q))));
  const current = $derived(options.find((o) => o.value === value));
  function close() {
    open = false;
    q = "";
  }
  function pick(v: string | null) {
    onChange(v);
    close();
  }
  function key(e: KeyboardEvent) {
    if (e.key === "ArrowDown") { hl = Math.min(filtered.length - 1, hl + 1); e.preventDefault(); }
    if (e.key === "ArrowUp") { hl = Math.max(0, hl - 1); e.preventDefault(); }
    if (e.key === "Enter" && filtered[hl]) { pick(filtered[hl].value); e.preventDefault(); }
    if (e.key === "Escape") close();
  }
</script>

<div class="combo" use:outside={close}>
  <input type="text" {disabled} value={open ? q : (current?.label ?? "")} placeholder={current ? current.label : placeholder} title={current?.label} aria-label={ariaLabel}
    onfocus={() => (open = true)} oninput={(e) => { q = e.currentTarget.value; open = true; hl = 0; }} onkeydown={key} />
  {#if open && !disabled}
    <div class="combo-list" onwheel={(e) => e.stopPropagation()} role="listbox">
      {#if allowNull}<div class="combo-item muted" onmousedown={() => pick(null)} role="option" tabindex="-1" aria-selected={value === null}>— Aucun —</div>{/if}
      {#each filtered as o, i (o.value)}
        {#if o.group && (i === 0 || filtered[i - 1].group !== o.group)}<div class="combo-group">{o.group}</div>{/if}
        <div class="combo-item" class:hl={i === hl} class:sel={o.value === value} onmousedown={() => pick(o.value)} title={o.hint} role="option" tabindex="-1" aria-selected={o.value === value}>{o.label}</div>
      {/each}
      {#if filtered.length === 0}<div class="combo-item muted">Aucun résultat</div>{/if}
    </div>
  {/if}
</div>
