<script lang="ts">
  import { nextRef, operationalLikelihood, strategicGravity, uid } from "@beffroi/shared";
  import Empty from "../../components/Empty.svelte";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import LevelSelect from "../../components/LevelSelect.svelte";
  import Ref from "../../components/Ref.svelte";
  import Tabs from "../../components/Tabs.svelte";
  import { activable } from "../../lib/actions";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import { METHODS, SOURCE_LABEL } from "./a4/likelihood";
  import ScenarioEditor from "./a4/ScenarioEditor.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  let tab = $state<"edit" | "synthese">("edit");
  const paths = $derived(d.strategicScenarios.flatMap((sc) => sc.paths.filter((p) => p.retained).map((p) => ({ sc, p }))));
  let selPathState = $state<string | null>(null);
  const selPath = $derived(selPathState ?? paths[0]?.p.id ?? null);
  let threshold = $state<number | null>(null);
  const current = $derived(paths.find((x) => x.p.id === selPath));
  const oi = $derived(current ? d.operationalScenarios.findIndex((o) => o.attackPathId === current.p.id) : -1);
  const allPaths = $derived(d.strategicScenarios.flatMap((sc) => sc.paths.map((p) => ({ sc, p }))));

  function createFor(pathId: string) {
    const p = paths.find((x) => x.p.id === pathId);
    const phases = s.catalogs.attackPhases;
    update((x) => void x.operationalScenarios.push({
      id: uid(), ref: nextRef("SO", x.operationalScenarios), attackPathId: pathId, name: p?.p.name ?? "", description: "",
      nodes: [{ id: uid(), type: "goal", x: phases.length * 290 + 40, y: 160, phaseId: null, label: p?.sc ? (x.srovPairs.find((y) => y.id === p.sc.srovId)?.objective ?? "Objectif visé").slice(0, 120) : "Objectif visé", supportingAssetId: null, stakeholderId: null, catalogActionId: null, probability: null, difficulty: null, notes: "" }],
      edges: [], operatingModes: [], expressLikelihood: null, expressProbability: null, expressDifficulty: null, determinedSource: false, likelihoodForced: null, justification: "",
    }));
  }
</script>

<PageTitle ws={4} title="Scénarios opérationnels" subtitle="Modes opératoires permettant de réaliser chaque chemin d'attaque, sous forme de graphes d'actions élémentaires sur les biens supports, et leur vraisemblance." />
{#if !d.framing.workshopsEnabled[4]}<div class="callout warning mb">L'atelier 4 n'est pas conduit dans cette étude (cadre de l'étude) : la vraisemblance des risques est déduite de la pertinence des couples SR/OV.</div>{/if}

<div class="card mb-lg">
  <div class="row wrap top gap-lg">
    <Field label="Méthode d'évaluation de la vraisemblance (toute l'étude)">
      <div class="btn-group">
        {#each METHODS as m (m.id)}
          <button class="btn" class:active={s.likelihoodMethod === m.id} disabled={ro} onclick={() => update((x) => void (x.settings.likelihoodMethod = m.id))}>{m.label}</button>
        {/each}
      </div>
    </Field>
    <div class="grow small muted" style="max-width: 720px; padding-top: 20px">{METHODS.find((m) => m.id === s.likelihoodMethod)?.desc}</div>
  </div>
</div>

<Tabs value={tab} onChange={(v) => (tab = v)} tabs={[{ id: "edit", label: "Graphes d'attaque" }, { id: "synthese", label: "Tableau de synthèse" }]} />

{#if tab === "edit"}
  {#if paths.length === 0}
    <div class="card"><Empty title="Aucun chemin d'attaque retenu">Construisez les scénarios stratégiques à l'atelier 3.</Empty></div>
  {:else}
    <div class="col gap-lg">
      <div class="row wrap top">
        {#each d.strategicScenarios as sc (sc.id)}
          {@const ps = sc.paths.filter((p) => p.retained)}
          {#if ps.length}
            <div class="card" style="padding: 10px; flex: 1 1 320px; max-width: 560px">
              <div class="small mb"><Ref>{sc.ref}</Ref> <strong>{sc.name}</strong> <LevelChip scale={s.scales.gravity} value={strategicGravity(d, sc).value} prefix="G" /></div>
              <div class="col" style="gap: 2px">
                {#each ps as p (p.id)}
                  {@const os = d.operationalScenarios.find((o) => o.attackPathId === p.id)}
                  <button class="nav-item btn ghost" class:active={selPath === p.id} style="width: 100%; height: auto; padding: 5px 8px; justify-content: flex-start" onclick={() => (selPathState = p.id)}>
                    <Ref>{p.ref}</Ref>
                    <span class="grow" style="text-align: left; white-space: normal; font-size: 12.5px">{p.name}</span>
                    {#if os}<LevelChip scale={s.scales.likelihood} value={operationalLikelihood(d, os).value} prefix="V" />{:else}<span class="badge orange">à faire</span>{/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>
      <div style="min-width: 0">
        {#if !current}
          <div class="card"><Empty title="Sélectionnez un chemin d'attaque" /></div>
        {:else if oi < 0}
          <div class="card">
            <Empty title="Aucun scénario opérationnel pour « {current.p.name} »">
              Il n'est pas nécessaire de détailler tous les chemins d'attaque : la vraisemblance d'un chemin sans scénario opérationnel est déduite de la pertinence du couple SR/OV.
              {#snippet action()}
                {#if !ro}<button class="btn primary" onclick={() => createFor(current.p.id)}><Icon name="plus" size={14} /> Créer le scénario opérationnel</button>{/if}
              {/snippet}
            </Empty>
          </div>
        {:else}
          {#key d.operationalScenarios[oi].id}<ScenarioEditor {oi} />{/key}
        {/if}
      </div>
    </div>
  {/if}
{:else}
  <div class="row mb">
    <span class="small">Afficher les scénarios de vraisemblance ≥</span>
    <div style="width: 220px"><LevelSelect scale={s.scales.likelihood} value={threshold} prefix="V" placeholder="Tous" ariaLabel="Seuil de vraisemblance" onChange={(v) => (threshold = v)} /></div>
  </div>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Réf.</th><th>Chemin d'attaque stratégique associé</th><th>Scénario opérationnel</th><th class="num">AE</th><th>Modes opératoires</th><th class="num">Gravité</th><th class="num">Vraisemblance globale</th><th>Origine</th></tr></thead>
      <tbody>
        {#each d.operationalScenarios as o (o.id)}
          {@const ix = allPaths.find((x) => x.p.id === o.attackPathId)}
          {@const lk = operationalLikelihood(d, o)}
          {#if threshold === null || (lk.value !== null && lk.value >= threshold)}
            <tr class="clickable" use:activable onclick={() => { selPathState = o.attackPathId; tab = "edit"; }}>
              <td><Ref>{o.ref}</Ref></td>
              <td class="small">{ix ? `${ix.sc.ref}.${ix.p.ref} — ${ix.p.name}` : "—"}</td>
              <td>{o.name}</td>
              <td class="num">{o.nodes.filter((n) => n.type === "action").length}</td>
              <td class="small">{o.operatingModes.map((m) => m.name).join(" · ") || "—"}</td>
              <td class="num"><LevelChip scale={s.scales.gravity} value={ix ? strategicGravity(d, ix.sc).value : null} prefix="G" /></td>
              <td class="num"><LevelChip scale={s.scales.likelihood} value={lk.value} prefix="V" showLabel forced={lk.forced !== null} /></td>
              <td class="small muted">{SOURCE_LABEL[lk.source]}</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}
