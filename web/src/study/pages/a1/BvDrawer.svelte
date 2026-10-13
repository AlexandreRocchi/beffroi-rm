<script lang="ts">
  import { CRITERIA_LABELS, type BusinessValue } from "@beffroi/shared";
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
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  const i = $derived(d.businessValues.findIndex((b) => b.id === id));
  const b = $derived(d.businessValues[i]);
  const linked = $derived(d.supportingAssets.filter((a) => a.businessValueIds.includes(id)).map((a) => a.id));
  const fes = $derived(d.fearedEvents.filter((e) => e.businessValueId === id));
  const set = (fn: (x: BusinessValue) => void, key?: string) => study.update((x) => fn(x.businessValues[i]), key && `bv-${id}-${key}`);
  const CRIT = ["D", "I", "C", "T"] as const;

  function setAssets(v: string[]) {
    study.update((x) => {
      for (const a of x.supportingAssets) {
        const has = a.businessValueIds.includes(id);
        if (v.includes(a.id) && !has) a.businessValueIds.push(id);
        if (!v.includes(a.id) && has) a.businessValueIds = a.businessValueIds.filter((y) => y !== id);
      }
    });
  }
  async function remove() {
    const idx = i;
    if (await confirmDelete(study, `la valeur métier ${b.ref}`, (x) => void x.businessValues.splice(idx, 1))) onClose();
  }
</script>

{#if b}
  <Drawer {onClose}>
    {#snippet title()}<Ref>{b.ref}</Ref> {b.name || "Valeur métier"}{/snippet}
    <Field label="Dénomination" required>
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" value={b.name} disabled={ro} autofocus oninput={(e) => set((x) => void (x.name = e.currentTarget.value), "name")} />
    </Field>
    <div class="grid-2">
      <Field label="Nature">
        <select value={b.nature} disabled={ro} onchange={(e) => { const v = e.currentTarget.value as BusinessValue["nature"]; set((x) => void (x.nature = v)); }}>
          <option value="process">Processus</option>
          <option value="information">Information</option>
        </select>
      </Field>
      <Field label="Missions"><MultiSelect options={opts.mission} value={b.missionIds} disabled={ro} onChange={(v) => set((x) => void (x.missionIds = v))} /></Field>
    </div>
    <Field label="Description"><RichText value={b.description} disabled={ro} onChange={(v) => set((x) => void (x.description = v), "desc")} /></Field>
    <div class="grid-2">
      <Field label="Entité ou personne responsable"><input type="text" value={b.owner} disabled={ro} oninput={(e) => set((x) => void (x.owner = e.currentTarget.value), "owner")} /></Field>
      <Field label="Responsable interne ou externe">
        <select value={b.ownerType} disabled={ro} onchange={(e) => { const v = e.currentTarget.value as BusinessValue["ownerType"]; set((x) => void (x.ownerType = v)); }}>
          <option value="internal">Interne</option>
          <option value="external">Externe (partie prenante)</option>
        </select>
      </Field>
    </div>
    <Field label="Besoins de sécurité" hint="Facultatif : position relative des valeurs métier (guide p.20, note 9).">
      <div class="grid-4">
        {#each CRIT as c (c)}
          <Field label={CRITERIA_LABELS[c]}><LevelSelect scale={d.settings.scales.securityNeeds} value={b.needs[c]} disabled={ro} onChange={(v) => set((x) => void (x.needs[c] = v))} /></Field>
        {/each}
      </div>
    </Field>
    <Field label="Biens supports associés">
      <MultiSelect options={opts.asset} value={linked} disabled={ro} onChange={setAssets} />
    </Field>
    <Field label="Événements redoutés">
      {#if fes.length}
        <ul style="margin: 0; padding-left: 18px">{#each fes as e (e.id)}<li><Ref>{e.ref}</Ref> {e.name} <LevelChip scale={d.settings.scales.gravity} value={e.gravity} prefix="G" /></li>{/each}</ul>
      {:else}
        <span class="muted small">Aucun — à identifier dans l'activité « Événements redoutés ».</span>
      {/if}
    </Field>
    {#snippet footer()}
      {#if !ro}<button class="btn danger" style="margin-right: auto" onclick={remove}>Supprimer</button>{/if}
      <button class="btn primary" onclick={onClose}>Fermer</button>
    {/snippet}
  </Drawer>
{/if}
