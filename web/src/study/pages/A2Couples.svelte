<script lang="ts">
  import { lookup, nextRef, pertinence, srovGravity, uid } from "@beffroi/shared";
  import Checkbox from "../../components/Checkbox.svelte";
  import Icon from "../../components/Icon.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import Ref from "../../components/Ref.svelte";
  import { activable } from "../../lib/actions";
  import { isLight, levelColor } from "../../lib/levels";
  import { nameOf, shortText } from "../helpers";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import PairDrawer from "./a2/PairDrawer.svelte";
  import SrDrawer from "./a2/SrDrawer.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  let editPair = $state<string | null>(null);
  let editSr = $state<string | null>(null);

  function addSr() {
    const id = uid();
    update((x) => void x.riskSources.push({ id, ref: nextRef("SR", x.riskSources), categoryId: null, name: "", description: "" }));
    editSr = id;
  }
  function addPair(srId: string) {
    const id = uid();
    update((x) => void x.srovPairs.push({ id, ref: nextRef("OV", x.srovPairs), riskSourceId: srId, objective: "", objectiveCategoryId: null, motivation: null, resources: null, activity: null, pertinenceForced: null, justification: "", priority: null, retained: false, exclusionJustification: "", fearedEventIds: [] }));
    editPair = id;
  }
  const retained = $derived(d.srovPairs.filter((p) => p.retained).length);
  const res = $derived([...s.scales.resources].sort((a, b) => b.value - a.value));
  const mot = $derived([...s.scales.motivation].sort((a, b) => a.value - b.value));
  const srCats = $derived(s.catalogs.riskSourceCategories.map((c) => ({ ...c, name: c.label })));
  const ovCats = $derived(s.catalogs.targetObjectiveCategories.map((c) => ({ ...c, name: c.label })));
</script>

