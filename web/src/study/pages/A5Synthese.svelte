<script lang="ts">
  import { coverage, riskRows } from "@beffroi/shared";
  import RiskLevelLegend from "../../charts/RiskLevelLegend.svelte";
  import RiskMatrix from "../../charts/RiskMatrix.svelte";
  import Checkbox from "../../components/Checkbox.svelte";
  import Combo from "../../components/Combo.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import LevelSelect from "../../components/LevelSelect.svelte";
  import Ref from "../../components/Ref.svelte";
  import Tabs from "../../components/Tabs.svelte";
  import { activable } from "../../lib/actions";
  import { buildOptions } from "../helpers";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import { riskColor } from "./a5/risk";
  import RiskDrawer from "./a5/RiskDrawer.svelte";
  import RiskTable from "./a5/RiskTable.svelte";

  const study = useStudy();
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const rows = $derived(riskRows(d));
  const opts = $derived(buildOptions(d));
  let sel = $state<string | null>(null);
  let src = $state<string | null>(null);
  let gmin = $state<number | null>(null);
  let tab = $state<"liste" | "srov" | "couverture">("liste");
  let showExcluded = $state(false);
  const visible = $derived(rows.filter((r) => (showExcluded || r.active) && (!src || r.pair?.riskSourceId === src) && (gmin === null || (r.gravity.value ?? 0) >= gmin)));
  const cov = $derived(coverage(d, rows));
  const active = $derived(rows.filter((r) => r.active));
  const open = (id: string) => (sel = id);
</script>

<PageTitle ws={5} title="Synthèse des scénarios de risque" subtitle="Cartographie du risque initial : chaque chemin d'attaque et son scénario opérationnel forment un scénario de risque (gravité du scénario stratégique × vraisemblance du scénario opérationnel)." />
<div class="card mb-lg">
  <div class="row wrap mb">
    <div style="width: 260px"><Combo options={opts.sr} value={src} onChange={(v) => (src = v)} placeholder="Filtrer par source de risque…" /></div>
    <div style="width: 220px"><LevelSelect scale={s.scales.gravity} value={gmin} onChange={(v) => (gmin = v)} prefix="G ≥ " placeholder="Toutes gravités" ariaLabel="Gravité minimale" /></div>
    <Checkbox checked={showExcluded} onChange={(v) => (showExcluded = v)} label="Inclure les risques écartés" />
  </div>
  <div class="split">
    <div>
      <RiskMatrix settings={s} selectedId={sel} onSelect={open} title="Cartographie du risque initial"
        items={visible.map((r) => ({ id: r.record.id, ref: r.record.ref, g: r.gravity.value, v: r.likelihood.value, title: `${r.record.ref} — ${r.record.title}`, color: "#1b2333", forced: r.gravity.forced !== null || r.likelihood.forced !== null }))} />
      <RiskLevelLegend settings={s} />
    </div>
    <div class="col">
      {#each visible as r (r.record.id)}
        <div class="row top" class:card={sel === r.record.id} style="cursor: pointer" style:padding={sel === r.record.id ? "8px" : "4px 8px"} use:activable onclick={() => open(r.record.id)}>
          <span class="level-chip" style:background={riskColor(s, r.level)} style="min-width: 34px">{r.record.ref}</span>
          <span class="small grow">{r.record.title}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<Tabs value={tab} onChange={(v) => (tab = v)} tabs={[
  { id: "liste", label: "Tableau de synthèse" },
  { id: "srov", label: "Par source de risque / objectif visé" },
  { id: "couverture", label: `Couverture des événements redoutés${cov.some((c) => c.riskIds.length === 0) ? " ⚠" : ""}` },
]} />

{#if tab === "liste"}
  <RiskTable rows={visible} onOpen={open} />
{:else if tab === "srov"}
  <div class="col gap-lg">
    {#each d.srovPairs.filter((p) => p.retained) as p (p.id)}
      {@const rs = visible.filter((r) => r.pair?.id === p.id)}
      <div class="card">
        <h3><Ref>{p.ref}</Ref> {d.riskSources.find((x) => x.id === p.riskSourceId)?.name} — <span class="text-2" style="font-weight: 500">{p.objective}</span></h3>
        {#if rs.length}<RiskTable rows={rs} onOpen={open} compact />{:else}<div class="muted small">Aucun scénario de risque pour ce couple.</div>{/if}
      </div>
    {/each}
    {#if visible.some((r) => r.kind === "unintentional")}
      <div class="card"><h3>Risques non intentionnels</h3><RiskTable rows={visible.filter((r) => r.kind === "unintentional")} onOpen={open} compact /></div>
    {/if}
  </div>
{:else}
  <div class="card">
    <p class="small muted">Identifiez les événements redoutés de gravité importante non abordés par un scénario de risque : ils peuvent justifier une itération des ateliers 2, 3 et 4.</p>
    <div class="table-wrap auto">
      <table class="table">
        <thead>
          <tr><th class="sticky-col">Événement redouté</th><th class="num">Gravité</th>{#each active as r (r.record.id)}<th class="num" title={r.record.title}>{r.record.ref}</th>{/each}<th class="num">Couverture</th></tr>
        </thead>
        <tbody>
          {#each cov as c (c.fearedEvent.id)}
            {@const blind = c.riskIds.length === 0}
            <tr style:background={blind ? "#fff3e0" : undefined}>
              <td class="sticky-col" style="min-width: 320px" style:background={blind ? "#fff3e0" : undefined}><Ref>{c.fearedEvent.ref}</Ref> <span class="small">{c.fearedEvent.name}</span></td>
              <td class="num"><LevelChip scale={s.scales.gravity} value={c.fearedEvent.gravity} prefix="G" /></td>
              {#each active as r (r.record.id)}<td class="num">{c.riskIds.includes(r.record.id) ? "●" : ""}</td>{/each}
              <td class="num">{#if c.riskIds.length}<span class="badge green">{c.riskIds.length}</span>{:else}<span class="badge orange">Angle mort</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
{#if sel}<RiskDrawer id={sel} onClose={() => (sel = null)} />{/if}
