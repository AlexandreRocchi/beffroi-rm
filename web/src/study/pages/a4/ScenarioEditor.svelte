<script lang="ts">
  import { lookup, operationalLikelihood, uid, type OperationalScenario } from "@beffroi/shared";
  import Checkbox from "../../../components/Checkbox.svelte";
  import DerivedField from "../../../components/DerivedField.svelte";
  import Field from "../../../components/Field.svelte";
  import Icon from "../../../components/Icon.svelte";
  import LevelSelect from "../../../components/LevelSelect.svelte";
  import MultiSelect from "../../../components/MultiSelect.svelte";
  import Ref from "../../../components/Ref.svelte";
  import RichText from "../../../components/RichText.svelte";
  import AttackGraphEditor from "../../graph/AttackGraphEditor.svelte";
  import { useStudy } from "../../study.svelte";
  import { confirmDelete } from "../../useDelete";
  import { SOURCE_LABEL } from "./likelihood";

  let { oi }: { oi: number } = $props();
  const study = useStudy();
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const os = $derived(d.operationalScenarios[oi]);
  const lk = $derived(operationalLikelihood(d, os));
  let highlightMode = $state<string | null>(null);
  const set = (fn: (x: OperationalScenario) => void, key?: string) => study.update((x) => fn(x.operationalScenarios[oi]), key && `so-${os.id}-${key}`);
  const nodeOpts = $derived(os.nodes.map((n) => ({ value: n.id, label: n.label || (n.type === "and" ? "ET" : n.type === "or" ? "OU" : "Action") })));
  const g = $derived(lk.graph);
  const critLabels = $derived(g ? g.criticalActions.map((id) => os.nodes.find((n) => n.id === id)).filter((n) => !!n) : []);
  const highlight = $derived(highlightMode ? (os.operatingModes.find((m) => m.id === highlightMode)?.nodeIds ?? null) : null);
  const sourceLabel = $derived(SOURCE_LABEL[lk.source === "forced" ? (g ? "graph" : "express") : lk.source]);
</script>

<div class="col gap-lg">
  <div class="card col">
    <div class="row between">
      <div class="row grow"><Ref>{os.ref}</Ref><input type="text" class="inline-input grow" style="font-weight: 700; font-size: 15px" value={os.name} disabled={ro} aria-label="Nom du scénario opérationnel" oninput={(e) => set((x) => void (x.name = e.currentTarget.value), "name")} /></div>
      {#if !ro}<button class="btn danger sm" aria-label="Supprimer le scénario" onclick={() => confirmDelete(study, `le scénario opérationnel ${os.ref}`, (x) => void x.operationalScenarios.splice(oi, 1))}><Icon name="trash" size={13} /></button>{/if}
    </div>
    <div class="grid-2">
      <Field label="Description des modes opératoires"><RichText value={os.description} disabled={ro} minHeight={48} onChange={(v) => set((x) => void (x.description = v), "desc")} /></Field>
      <div class="col">
        <DerivedField label="Vraisemblance globale ({sourceLabel})" computed={lk.computed} forced={lk.forced} scale={s.scales.likelihood} disabled={ro}
          onForce={(v) => set((x) => void (x.likelihoodForced = v))} />
        {#if s.likelihoodMethod === "express"}
          <div class="grid-3">
            <Field label="Directe"><LevelSelect scale={s.scales.likelihood} value={os.expressLikelihood} prefix="V" disabled={ro} onChange={(v) => set((x) => void (x.expressLikelihood = v))} /></Field>
            <Field label="ou Pr × D : Pr"><LevelSelect scale={s.scales.probability} value={os.expressProbability} disabled={ro || os.expressLikelihood !== null} onChange={(v) => set((x) => void (x.expressProbability = v))} /></Field>
            <Field label="D"><LevelSelect scale={s.scales.difficulty} value={os.expressDifficulty} disabled={ro || os.expressLikelihood !== null} onChange={(v) => set((x) => void (x.expressDifficulty = v))} /></Field>
          </div>
          {#if os.expressLikelihood === null && os.expressProbability !== null && os.expressDifficulty !== null}
            <div class="small muted">Croisement : V{lookup(s.likelihoodCross, os.expressProbability, os.expressDifficulty) ?? "?"}</div>
          {/if}
        {/if}
        {#if s.likelihoodMethod === "advanced"}<Checkbox checked={os.determinedSource} disabled={ro} onChange={(v) => set((x) => void (x.determinedSource = v))} label="Source de risque particulièrement déterminée (+1 niveau)" />{/if}
        {#if g}
          {#each g.warnings as w (w)}<div class="small" style="color: var(--warning)">⚠ {w}</div>{/each}
          {#if g.corrected}<div class="small muted">Correction des chaînes longues appliquée ({g.pathLength} actions).</div>{/if}
        {/if}
      </div>
    </div>
    {#if g && critLabels.length > 0}
      <div class="small"><strong>Mode opératoire le plus vraisemblable (moindre effort)</strong> : {critLabels.map((n) => n.label).join(" → ")}</div>
    {/if}
    <Field label="Justification de la vraisemblance"><RichText value={os.justification} disabled={ro} minHeight={36} onChange={(v) => set((x) => void (x.justification = v), "just")} /></Field>
  </div>

  <AttackGraphEditor scenarioIndex={oi} evaluation={g} {highlight} />

  <div class="card">
    <div class="card-title">
      <h3>Modes opératoires</h3>
      {#if !ro}<button class="btn sm" onclick={() => set((x) => void x.operatingModes.push({ id: uid(), name: `Mode ${x.operatingModes.length + 1}`, description: "", likelihood: null, nodeIds: [] }))}><Icon name="plus" size={12} /> Mode opératoire</button>{/if}
    </div>
    {#if os.operatingModes.length === 0}<div class="muted small">Facultatif : nommez et décrivez les modes opératoires (séquences du graphe), et cotez-les individuellement en méthode expresse.</div>{/if}
    {#each os.operatingModes as m, mi (m.id)}
      <div class="row top mb" style="border-top: 1px solid var(--border); padding-top: 10px">
        <div class="col grow">
          <input type="text" value={m.name} disabled={ro} aria-label="Nom du mode opératoire" oninput={(e) => set((x) => void (x.operatingModes[mi].name = e.currentTarget.value), `om-${m.id}`)} />
          <RichText value={m.description} disabled={ro} minHeight={32} onChange={(v) => set((x) => void (x.operatingModes[mi].description = v), `omd-${m.id}`)} />
          <MultiSelect options={nodeOpts} value={m.nodeIds} disabled={ro} placeholder="Actions du mode opératoire…" onChange={(v) => set((x) => void (x.operatingModes[mi].nodeIds = v))} />
        </div>
        <div class="col" style="width: 200px">
          {#if s.likelihoodMethod === "express"}<LevelSelect scale={s.scales.likelihood} value={m.likelihood} prefix="V" disabled={ro} onChange={(v) => set((x) => void (x.operatingModes[mi].likelihood = v))} />{/if}
          <button class="btn sm" class:active={highlightMode === m.id} onclick={() => (highlightMode = highlightMode === m.id ? null : m.id)}><Icon name="eye" size={12} /> Surligner</button>
          {#if !ro}<button class="btn sm ghost danger" onclick={() => set((x) => void x.operatingModes.splice(mi, 1))}>Supprimer</button>{/if}
        </div>
      </div>
    {/each}
  </div>
</div>
