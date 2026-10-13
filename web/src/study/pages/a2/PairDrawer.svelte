<script lang="ts">
  import { pertinence, srovGravity, type SrovPair } from "@beffroi/shared";
  import Checkbox from "../../../components/Checkbox.svelte";
  import Combo from "../../../components/Combo.svelte";
  import DerivedField from "../../../components/DerivedField.svelte";
  import Drawer from "../../../components/Drawer.svelte";
  import Field from "../../../components/Field.svelte";
  import LevelChip from "../../../components/LevelChip.svelte";
  import LevelSelect from "../../../components/LevelSelect.svelte";
  import MultiSelect from "../../../components/MultiSelect.svelte";
  import Ref from "../../../components/Ref.svelte";
  import RichText from "../../../components/RichText.svelte";
  import { buildOptions } from "../../helpers";
  import { useStudy } from "../../study.svelte";
  import { confirmDelete } from "../../useDelete";

  let { id, onClose }: { id: string; onClose: () => void } = $props();
  const study = useStudy();
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  const i = $derived(d.srovPairs.findIndex((x) => x.id === id));
  const p = $derived(d.srovPairs[i]);
  const pert = $derived(p ? pertinence(s, p) : null);
  const ovCat = $derived(s.catalogs.targetObjectiveCategories.find((c) => c.id === p?.objectiveCategoryId));
  const set = (fn: (x: SrovPair) => void, key?: string) => study.update((x) => fn(x.srovPairs[i]), key && `ov-${id}-${key}`);
  async function remove() {
    const idx = i;
    if (await confirmDelete(study, `le couple ${p.ref}`, (x) => void x.srovPairs.splice(idx, 1))) onClose();
  }
</script>

{#if p && pert}
  <Drawer {onClose}>
    {#snippet title()}<Ref>{p.ref}</Ref> Couple source de risque / objectif visé{/snippet}
    <Field label="Source de risque"><Combo options={opts.sr} value={p.riskSourceId} allowNull={false} disabled={ro} onChange={(v) => v && set((x) => void (x.riskSourceId = v))} /></Field>
    <Field label="Objectif visé" required hint="Finalité visée par la source de risque, selon ses motivations (ne pas confondre avec la motivation).">
      <!-- svelte-ignore a11y_autofocus -->
      <textarea value={p.objective} autofocus rows="3" disabled={ro} oninput={(e) => set((x) => void (x.objective = e.currentTarget.value), "obj")}></textarea>
    </Field>
    <Field label="Catégorie d'objectif visé"><Combo options={opts.category.ov} value={p.objectiveCategoryId} disabled={ro} onChange={(v) => set((x) => void (x.objectiveCategoryId = v))} /></Field>
    {#if ovCat?.description}<div class="callout small">{ovCat.description}</div>{/if}
    <div class="grid-3">
      <Field label="Motivation"><LevelSelect scale={s.scales.motivation} value={p.motivation} disabled={ro} onChange={(v) => set((x) => void (x.motivation = v))} /></Field>
      <Field label="Ressources"><LevelSelect scale={s.scales.resources} value={p.resources} disabled={ro} onChange={(v) => set((x) => void (x.resources = v))} /></Field>
      <Field label="Activité"><LevelSelect scale={s.scales.activity} value={p.activity} disabled={ro} onChange={(v) => set((x) => void (x.activity = v))} /></Field>
    </div>
    <DerivedField label="Pertinence du couple" computed={pert.computed} forced={pert.forced} scale={s.scales.pertinence} disabled={ro} onForce={(v) => set((x) => void (x.pertinenceForced = v))} />
    <Field label="Justification des cotations" hint="Permet de réévaluer facilement la cotation lors d'un prochain cycle.">
      <RichText value={p.justification} disabled={ro} onChange={(v) => set((x) => void (x.justification = v), "just")} />
    </Field>
    <div class="grid-2">
      <Field label="Sélection">
        <Checkbox checked={p.retained} disabled={ro} label="Couple retenu pour la suite de l'étude" onChange={(v) => set((x) => { x.retained = v; if (v && !x.priority) x.priority = "P1"; })} />
      </Field>
      <Field label="Priorité">
        <select value={p.priority ?? ""} disabled={ro} onchange={(e) => { const v = (e.currentTarget.value || null) as SrovPair["priority"]; set((x) => void (x.priority = v)); }}>
          <option value="">—</option>
          <option value="P1">P1 — prioritaire</option>
          <option value="P2">P2 — secondaire (à surveiller)</option>
        </select>
      </Field>
    </div>
    {#if !p.retained}
      <Field label="Justification de l'exclusion"><textarea value={p.exclusionJustification} disabled={ro} rows="2" oninput={(e) => set((x) => void (x.exclusionJustification = e.currentTarget.value), "excl")}></textarea></Field>
    {/if}
    <Field label="Événements redoutés associés (croisement OV / ER)" hint="L'objectif visé hérite de la gravité maximale de ces ER.">
      <MultiSelect options={opts.fe.filter((o) => o.group !== "Non liés à une valeur métier")} value={p.fearedEventIds} disabled={ro} onChange={(v) => set((x) => void (x.fearedEventIds = v))} />
    </Field>
    <div class="row">Gravité héritée : <LevelChip scale={s.scales.gravity} value={srovGravity(d, p)} prefix="G" showLabel /></div>
    {#snippet footer()}
      {#if !ro}<button class="btn danger" style="margin-right: auto" onclick={remove}>Supprimer</button>{/if}
      <button class="btn primary" onclick={onClose}>Fermer</button>
    {/snippet}
  </Drawer>
{/if}
