<script lang="ts">
  import { uid } from "@beffroi/shared";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import NumberInput from "../../components/NumberInput.svelte";
  import RichText from "../../components/RichText.svelte";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const ro = $derived(study.readOnly);
  const m = $derived(d.monitoring);
  const IND = [["name", "Indicateur"], ["target", "Cible"], ["current", "Valeur actuelle"], ["frequency", "Fréquence"], ["owner", "Responsable"]] as const;
</script>

<PageTitle ws={5} title="Cadre de suivi des risques" subtitle="Indicateurs de pilotage, gouvernance (comité de pilotage) et mécanismes de surveillance déclenchant la mise à jour de l'étude." />
<div class="grid-2 mb-lg">
  <div class="card col">
    <h3>Comité de pilotage</h3>
    <p class="small muted">Recommandation : tous les six mois en montée en puissance, tous les douze mois en rythme de croisière.</p>
    <div class="grid-2">
      <Field label="Fréquence (mois)"><NumberInput value={m.committeeFrequencyMonths} min={0} max={120} disabled={ro} onChange={(v) => update((x) => void (x.monitoring.committeeFrequencyMonths = v ?? 0), "cf")} /></Field>
      <Field label="Prochain comité"><input type="date" value={m.nextCommitteeDate} disabled={ro} onchange={(e) => { const v = e.currentTarget.value; update((x) => void (x.monitoring.nextCommitteeDate = v)); }} /></Field>
    </div>
    <Field label="Membres"><textarea rows="2" value={m.committeeMembers} disabled={ro} oninput={(e) => update((x) => void (x.monitoring.committeeMembers = e.currentTarget.value), "cm")}></textarea></Field>
    <div class="small muted">Cycles de l'étude : stratégique {d.framing.strategicCycleMonths} mois · opérationnel {d.framing.operationalCycleMonths} mois.</div>
  </div>
  <div class="card col">
    <h3>Notes de suivi</h3>
    <RichText value={m.notes} disabled={ro} minHeight={120} ariaLabel="Notes de suivi" onChange={(v) => update((x) => void (x.monitoring.notes = v), "notes")} />
  </div>
</div>

<div class="card mb-lg">
  <div class="card-title">
    <h3>Indicateurs de pilotage</h3>
    {#if !ro}<button class="btn sm" onclick={() => update((x) => void x.monitoring.indicators.push({ id: uid(), name: "", target: "", current: "", frequency: "", owner: "" }))}><Icon name="plus" size={12} /> Indicateur</button>{/if}
  </div>
  <div class="table-wrap auto">
    <table class="table">
      <thead><tr><th>Indicateur</th><th style="width: 130px">Cible</th><th style="width: 130px">Valeur actuelle</th><th style="width: 150px">Fréquence</th><th style="width: 170px">Responsable</th><th></th></tr></thead>
      <tbody>
        {#each m.indicators as ind, i (ind.id)}
          <tr>
            {#each IND as [k, label] (k)}
              <td><input type="text" class="inline-input" value={ind[k]} disabled={ro} aria-label={label} oninput={(e) => update((x) => void (x.monitoring.indicators[i][k] = e.currentTarget.value), `ind-${ind.id}-${k}`)} /></td>
            {/each}
            <td>{#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer l'indicateur" onclick={() => update((x) => void x.monitoring.indicators.splice(i, 1))}><Icon name="trash" size={13} /></button>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<div class="card">
  <div class="card-title">
    <h3>Déclencheurs de mise à jour de l'étude</h3>
    {#if !ro}<button class="btn sm" onclick={() => update((x) => void x.monitoring.triggers.push({ id: uid(), description: "", owner: "" }))}><Icon name="plus" size={12} /> Déclencheur</button>{/if}
  </div>
  <div class="table-wrap auto">
    <table class="table">
      <thead><tr><th>Événement déclencheur</th><th style="width: 220px">Veille assurée par</th><th></th></tr></thead>
      <tbody>
        {#each m.triggers as t, i (t.id)}
          <tr>
            <td><input type="text" class="inline-input" value={t.description} disabled={ro} aria-label="Événement déclencheur" oninput={(e) => update((x) => void (x.monitoring.triggers[i].description = e.currentTarget.value), `tr-${t.id}`)} /></td>
            <td><input type="text" class="inline-input" value={t.owner} disabled={ro} aria-label="Veille assurée par" oninput={(e) => update((x) => void (x.monitoring.triggers[i].owner = e.currentTarget.value), `tro-${t.id}`)} /></td>
            <td>{#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer le déclencheur" onclick={() => update((x) => void x.monitoring.triggers.splice(i, 1))}><Icon name="trash" size={13} /></button>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
