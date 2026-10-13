<script lang="ts">
  import type { RiskSource } from "@beffroi/shared";
  import Combo from "../../../components/Combo.svelte";
  import Drawer from "../../../components/Drawer.svelte";
  import Field from "../../../components/Field.svelte";
  import Ref from "../../../components/Ref.svelte";
  import RichText from "../../../components/RichText.svelte";
  import { buildOptions } from "../../helpers";
  import { useStudy } from "../../study.svelte";
  import { confirmDelete } from "../../useDelete";

  let { id, onClose, onAddPair }: { id: string; onClose: () => void; onAddPair: (id: string) => void } = $props();
  const study = useStudy();
  const d = $derived(study.d);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  const i = $derived(d.riskSources.findIndex((x) => x.id === id));
  const sr = $derived(d.riskSources[i]);
  const cat = $derived(d.settings.catalogs.riskSourceCategories.find((c) => c.id === sr?.categoryId));
  const set = (fn: (x: RiskSource) => void, key?: string) => study.update((x) => fn(x.riskSources[i]), key && `sr-${id}-${key}`);
  async function remove() {
    const idx = i;
    if (await confirmDelete(study, `la source de risque ${sr.ref}`, (x) => void x.riskSources.splice(idx, 1))) onClose();
  }
</script>

{#if sr}
  <Drawer {onClose}>
    {#snippet title()}<Ref>{sr.ref}</Ref> Source de risque{/snippet}
    <Field label="Catégorie" hint="Base de connaissances modifiable dans les paramètres."><Combo options={opts.category.sr} value={sr.categoryId} disabled={ro} onChange={(v) => set((x) => void (x.categoryId = v))} /></Field>
    {#if cat?.description}<div class="callout small">{cat.description}</div>{/if}
    <Field label="Nom de la source de risque" required>
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" value={sr.name} autofocus disabled={ro} oninput={(e) => set((x) => void (x.name = e.currentTarget.value), "name")} placeholder="Ex. Concurrent, groupe cybercriminel, salarié malveillant…" />
    </Field>
    <Field label="Caractérisation" hint="Ressources supposées, modes opératoires de prédilection, activité dans le secteur…"><RichText value={sr.description} disabled={ro} onChange={(v) => set((x) => void (x.description = v), "desc")} /></Field>
    {#snippet footer()}
      {#if !ro}
        <button class="btn danger" style="margin-right: auto" onclick={remove}>Supprimer</button>
        <button class="btn" onclick={() => onAddPair(id)}>Ajouter un objectif visé</button>
      {/if}
      <button class="btn primary" onclick={onClose}>Fermer</button>
    {/snippet}
  </Drawer>
{/if}
