<script lang="ts">
  import { evaluateStakeholder, ZONE_LABELS, type Stakeholder } from "@beffroi/shared";
  import Checkbox from "../../../components/Checkbox.svelte";
  import Combo from "../../../components/Combo.svelte";
  import DerivedField from "../../../components/DerivedField.svelte";
  import Drawer from "../../../components/Drawer.svelte";
  import Field from "../../../components/Field.svelte";
  import LevelSelect from "../../../components/LevelSelect.svelte";
  import Ref from "../../../components/Ref.svelte";
  import RichText from "../../../components/RichText.svelte";
  import { buildOptions, STAKEHOLDER_CRITERIA, ZONE_BADGE } from "../../helpers";
  import { useStudy } from "../../study.svelte";
  import { confirmDelete } from "../../useDelete";

  let { id, onClose }: { id: string; onClose: () => void } = $props();
  const study = useStudy();
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  const i = $derived(d.stakeholders.findIndex((x) => x.id === id));
  const sh = $derived(d.stakeholders[i]);
  const ev = $derived(sh ? evaluateStakeholder(s, sh) : null);
  const set = (fn: (x: Stakeholder) => void, key?: string) => study.update((x) => fn(x.stakeholders[i]), key && `pp-${id}-${key}`);
  async function remove() {
    const idx = i;
    if (await confirmDelete(study, `la partie prenante ${sh.ref}`, (x) => void x.stakeholders.splice(idx, 1))) onClose();
  }
</script>

{#snippet strong(v: number | null)}<strong>{v ?? "—"}</strong>{/snippet}

{#if sh && ev}
  <Drawer {onClose}>
    {#snippet title()}<Ref>{sh.ref}</Ref> {sh.name || "Partie prenante"}{/snippet}
    <Field label="Nom" required>
      <!-- svelte-ignore a11y_autofocus -->
      <input type="text" value={sh.name} autofocus disabled={ro} oninput={(e) => set((x) => void (x.name = e.currentTarget.value), "name")} />
    </Field>
    <div class="grid-2">
      <Field label="Catégorie"><Combo options={opts.category.pp} value={sh.categoryId} disabled={ro} onChange={(v) => set((x) => void (x.categoryId = v))} /></Field>
      <Field label="Rang" hint="1 : interaction directe avec l'objet de l'étude.">
        <select value={sh.rank} disabled={ro} onchange={(e) => { const v = Number(e.currentTarget.value) as 1 | 2 | 3; set((x) => void (x.rank = v)); }}>
          <option value={1}>Rang 1</option><option value={2}>Rang 2</option><option value={3}>Rang 3</option>
        </select>
      </Field>
    </div>
    {#if sh.rank > 1}
      <Field label="Partie prenante de rang supérieur"><Combo options={opts.sh.filter((o) => o.value !== sh.id)} value={sh.parentId} disabled={ro} onChange={(v) => set((x) => void (x.parentId = v))} /></Field>
    {/if}
    <Field label="Description"><RichText value={sh.description} disabled={ro} onChange={(v) => set((x) => void (x.description = v), "desc")} /></Field>
    <div class="grid-2">
      {#each STAKEHOLDER_CRITERIA as [k, , label] (k)}
        <Field {label} hint={s.scales[k].find((l) => l.value === sh.criteria[k])?.description}>
          <LevelSelect scale={s.scales[k]} value={sh.criteria[k]} disabled={ro} onChange={(v) => set((x) => void (x.criteria[k] = v))} />
        </Field>
      {/each}
    </div>
    <DerivedField label="Niveau de dangerosité initial" computed={ev.initial.computed} forced={ev.initial.forced} disabled={ro} numeric={{ min: 0, max: 100, step: 0.01 }}
      onForce={(v) => set((x) => void (x.dangerForced = v))} format={strong} />
    {#if ev.zone}<div><span class="badge {ZONE_BADGE[ev.zone]}">{ZONE_LABELS[ev.zone]}</span> {ev.suggestedCritical ? "— partie prenante critique suggérée" : ""}</div>{/if}
    <Checkbox checked={ev.critical} disabled={ro} label="Partie prenante critique (intégrée aux scénarios stratégiques)" onChange={(v) => set((x) => void (x.critical = v === ev.suggestedCritical ? null : v))} />
    <Field label="Justification de la cotation" hint="Privilégier des critères objectifs et opposables ; permet une relecture aisée.">
      <RichText value={sh.justification} disabled={ro} onChange={(v) => set((x) => void (x.justification = v), "just")} />
    </Field>
    {#snippet footer()}
      {#if !ro}<button class="btn danger" style="margin-right: auto" onclick={remove}>Supprimer</button>{/if}
      <button class="btn primary" onclick={onClose}>Fermer</button>
    {/snippet}
  </Drawer>
{/if}
