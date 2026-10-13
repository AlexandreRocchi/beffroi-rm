<script lang="ts">
  import { MEASURE_STATUS, riskRows, type ResidualDoc } from "@beffroi/shared";
  import Drawer from "../../../components/Drawer.svelte";
  import Field from "../../../components/Field.svelte";
  import LevelChip from "../../../components/LevelChip.svelte";
  import LevelSelect from "../../../components/LevelSelect.svelte";
  import Ref from "../../../components/Ref.svelte";
  import RichText from "../../../components/RichText.svelte";
  import { useStudy } from "../../study.svelte";

  let { id, onClose }: { id: string; onClose: () => void } = $props();
  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const r = $derived(riskRows(d).find((x) => x.record.id === id));
  const i = $derived(d.risks.findIndex((x) => x.id === id));
  const measures = $derived(d.measures.filter((m) => m.riskIds.includes(id)));
  const set = (k: keyof ResidualDoc) => (v: string) => update((x) => void (x.risks[i].residualDoc[k] = v), `rr-${id}-${k}`);
</script>

{#if r}
  <Drawer wide {onClose}>
    {#snippet title()}<Ref>RR · {r.record.ref}</Ref> {r.record.title}{/snippet}
    <h3>Description et analyse du risque résiduel</h3>
    <Field label="Description sommaire (dont impacts à craindre)"><RichText value={r.record.residualDoc.description} disabled={ro} onChange={set("description")} /></Field>
    <Field label="Vulnérabilités résiduelles susceptibles d'être exploitées par la source de risque"><RichText value={r.record.residualDoc.vulnerabilities} disabled={ro} onChange={set("vulnerabilities")} /></Field>
    <Field label="Autres causes ou facteurs aggravants (négligence, erreur, concours de circonstances…)"><RichText value={r.record.residualDoc.aggravatingFactors} disabled={ro} onChange={set("aggravatingFactors")} /></Field>
    <h3>Événements redoutés concernés</h3>
    <ul style="margin: 0; padding-left: 18px">{#each r.fearedEvents as f (f.id)}<li><Ref>{f.ref}</Ref> {f.name} <LevelChip scale={s.scales.gravity} value={f.gravity} prefix="G" /></li>{/each}</ul>
    <h3>Mesures de traitement du risque existantes et complémentaires</h3>
    {#if measures.length}
      <ul style="margin: 0; padding-left: 18px">{#each measures as m (m.id)}<li><Ref>{m.ref}</Ref> {m.title} — <span style:color={MEASURE_STATUS[m.status].color}>{MEASURE_STATUS[m.status].label}</span></li>{/each}</ul>
    {:else}
      <span class="muted small">Aucune mesure associée (plan de traitement).</span>
    {/if}
    <h3>Estimation du risque résiduel</h3>
    <table class="table" style="width: auto">
      <thead><tr><th></th><th class="num">Initial</th><th class="num">Résiduel</th></tr></thead>
      <tbody>
        <tr><td>Gravité</td><td class="num"><LevelChip scale={s.scales.gravity} value={r.gravity.value} prefix="G" /></td>
          <td><LevelSelect scale={s.scales.gravity} value={r.record.residualGravity} prefix="G" disabled={ro} placeholder="Inchangée" ariaLabel="Gravité résiduelle" onChange={(v) => update((x) => void (x.risks[i].residualGravity = v))} /></td></tr>
        <tr><td>Vraisemblance</td><td class="num"><LevelChip scale={s.scales.likelihood} value={r.likelihood.value} prefix="V" /></td>
          <td><LevelSelect scale={s.scales.likelihood} value={r.record.residualLikelihood} prefix="V" disabled={ro} placeholder="Inchangée" ariaLabel="Vraisemblance résiduelle" onChange={(v) => update((x) => void (x.risks[i].residualLikelihood = v))} /></td></tr>
        <tr><td>Niveau de risque</td><td class="num"><LevelChip scale={s.scales.riskLevels} value={r.level} showLabel /></td><td class="num"><LevelChip scale={s.scales.riskLevels} value={r.residualLevel} showLabel /></td></tr>
      </tbody>
    </table>
    <Field label="Gestion du risque résiduel (mesures particulières de suivi et de contrôle)"><RichText value={r.record.residualDoc.management} disabled={ro} onChange={set("management")} /></Field>
    {#snippet footer()}<button class="btn primary" onclick={onClose}>Fermer</button>{/snippet}
  </Drawer>
{/if}
