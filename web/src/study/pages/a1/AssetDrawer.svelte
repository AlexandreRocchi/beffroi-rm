<script lang="ts">
  import type { SupportingAsset } from "@beffroi/shared";
  import Combo from "../../../components/Combo.svelte";
  import Drawer from "../../../components/Drawer.svelte";
  import Field from "../../../components/Field.svelte";
  import MultiSelect from "../../../components/MultiSelect.svelte";
  import Ref from "../../../components/Ref.svelte";
  import RichText from "../../../components/RichText.svelte";
  import { buildOptions } from "../../helpers";
  import { useStudy } from "../../study.svelte";
  import { confirmDelete } from "../../useDelete";

  let { id, onClose }: { id: string; onClose: () => void } = $props();
  const study = useStudy();
  const d = $derived(study.d);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  const i = $derived(d.supportingAssets.findIndex((b) => b.id === id));
  const a = $derived(d.supportingAssets[i]);
  const usedIn = $derived(d.operationalScenarios.filter((o) => o.nodes.some((n) => n.supportingAssetId === id)));
  const set = (fn: (x: SupportingAsset) => void, key?: string) => study.update((x) => fn(x.supportingAssets[i]), key && `bs-${id}-${key}`);
  async function remove() {
    const idx = i;
    if (await confirmDelete(study, `le bien support ${a.ref}`, (x) => void x.supportingAssets.splice(idx, 1))) onClose();
  }
</script>

{#if a}
  <Drawer {onClose}>
    {#snippet title()}<Ref>{a.ref}</Ref> {a.name || "Bien support"}{/snippet}
    <Field label="Dénomination" required>
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" value={a.name} disabled={ro} autofocus oninput={(e) => set((x) => void (x.name = e.currentTarget.value), "name")} />
    </Field>
    <Field label="Type de bien support" hint="Catégories de la fiche méthode 1.">
      <Combo options={opts.category.assetType} value={a.typeId} disabled={ro} onChange={(v) => set((x) => void (x.typeId = v))} />
    </Field>
    <Field label="Description détaillée"><RichText value={a.description} disabled={ro} onChange={(v) => set((x) => void (x.description = v), "desc")} /></Field>
    <div class="grid-2">
      <Field label="Entité ou personne responsable"><input type="text" value={a.owner} disabled={ro} oninput={(e) => set((x) => void (x.owner = e.currentTarget.value), "owner")} /></Field>
      <Field label="Responsable interne ou externe">
        <select value={a.ownerType} disabled={ro} onchange={(e) => { const v = e.currentTarget.value as SupportingAsset["ownerType"]; set((x) => void (x.ownerType = v)); }}>
          <option value="internal">Interne</option>
          <option value="external">Externe</option>
        </select>
      </Field>
    </div>
    {#if a.ownerType === "external"}<div class="callout warning">Si la sécurité de cet élément ne dépend pas du commanditaire de l'étude, il s'agit d'une partie prenante (atelier 3) plutôt que d'un bien support.</div>{/if}
    <Field label="Valeurs métier reposant sur ce bien"><MultiSelect options={opts.bv} value={a.businessValueIds} disabled={ro} onChange={(v) => set((x) => void (x.businessValueIds = v))} /></Field>
    {#if usedIn.length > 0}
      <Field label="Utilisé dans les scénarios opérationnels"><div class="row wrap">{#each usedIn as o (o.id)}<span class="badge">{o.ref} · {o.name}</span>{/each}</div></Field>
    {/if}
    {#snippet footer()}
      {#if !ro}<button class="btn danger" style="margin-right: auto" onclick={remove}>Supprimer</button>{/if}
      <button class="btn primary" onclick={onClose}>Fermer</button>
    {/snippet}
  </Drawer>
{/if}
