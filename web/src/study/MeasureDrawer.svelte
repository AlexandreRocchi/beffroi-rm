<script lang="ts">
  import { COST_LABELS, MEASURE_CATEGORY, MEASURE_ORIGIN, MEASURE_STATUS, type Measure } from "@beffroi/shared";
  import Drawer from "../components/Drawer.svelte";
  import Field from "../components/Field.svelte";
  import MultiSelect from "../components/MultiSelect.svelte";
  import Ref from "../components/Ref.svelte";
  import RichText from "../components/RichText.svelte";
  import { buildOptions } from "./helpers";
  import { useStudy } from "./study.svelte";
  import { confirmDelete } from "./useDelete";

  let { id, onClose }: { id: string; onClose: () => void } = $props();
  const study = useStudy();
  const d = $derived(study.d);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  const i = $derived(d.measures.findIndex((m) => m.id === id));
  const m = $derived(d.measures[i]);
  const set = (fn: (x: Measure) => void, key?: string) => study.update((x) => fn(x.measures[i]), key && `me-${id}-${key}`);
  async function remove() {
    const idx = i;
    if (await confirmDelete(study, `la mesure ${m.ref}`, (x) => void x.measures.splice(idx, 1))) onClose();
  }
  function setProgress(v: number) {
    set((x) => {
      x.progress = v;
      if (v === 100) x.status = "done";
      else if (v > 0 && x.status === "todo") x.status = "in_progress";
    }, "progress");
  }
</script>

{#if m}
  <Drawer wide {onClose}>
    {#snippet title()}<Ref>{m.ref}</Ref> Mesure de sécurité{/snippet}
    <Field label="Intitulé de la mesure" required hint="Action SMART : spécifique, mesurable, atteignable, réaliste, temporellement définie.">
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" value={m.title} autofocus disabled={ro} oninput={(e) => set((x) => void (x.title = e.currentTarget.value), "title")} />
    </Field>
    <div class="grid-3">
      <Field label="Catégorie" hint={MEASURE_CATEGORY[m.category].description}>
        <select value={m.category} disabled={ro} onchange={(e) => { const v = e.currentTarget.value as Measure["category"]; set((x) => void (x.category = v)); }}>
          {#each Object.entries(MEASURE_CATEGORY) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}
        </select>
      </Field>
      <Field label="Origine">
        <select value={m.origin} disabled={ro} onchange={(e) => { const v = e.currentTarget.value as Measure["origin"]; set((x) => void (x.origin = v)); }}>
          {#each Object.entries(MEASURE_ORIGIN) as [k, v] (k)}<option value={k}>{v}</option>{/each}
        </select>
      </Field>
      <Field label="Priorité">
        <select value={m.priority ?? ""} disabled={ro} onchange={(e) => { const v = (e.currentTarget.value || null) as Measure["priority"]; set((x) => void (x.priority = v)); }}>
          <option value="">—</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option>
        </select>
      </Field>
    </div>
    <Field label="Description"><RichText value={m.description} disabled={ro} onChange={(v) => set((x) => void (x.description = v), "desc")} /></Field>
    <Field label="Scénarios de risque traités"><MultiSelect options={opts.risk} value={m.riskIds} disabled={ro} onChange={(v) => set((x) => void (x.riskIds = v))} /></Field>
    <div class="grid-3">
      <Field label="Valeurs métier concernées"><MultiSelect options={opts.bv} value={m.businessValueIds} disabled={ro} onChange={(v) => set((x) => void (x.businessValueIds = v))} /></Field>
      <Field label="Biens supports concernés"><MultiSelect options={opts.asset} value={m.supportingAssetIds} disabled={ro} onChange={(v) => set((x) => void (x.supportingAssetIds = v))} /></Field>
      <Field label="Parties prenantes concernées"><MultiSelect options={opts.sh} value={m.stakeholderIds} disabled={ro} onChange={(v) => set((x) => void (x.stakeholderIds = v))} /></Field>
    </div>
    {#if m.origin === "baseline" || m.requirementIds.length > 0}
      <Field label="Exigences du socle traitées"><MultiSelect options={opts.req} value={m.requirementIds} disabled={ro} onChange={(v) => set((x) => void (x.requirementIds = v))} /></Field>
    {/if}
    <div class="grid-3">
      <Field label="Responsable"><input type="text" value={m.owner} disabled={ro} oninput={(e) => set((x) => void (x.owner = e.currentTarget.value), "owner")} /></Field>
      <Field label="Échéance"><input type="date" value={m.dueDate} disabled={ro} onchange={(e) => { const v = e.currentTarget.value; set((x) => void (x.dueDate = v)); }} /></Field>
      <Field label="Coût / complexité">
        <select value={m.cost ?? ""} disabled={ro} onchange={(e) => { const v = e.currentTarget.value ? (Number(e.currentTarget.value) as 1 | 2 | 3) : null; set((x) => void (x.cost = v)); }}>
          <option value="">—</option>
          {#each [1, 2, 3] as const as c (c)}<option value={c}>{COST_LABELS[c]}</option>{/each}
        </select>
      </Field>
    </div>
    <div class="grid-3">
      <Field label="Charge estimée"><input type="text" value={m.effort} disabled={ro} placeholder="ex. 10 j/h" oninput={(e) => set((x) => void (x.effort = e.currentTarget.value), "effort")} /></Field>
      <Field label="Statut">
        <select value={m.status} disabled={ro} onchange={(e) => { const v = e.currentTarget.value as Measure["status"]; set((x) => { x.status = v; if (v === "done") x.progress = 100; }); }}>
          {#each Object.entries(MEASURE_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}
        </select>
      </Field>
      <Field label="Avancement : {m.progress} %">
        <input type="range" min="0" max="100" step="5" value={m.progress} disabled={ro} aria-label="Avancement" oninput={(e) => setProgress(Number(e.currentTarget.value))} />
      </Field>
    </div>
    <Field label="Freins et difficultés de mise en œuvre"><textarea rows="2" value={m.obstacles} disabled={ro} oninput={(e) => set((x) => void (x.obstacles = e.currentTarget.value), "obst")}></textarea></Field>
    <Field label="Commentaires"><RichText value={m.comments} disabled={ro} onChange={(v) => set((x) => void (x.comments = v), "comm")} /></Field>
    {#snippet footer()}
      {#if !ro}<button class="btn danger" style="margin-right: auto" onclick={remove}>Supprimer</button>{/if}
      <button class="btn primary" onclick={onClose}>Fermer</button>
    {/snippet}
  </Drawer>
{/if}
