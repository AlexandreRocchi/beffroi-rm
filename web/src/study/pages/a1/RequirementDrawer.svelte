<script lang="ts">
  import { REQUIREMENT_STATUS, type Requirement, type RequirementStatus } from "@beffroi/shared";
  import Drawer from "../../../components/Drawer.svelte";
  import Field from "../../../components/Field.svelte";
  import RichText from "../../../components/RichText.svelte";
  import { useStudy } from "../../study.svelte";
  import { STATUS_ORDER } from "./requirements";

  let { ri, id, onClose }: { ri: number; id: string; onClose: () => void } = $props();
  const study = useStudy();
  const d = $derived(study.d);
  const ro = $derived(study.readOnly);
  const qi = $derived(d.baseline.referentials[ri]?.requirements.findIndex((q) => q.id === id) ?? -1);
  const q = $derived(d.baseline.referentials[ri]?.requirements[qi]);
  const measures = $derived(d.measures.filter((m) => m.requirementIds.includes(id)));
  const set = (fn: (x: Requirement) => void, key?: string) => study.update((x) => fn(x.baseline.referentials[ri].requirements[qi]), key && `rq-${id}-${key}`);
  function remove() {
    const idx = qi;
    study.update((x) => void x.baseline.referentials[ri].requirements.splice(idx, 1));
    onClose();
  }
</script>

{#if q}
  <Drawer title="{q.ref} · Exigence du socle" {onClose}>
    <div class="grid-2">
      <Field label="Référence"><input type="text" value={q.ref} disabled={ro} oninput={(e) => set((x) => void (x.ref = e.currentTarget.value), "ref")} /></Field>
      <Field label="Rubrique"><input type="text" value={q.section ?? ""} disabled={ro} oninput={(e) => set((x) => void (x.section = e.currentTarget.value || undefined), "section")} /></Field>
    </div>
    <!-- svelte-ignore a11y_autofocus -->
    <Field label="Exigence"><textarea rows="3" value={q.title} disabled={ro} autofocus oninput={(e) => set((x) => void (x.title = e.currentTarget.value), "title")}></textarea></Field>
    <Field label="État d'application">
      <select value={q.status} disabled={ro} style:border-left="5px solid {REQUIREMENT_STATUS[q.status].color}" onchange={(e) => { const v = e.currentTarget.value as RequirementStatus; set((x) => void (x.status = v)); }}>
        {#each STATUS_ORDER as k (k)}<option value={k}>{REQUIREMENT_STATUS[k].label}</option>{/each}
      </select>
    </Field>
    <Field label="Écart constaté" hint="Formuler l'écart de manière contextualisée à l'objet de l'étude."><textarea rows="3" value={q.gap} disabled={ro} oninput={(e) => set((x) => void (x.gap = e.currentTarget.value), "gap")}></textarea></Field>
    <Field label="Justification de l'écart ou de la dérogation / commentaire"><RichText value={q.justification} disabled={ro} onChange={(v) => set((x) => void (x.justification = v), "just")} /></Field>
    <Field label="Mesures du plan de traitement associées">
      {#if measures.length}
        <ul style="margin: 0; padding-left: 18px">{#each measures as m (m.id)}<li>{m.ref} · {m.title}</li>{/each}</ul>
      {:else}
        <span class="muted small">Aucune (créez une mesure d'origine « socle » dans le plan de traitement).</span>
      {/if}
    </Field>
    {#snippet footer()}
      {#if !ro}<button class="btn danger" style="margin-right: auto" onclick={remove}>Supprimer</button>{/if}
      <button class="btn primary" onclick={onClose}>Fermer</button>
    {/snippet}
  </Drawer>
{/if}
