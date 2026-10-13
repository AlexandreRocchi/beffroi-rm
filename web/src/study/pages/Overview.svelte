<script lang="ts">
  import { coverage, evaluateStakeholder, PURPOSES, progress, riskLevelDef, riskRows, stripHtml } from "@beffroi/shared";
  import RiskLevelLegend from "../../charts/RiskLevelLegend.svelte";
  import RiskMatrix from "../../charts/RiskMatrix.svelte";
  import ThreatMap from "../../charts/ThreatMap.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import { link } from "../../lib/router.svelte";
  import { WORKSHOPS, WS_COLORS } from "../nav";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  const study = useStudy();
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const rows = $derived(riskRows(d));
  const active = $derived(rows.filter((r) => r.active));
  const prog = $derived(progress(d));
  const uncovered = $derived(coverage(d, rows).filter((c) => c.riskIds.length === 0 && (c.fearedEvent.gravity ?? 0) >= 3));
  const critical = $derived(d.stakeholders.filter((x) => evaluateStakeholder(s, x).critical));
  const count = (lvl: number) => active.filter((r) => r.level === lvl).length;
  const todo = $derived(
    prog.filter((p) => p.ratio < 1 && d.framing.workshopsEnabled[p.workshop as 1]).map((p) => ({ text: `${p.label} : ${p.hint}`, to: p.key === "a2-selection" ? "a2-carto" : p.key })),
  );
  const orphanFe = $derived(d.fearedEvents.filter((f) => f.businessValueId && !d.srovPairs.some((p) => p.fearedEventIds.includes(f.id))));
  const to = (key: string) => `/etudes/${study.studyId}/${key}`;
</script>

<PageTitle title="Vue d'ensemble" subtitle="{d.framing.subject || study.m.name} — {PURPOSES.find((p) => p.id === d.framing.purpose)?.label ?? ''}" />
<div class="grid-4 mb-lg">
  <div class="card kpi"><div class="v">{d.businessValues.length}</div><div class="l">valeurs métier · {d.supportingAssets.length} biens supports</div></div>
  <div class="card kpi"><div class="v">{d.srovPairs.filter((p) => p.retained).length}<span class="muted" style="font-size: 16px"> / {d.srovPairs.length}</span></div><div class="l">couples SR/OV retenus</div></div>
  <div class="card kpi"><div class="v">{critical.length}<span class="muted" style="font-size: 16px"> / {d.stakeholders.length}</span></div><div class="l">parties prenantes critiques</div></div>
  <div class="card kpi">
    <div class="v">{active.length}</div>
    <div class="l">scénarios de risque ·
      {#each s.scales.riskLevels.slice().reverse() as l, i (l.value)}{i ? ", " : " "}<span style="color: {l.color}; font-weight: 700">{count(l.value)} {l.label.toLowerCase()}</span>{/each}
    </div>
  </div>
</div>

<div class="grid-2 mb-lg">
  <div class="card">
    <div class="card-title"><h3>Avancement de l'étude</h3></div>
    {#each WORKSHOPS as w (w.n)}
      {@const items = prog.filter((p) => p.workshop === w.n)}
      {@const r = items.reduce((a, b) => a + b.ratio, 0) / items.length}
      <div class="mb" style:opacity={d.framing.workshopsEnabled[w.n] ? 1 : 0.45}>
        <div class="row between small">
          <a href={to(w.items[0].key)} use:link><strong style:color={WS_COLORS[w.n]}>Atelier {w.n}</strong> · {w.label}</a>
          <span class="muted">{d.framing.workshopsEnabled[w.n] ? `${Math.round(r * 100)} %` : "non conduit"}</span>
        </div>
        <div class="progress-bar"><div style="width: {r * 100}%; background: {WS_COLORS[w.n]}"></div></div>
      </div>
    {/each}
    {#if todo.length > 0}
      <h4 class="mt">Prochaines étapes</h4>
      <ul style="padding-left: 18px; margin: 0">
        {#each todo.slice(0, 5) as t (t.text)}<li class="small"><a href={to(t.to)} use:link>{t.text}</a></li>{/each}
      </ul>
    {/if}
  </div>
  <div class="card">
    <div class="card-title"><h3>Cartographie du risque</h3><a class="btn sm" href={to("a5-synthese")} use:link>Détail</a></div>
    <RiskMatrix settings={s} items={active.map((r) => ({ id: r.record.id, ref: r.record.ref, g: r.gravity.value, v: r.likelihood.value, title: r.record.title, color: riskLevelDef(s, r.level)?.color ? "#1b2333" : undefined }))} />
    <RiskLevelLegend settings={s} />
  </div>
</div>

{#if uncovered.length > 0 || orphanFe.length > 0}
  <div class="callout warning mb-lg">
    <strong>Points d'attention méthodologiques</strong>
    <ul style="margin: 4px 0 0; padding-left: 18px">
      {#each uncovered as c (c.fearedEvent.id)}<li>L'événement redouté {c.fearedEvent.ref} (gravité {c.fearedEvent.gravity}) n'est couvert par aucun scénario de risque : angle mort possible.</li>{/each}
      {#if orphanFe.length > 0}<li>{orphanFe.length} événement(s) redouté(s) ne sont reliés à aucun couple SR/OV (croisement OV/ER de l'atelier 2).</li>{/if}
    </ul>
  </div>
{/if}

<div class="card mb-lg">
  <div class="card-title"><h3>Carte de la menace</h3><a class="btn sm" href={to("carte-menace")} use:link>Agrandir</a></div>
  <ThreatMap data={d} />
</div>

<div class="card">
  <div class="card-title"><h3>Scénarios de risque</h3></div>
  <div class="table-wrap auto">
    <table class="table">
      <thead><tr><th>Réf.</th><th>Scénario de risque</th><th>Source de risque</th><th class="num">Gravité</th><th class="num">Vraisemblance</th><th class="num">Niveau</th><th class="num">Résiduel</th><th class="num">Mesures</th></tr></thead>
      <tbody>
        {#each [...active].sort((a, b) => (b.level ?? 0) - (a.level ?? 0)) as r (r.record.id)}
          <tr>
            <td><span class="ref">{r.record.ref}</span></td>
            <td>{r.record.title || stripHtml(r.path?.name ?? "")}</td>
            <td>{#if r.riskSourceName}{r.riskSourceName}{:else}<span class="muted">Non intentionnel</span>{/if}</td>
            <td class="num"><LevelChip scale={s.scales.gravity} value={r.gravity.value} prefix="G" forced={r.gravity.forced !== null} /></td>
            <td class="num"><LevelChip scale={s.scales.likelihood} value={r.likelihood.value} prefix="V" forced={r.likelihood.forced !== null} /></td>
            <td class="num"><LevelChip scale={s.scales.riskLevels} value={r.level} showLabel /></td>
            <td class="num"><LevelChip scale={s.scales.riskLevels} value={r.residualLevel} showLabel /></td>
            <td class="num">{r.measureIds.length}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
