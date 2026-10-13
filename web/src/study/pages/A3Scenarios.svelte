<script lang="ts">
  import { pertinence, strategicGravity, nextRef, uid } from "@beffroi/shared";
  import StrategicDiagram from "../../charts/StrategicDiagram.svelte";
  import Combo from "../../components/Combo.svelte";
  import DerivedField from "../../components/DerivedField.svelte";
  import Empty from "../../components/Empty.svelte";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import Ref from "../../components/Ref.svelte";
  import RichText from "../../components/RichText.svelte";
  import { buildOptions } from "../helpers";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import { confirmDelete } from "../useDelete";
  import PathsEditor from "./a3/PathsEditor.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  let selId = $state<string | null>(null);
  const sel = $derived(d.strategicScenarios.find((x) => x.id === selId) ?? d.strategicScenarios[0] ?? null);
  const si = $derived(sel ? d.strategicScenarios.indexOf(sel) : -1);
  const retainedPairs = $derived(d.srovPairs.filter((p) => p.retained));
  const selPertinence = $derived.by(() => {
    const p = sel && d.srovPairs.find((x) => x.id === sel.srovId);
    return p ? pertinence(s, p).value : null;
  });

  function addScenario(srovId: string) {
    const id = uid();
    const pair = d.srovPairs.find((p) => p.id === srovId);
    update((x) => void x.strategicScenarios.push({
      id, ref: nextRef("SS", x.strategicScenarios), srovId, name: pair ? `${x.riskSources.find((r) => r.id === pair.riskSourceId)?.name ?? ""} — ${pair.objective}`.slice(0, 200) : "", description: "", gravityForced: null,
      paths: [{ id: uid(), ref: "CA1", name: "Attaque directe", description: "", steps: [], retained: true }],
    }));
    selId = id;
  }
  async function remove() {
    if (!sel) return;
    const idx = si;
    if (await confirmDelete(study, `le scénario ${sel.ref}`, (x) => void x.strategicScenarios.splice(idx, 1))) selId = null;
  }
</script>

<PageTitle ws={3} title="Scénarios stratégiques" subtitle="Chemins d'attaque qu'une source de risque pourrait emprunter pour atteindre son objectif : événements intermédiaires sur l'écosystème, puis événements redoutés sur les valeurs métier." />
{#if retainedPairs.length === 0}
  <div class="card"><Empty title="Aucun couple SR/OV retenu">Sélectionnez les couples SR/OV à l'atelier 2 pour construire les scénarios stratégiques.</Empty></div>
{:else}
  <div class="grid-2" style="grid-template-columns: 300px minmax(0, 1fr)">
    <div class="col">
      {#each retainedPairs as p (p.id)}
        {@const scs = d.strategicScenarios.filter((x) => x.srovId === p.id)}
        <div class="card" style="padding: 10px">
          <div class="small"><Ref>{p.ref}</Ref> <strong>{d.riskSources.find((r) => r.id === p.riskSourceId)?.name}</strong></div>
          <div class="small muted mb">{p.objective}</div>
          {#each scs as sc (sc.id)}
            <button class="nav-item btn ghost" class:active={sc.id === sel?.id} style="width: 100%; justify-content: flex-start; height: auto; padding: 6px 8px" onclick={() => (selId = sc.id)}>
              <Ref>{sc.ref}</Ref> <span class="grow" style="text-align: left; white-space: normal">{sc.name || "Sans nom"}</span>
              <LevelChip scale={s.scales.gravity} value={strategicGravity(d, sc).value} prefix="G" />
            </button>
          {/each}
          {#if scs.length === 0}<div class="small" style="color: var(--warning)">Aucun scénario pour ce couple.</div>{/if}
          {#if !ro}<button class="btn sm ghost" onclick={() => addScenario(p.id)}><Icon name="plus" size={12} /> Scénario</button>{/if}
        </div>
      {/each}
    </div>
    <div class="col gap-lg" style="min-width: 0">
      {#if !sel}
        <div class="card"><Empty title="Sélectionnez ou créez un scénario stratégique" /></div>
      {:else}
        <div class="card col gap-lg">
          <div class="row between">
            <h2 style="margin: 0"><Ref>{sel.ref}</Ref> Scénario stratégique</h2>
            {#if !ro}<button class="btn danger sm" onclick={remove}><Icon name="trash" size={13} /> Supprimer</button>{/if}
          </div>
          <div class="grid-2">
            <Field label="Intitulé"><input type="text" value={sel.name} disabled={ro} oninput={(e) => update((x) => void (x.strategicScenarios[si].name = e.currentTarget.value), `ssn-${sel.id}`)} /></Field>
            <Field label="Couple SR/OV"><Combo options={opts.pair} value={sel.srovId} allowNull={false} disabled={ro} onChange={(v) => v && update((x) => void (x.strategicScenarios[si].srovId = v))} /></Field>
          </div>
          <Field label="Description"><RichText value={sel.description} disabled={ro} onChange={(v) => update((x) => void (x.strategicScenarios[si].description = v), `ssd-${sel.id}`)} /></Field>
          <div class="grid-2">
            <DerivedField label="Gravité du scénario (ER impliqués)" computed={strategicGravity(d, sel).computed} forced={sel.gravityForced} scale={s.scales.gravity} disabled={ro}
              onForce={(v) => update((x) => void (x.strategicScenarios[si].gravityForced = v))} />
            {#if !d.framing.workshopsEnabled[4]}
              <Field label="Vraisemblance (sans atelier 4)">
                <div class="row small">Pertinence du couple SR/OV : <LevelChip scale={s.scales.pertinence} value={selPertinence} showLabel />
                  <span class="muted">— réévaluable au niveau de chaque risque (atelier 5).</span></div>
              </Field>
            {/if}
          </div>
        </div>
        <div class="card">
          <div class="card-title"><h3>Représentation du scénario</h3></div>
          <div style="overflow-x: auto"><StrategicDiagram data={d} scenario={sel} /></div>
        </div>
        {#key sel.id}<PathsEditor scenarioIndex={si} />{/key}
      {/if}
    </div>
  </div>
{/if}
