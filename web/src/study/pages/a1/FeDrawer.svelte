<script lang="ts">
  import { CRITERIA_LABELS, type FearedEvent, type SecurityCriterion } from "@beffroi/shared";
  import Checkbox from "../../../components/Checkbox.svelte";
  import Combo from "../../../components/Combo.svelte";
  import Drawer from "../../../components/Drawer.svelte";
  import Field from "../../../components/Field.svelte";
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
  const i = $derived(d.fearedEvents.findIndex((e) => e.id === id));
  const e = $derived(d.fearedEvents[i]);
  const pairs = $derived(d.srovPairs.filter((p) => p.fearedEventIds.includes(id)));
  const set = (fn: (x: FearedEvent) => void, key?: string) => study.update((x) => fn(x.fearedEvents[i]), key && `fe-${id}-${key}`);
  const CRIT: SecurityCriterion[] = ["D", "I", "C", "T"];

  async function remove() {
    const idx = i;
    if (await confirmDelete(study, `l'événement redouté ${e.ref}`, (x) => void x.fearedEvents.splice(idx, 1))) onClose();
  }
</script>

{#if e}
  <Drawer {onClose}>
    {#snippet title()}<Ref>{e.ref}</Ref> Événement redouté{/snippet}
    <Field label="Valeur métier concernée" hint="Laisser vide pour un événement redouté non lié à une valeur métier (risque non intentionnel, vraisemblance en mode express).">
      <Combo options={opts.bv} value={e.businessValueId} disabled={ro} onChange={(v) => set((x) => void (x.businessValueId = v))} placeholder="Non liée à une valeur métier" />
    </Field>
    <Field label="Événement redouté" required hint="Expression courte ou scénario ; pour la disponibilité, préciser le seuil (ex. indisponibilité > 2 heures).">
      <!-- svelte-ignore a11y_autofocus -->
      <textarea value={e.name} disabled={ro} autofocus rows="2" maxlength="1000" oninput={(ev) => set((x) => void (x.name = ev.currentTarget.value), "name")}></textarea>
    </Field>
    <Field label="Critères de sécurité atteints">
      <div class="row wrap">
        {#each CRIT as c (c)}
          <Checkbox disabled={ro} checked={e.criteria.includes(c)} label={CRITERIA_LABELS[c]} onChange={(v) => set((x) => void (x.criteria = v ? [...x.criteria, c] : x.criteria.filter((y) => y !== c)))} />
        {/each}
      </div>
    </Field>
    <Field label="Catégories d'impacts" hint="Fiche méthode 3.">
      <MultiSelect options={opts.category.impact} value={e.impactCategoryIds} disabled={ro} onChange={(v) => set((x) => void (x.impactCategoryIds = v))} />
    </Field>
    <Field label="Description des impacts (directs, indirects, internes, externes)">
      <RichText value={e.impacts} disabled={ro} onChange={(v) => set((x) => void (x.impacts = v), "impacts")} />
    </Field>
    <Field label="Gravité">
      <LevelSelect scale={s.scales.gravity} value={e.gravity} prefix="G" disabled={ro} onChange={(v) => set((x) => void (x.gravity = v))} />
    </Field>
    <Field label="Justification de la cotation" hint="Conserver la justification de l'impact le plus grave.">
      <RichText value={e.justification} disabled={ro} onChange={(v) => set((x) => void (x.justification = v), "just")} />
    </Field>
    {#if e.businessValueId === null}
      <Field label="Vraisemblance (méthode expresse)" hint="Pour un risque non intentionnel intégré à la synthèse des risques (atelier 5).">
        <LevelSelect scale={s.scales.likelihood} value={e.expressLikelihood} prefix="V" disabled={ro} onChange={(v) => set((x) => void (x.expressLikelihood = v))} />
      </Field>
    {:else}
      <Field label="Couples SR/OV associés (atelier 2)">
        {#if pairs.length}
          <div class="row wrap">{#each pairs as p (p.id)}<span class="badge blue">{p.ref}</span>{/each}</div>
        {:else}
          <span class="muted small">Aucun : l'ER devra être relié à un couple SR/OV lors de l'atelier 2.</span>
        {/if}
      </Field>
    {/if}
    {#snippet footer()}
      {#if !ro}<button class="btn danger" style="margin-right: auto" onclick={remove}>Supprimer</button>{/if}
      <button class="btn primary" onclick={onClose}>Fermer</button>
    {/snippet}
  </Drawer>
{/if}