<PageTitle ws={2} title="Sources de risque et objectifs visés" subtitle="Qui ou quoi pourrait porter atteinte aux missions et valeurs métier, et dans quel but ?">
  {#snippet actions()}
    {#if !ro}<button class="btn primary" onclick={addSr}><Icon name="plus" size={14} /> Source de risque</button>{/if}
  {/snippet}
</PageTitle>

{#if retained > 0 && (retained < 3 || retained > 6)}
  <div class="callout mb">{retained} couple(s) retenu(s) : 3 à 6 couples SR/OV constituent généralement une base suffisante (davantage possible pour des systèmes complexes).</div>
{/if}

<div class="grid-2 mb-lg" style="grid-template-columns: minmax(0, 2fr) minmax(0, 1fr)">
  <div class="col gap-lg">
    {#each d.riskSources as sr (sr.id)}
      {@const pairs = d.srovPairs.filter((p) => p.riskSourceId === sr.id)}
      <div class="card flush">
        <div class="row between" style="padding: 12px 14px; border-bottom: 1px solid var(--border)">
          <div class="row grow" style="cursor: pointer" use:activable onclick={() => (editSr = sr.id)}>
            <Ref>{sr.ref}</Ref>
            <strong>{#if sr.name}{sr.name}{:else}<span class="muted">Sans nom</span>{/if}</strong>
            <span class="badge">{nameOf(srCats, sr.categoryId)}</span>
            <span class="muted small grow">{shortText(sr.description, 90)}</span>
          </div>
          {#if !ro}<button class="btn sm" onclick={() => addPair(sr.id)}><Icon name="plus" size={13} /> Objectif visé</button>{/if}
        </div>
        <div style="overflow-x: auto"><table class="table">
          <thead>
            <tr><th>Réf.</th><th>Objectif visé</th><th class="num">Motiv.</th><th class="num">Ress.</th><th class="num">Activ.</th><th class="num">Pertinence</th><th class="num">Prio.</th><th class="num">Retenu</th><th class="num" title="Gravité héritée des ER associés">Grav.</th></tr>
          </thead>
          <tbody>
            {#each pairs as p (p.id)}
              {@const pi = d.srovPairs.indexOf(p)}
              {@const pert = pertinence(s, p)}
              <tr class="clickable" class:dim={!p.retained} use:activable onclick={() => (editPair = p.id)}>
                <td><Ref>{p.ref}</Ref></td>
                <td style="min-width: 200px"><div class="clamp">{#if p.objective}{p.objective}{:else}<span class="muted">À préciser</span>{/if}</div>{#if p.objectiveCategoryId}<div class="muted small">{nameOf(ovCats, p.objectiveCategoryId)}</div>{/if}</td>
                <td class="num"><LevelChip scale={s.scales.motivation} value={p.motivation} /></td>
                <td class="num"><LevelChip scale={s.scales.resources} value={p.resources} /></td>
                <td class="num"><LevelChip scale={s.scales.activity} value={p.activity} /></td>
                <td class="num"><LevelChip scale={s.scales.pertinence} value={pert.value} showLabel forced={pert.forced !== null} /></td>
                <td class="num">{#if p.priority}<span class="badge {p.priority === 'P1' ? 'red' : 'orange'}">{p.priority}</span>{:else}—{/if}</td>
                <td class="num">
                  <Checkbox checked={p.retained} disabled={ro} onChange={(v) => update((x) => { x.srovPairs[pi].retained = v; if (v && !x.srovPairs[pi].priority) x.srovPairs[pi].priority = "P1"; })} />
                </td>
                <td class="num"><LevelChip scale={s.scales.gravity} value={srovGravity(d, p)} prefix="G" /></td>
              </tr>
            {/each}
            {#if pairs.length === 0}<tr><td colspan="9" class="muted small center">Aucun objectif visé pour cette source.</td></tr>{/if}
          </tbody>
        </table></div>
      </div>
    {/each}
    {#if d.riskSources.length === 0}
      <div class="card empty">
        <h3>Aucune source de risque</h3>
        <p>Passez en revue les catégories de sources de risque (organisation étatique, criminelle, terroriste, concurrent, activiste, officine spécialisée, amateur, collaborateur, tiers opportuniste) et leurs objectifs visés.</p>
        {#if !ro}<button class="btn primary" onclick={addSr}>Ajouter une source de risque</button>{/if}
      </div>
    {/if}
  </div>
  <div class="col gap-lg">
    <div class="card">
      <h3>Métrique de pertinence</h3>
      <p class="small muted">Fiche méthode 4 : pertinence selon la motivation (M) et les ressources (R) de la source de risque{s.useActivityInPertinence ? ", modulée par son activité (±1)" : ""}. {s.scales.pertinence.map((x) => `${x.value} = ${x.label}`).join(", ")}. Modifiable dans les paramètres.</p>
      <table class="table matrix-table" style="width: auto">
        <thead><tr><th style="text-align: left">Ress. \ Motiv.</th>{#each mot as m (m.value)}<th class="num" title={m.label}>M{m.value}</th>{/each}</tr></thead>
        <tbody>
          {#each res as r (r.value)}
            <tr>
              <td style="width: auto; text-align: left; padding: 0 8px; font-size: 12px">R{r.value} · {r.label}</td>
              {#each mot as m (m.value)}
                {@const v = lookup(s.pertinenceMatrix, r.value, m.value)}
                {@const c = levelColor(s.scales.pertinence, v)}
                <td title={s.scales.pertinence.find((x) => x.value === v)?.label} style:background={c} style:color={isLight(c) ? "#1b2333" : "#fff"} style="font-weight: 700; font-size: 12px">{v ?? "—"}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h3>Catégories de sources de risque</h3>
      {#each s.catalogs.riskSourceCategories as c (c.id)}
        <details class="small mb">
          <summary><strong>{c.label}</strong> <span class="muted">({d.riskSources.filter((r) => r.categoryId === c.id).length})</span></summary>
          <p class="muted" style="margin: 4px 0 0 14px">{c.description}</p>
        </details>
      {/each}
    </div>
  </div>
</div>

{#if editSr}<SrDrawer id={editSr} onClose={() => (editSr = null)} onAddPair={(id) => { editSr = null; addPair(id); }} />{/if}
{#if editPair}<PairDrawer id={editPair} onClose={() => (editPair = null)} />{/if}
