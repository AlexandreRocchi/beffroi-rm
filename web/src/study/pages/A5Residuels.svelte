<script lang="ts">
  import { riskLevelDef, riskRows } from "@beffroi/shared";
  import RiskLevelLegend from "../../charts/RiskLevelLegend.svelte";
  import RiskMatrix from "../../charts/RiskMatrix.svelte";
  import Checkbox from "../../components/Checkbox.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import LevelSelect from "../../components/LevelSelect.svelte";
  import Ref from "../../components/Ref.svelte";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import ResidualDrawer from "./a5/ResidualDrawer.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const rows = $derived(riskRows(d).filter((r) => r.active));
  let arrows = $state(true);
  let doc = $state<string | null>(null);
  const idx = (id: string) => d.risks.findIndex((r) => r.id === id);
  const arrowItems = $derived(
    arrows
      ? rows
          .filter((r) => r.gravity.value !== null && r.likelihood.value !== null && r.residualGravity !== null && r.residualLikelihood !== null)
          .map((r) => ({ id: r.record.id, from: { g: r.gravity.value as number, v: r.likelihood.value as number }, to: { g: r.residualGravity as number, v: r.residualLikelihood as number } }))
      : undefined,
  );
  function move(id: string, g: number, v: number) {
    const i = idx(id);
    update((x) => {
      x.risks[i].residualGravity = g;
      x.risks[i].residualLikelihood = v;
    });
  }
</script>

<PageTitle ws={5} title="Risques résiduels" subtitle="Réévaluation de la gravité et de la vraisemblance après application des mesures ; glissez un risque sur la cartographie résiduelle ou saisissez les valeurs dans le tableau.">
  {#snippet actions()}<Checkbox checked={arrows} onChange={(v) => (arrows = v)} label="Afficher l'évolution initial → résiduel" />{/snippet}
</PageTitle>
<div class="grid-2 mb-lg">
  <div class="card">
    <RiskMatrix settings={s} title="Cartographie du risque initial" items={rows.map((r) => ({ id: r.record.id, ref: r.record.ref, g: r.gravity.value, v: r.likelihood.value, title: r.record.title, color: riskLevelDef(s, r.level)?.color }))} />
  </div>
  <div class="card">
    <RiskMatrix settings={s} title="Cartographie du risque résiduel" draggable={!ro}
      items={rows.map((r) => ({ id: r.record.id, ref: r.record.ref, g: r.residualGravity, v: r.residualLikelihood, title: `${r.record.title} (glisser pour réévaluer)`, color: riskLevelDef(s, r.residualLevel)?.color, forced: r.record.residualGravity !== null || r.record.residualLikelihood !== null }))}
      arrows={arrowItems} onMove={move} onSelect={(id) => (doc = id)} />
  </div>
</div>
<div class="mb"><RiskLevelLegend settings={s} /></div>

<div class="table-wrap">
  <table class="table">
    <thead>
      <tr><th>Réf.</th><th>Scénario de risque</th><th class="num">Initial</th><th style="width: 170px">Gravité résiduelle</th><th style="width: 190px">Vraisemblance résiduelle</th><th class="num">Résiduel</th><th class="num">Mesures</th><th>Fiche</th></tr>
    </thead>
    <tbody>
      {#each rows as r (r.record.id)}
        {@const i = idx(r.record.id)}
        {@const documented = !!(r.record.residualDoc.description || r.record.residualDoc.management)}
        <tr>
          <td><Ref>{r.record.ref}</Ref></td>
          <td class="small">{r.record.title}</td>
          <td class="num"><LevelChip scale={s.scales.riskLevels} value={r.level} showLabel /></td>
          <td><LevelSelect scale={s.scales.gravity} value={r.record.residualGravity} prefix="G" disabled={ro} ariaLabel="Gravité résiduelle {r.record.ref}" placeholder="Inchangée (G{r.gravity.value ?? '?'})" onChange={(v) => update((x) => void (x.risks[i].residualGravity = v))} /></td>
          <td><LevelSelect scale={s.scales.likelihood} value={r.record.residualLikelihood} prefix="V" disabled={ro} ariaLabel="Vraisemblance résiduelle {r.record.ref}" placeholder="Inchangée (V{r.likelihood.value ?? '?'})" onChange={(v) => update((x) => void (x.risks[i].residualLikelihood = v))} /></td>
          <td class="num"><LevelChip scale={s.scales.riskLevels} value={r.residualLevel} showLabel /></td>
          <td class="num">{r.measureIds.length}</td>
          <td><button class="btn sm" onclick={() => (doc = r.record.id)}>{documented ? "✓ Documenté" : "Documenter"}</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
{#if doc}<ResidualDrawer id={doc} onClose={() => (doc = null)} />{/if}
