<script lang="ts">
  import { riskRows } from "@beffroi/shared";
  import Checkbox from "../../../components/Checkbox.svelte";
  import DerivedField from "../../../components/DerivedField.svelte";
  import Drawer from "../../../components/Drawer.svelte";
  import Field from "../../../components/Field.svelte";
  import LevelChip from "../../../components/LevelChip.svelte";
  import Ref from "../../../components/Ref.svelte";
  import { useStudy } from "../../study.svelte";
  import { SRC } from "./risk";

  let { id, onClose }: { id: string; onClose: () => void } = $props();
  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const r = $derived(riskRows(d).find((x) => x.record.id === id));
  const i = $derived(d.risks.findIndex((x) => x.id === id));
</script>

{#if r}
  <Drawer {onClose}>
    {#snippet title()}<Ref>{r.record.ref}</Ref> Scénario de risque{/snippet}
    <Field label="Libellé du risque"><textarea rows="2" value={r.record.title} disabled={ro} oninput={(e) => update((x) => void (x.risks[i].title = e.currentTarget.value), `rt-${id}`)}></textarea></Field>
    {#if r.kind === "intentional"}
      <div class="small col">
        <div><strong>Source de risque :</strong> {r.riskSourceName}</div>
        <div><strong>Objectif visé :</strong> {r.objective}</div>
        <div><strong>Scénario stratégique :</strong> {r.scenario?.ref} — {r.scenario?.name}</div>
        <div><strong>Chemin d'attaque :</strong> {r.path?.ref} — {r.path?.name}</div>
        <div><strong>Scénario opérationnel :</strong> {r.operational ? `${r.operational.ref} — ${r.operational.name}` : "aucun (vraisemblance déduite de la pertinence du couple SR/OV)"}</div>
        <div><strong>Événements redoutés :</strong> {r.fearedEvents.map((f) => `${f.ref} (G${f.gravity ?? "?"})`).join(", ") || "—"}</div>
      </div>
    {:else}
      <div class="callout small">Risque non intentionnel issu d'un événement redouté non lié à une valeur métier (vraisemblance en mode express).</div>
    {/if}
    <div class="grid-2">
      <DerivedField label="Gravité" computed={r.gravity.computed} forced={r.gravity.forced} scale={s.scales.gravity} disabled={ro} onForce={(v) => update((x) => void (x.risks[i].gravityForced = v))} />
      <DerivedField label="Vraisemblance ({SRC[r.likelihood.source]})" computed={r.likelihood.computed} forced={r.likelihood.forced} scale={s.scales.likelihood} disabled={ro} onForce={(v) => update((x) => void (x.risks[i].likelihoodForced = v))} />
    </div>
    <div class="row">Niveau de risque initial : <LevelChip scale={s.scales.riskLevels} value={r.level} showLabel /></div>
    {#if r.kind === "intentional"}
      <Checkbox checked={r.record.excluded} disabled={ro} onChange={(v) => update((x) => void (x.risks[i].excluded = v))} label="Écarter ce scénario de la synthèse (reste tracé)" />
    {/if}
    {#snippet footer()}<button class="btn primary" onclick={onClose}>Fermer</button>{/snippet}
  </Drawer>
{/if}
