<script lang="ts">
  import { ECOSYSTEM_RECOMMENDATIONS, evaluateStakeholder, MEASURE_STATUS, ZONE_LABELS } from "@beffroi/shared";
  import StakeholderLegend from "../../charts/StakeholderLegend.svelte";
  import StakeholderRadar from "../../charts/StakeholderRadar.svelte";
  import Checkbox from "../../components/Checkbox.svelte";
  import DerivedField from "../../components/DerivedField.svelte";
  import Empty from "../../components/Empty.svelte";
  import Icon from "../../components/Icon.svelte";
  import LevelSelect from "../../components/LevelSelect.svelte";
  import Ref from "../../components/Ref.svelte";
  import { activable } from "../../lib/actions";
  import { STAKEHOLDER_CRITERIA as CRIT, ZONE_BADGE } from "../helpers";
  import MeasureDrawer from "../MeasureDrawer.svelte";
  import { newMeasure } from "../measures";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  let editMeasure = $state<string | null>(null);
  let all = $state(false);
  const list = $derived(d.stakeholders.filter((x) => all || evaluateStakeholder(s, x).critical));

  function addMeasure(shId: string) {
    let id = "";
    update((x) => void (id = newMeasure(x, { origin: "ecosystem", stakeholderIds: [shId], category: "governance" })));
    editMeasure = id;
  }
</script>

{#snippet strong(v: number | null)}<strong>{v ?? "—"}</strong>{/snippet}

<PageTitle ws={3} title="Mesures de sécurité sur l'écosystème" subtitle="Réduire la dangerosité des parties prenantes critiques en fixant des niveaux cibles de dépendance, pénétration, maturité et confiance.">
  {#snippet actions()}<Checkbox checked={all} onChange={(v) => (all = v)} label="Afficher toutes les parties prenantes" />{/snippet}
</PageTitle>

<div class="grid-2 mb-lg">
  <div class="card"><StakeholderRadar data={d} title="Dangerosité initiale" size={520} /></div>
  <div class="card"><StakeholderRadar data={d} residual title="Dangerosité résiduelle" size={520} /></div>
</div>
<div class="mb-lg"><StakeholderLegend /></div>

{#if list.length === 0}<div class="card"><Empty title="Aucune partie prenante critique">Évaluez l'écosystème et sélectionnez les parties prenantes critiques.</Empty></div>{/if}
<div class="col gap-lg">
  {#each list as sh (sh.id)}
    {@const i = d.stakeholders.indexOf(sh)}
    {@const ev = evaluateStakeholder(s, sh)}
    {@const rec = ev.zone ? ECOSYSTEM_RECOMMENDATIONS[ev.zone] : null}
    {@const measures = d.measures.filter((m) => m.stakeholderIds.includes(sh.id))}
    {@const paths = d.strategicScenarios.flatMap((sc) => sc.paths.filter((p) => p.steps.some((st) => st.stakeholderId === sh.id)).map((p) => `${sc.ref}.${p.ref} ${p.name}`))}
    <div class="card">
      <div class="row between wrap mb">
        <div class="row">
          <Ref>{sh.ref}</Ref><h3 style="margin: 0">{sh.name}</h3>
          {#if ev.zone}<span class="badge {ZONE_BADGE[ev.zone]}">{ZONE_LABELS[ev.zone]}</span>{/if}
          <span class="muted small">menace initiale {ev.initial.value ?? "—"}</span>
          <Icon name="right" size={14} />
          <strong>résiduelle {ev.residual.value ?? "—"}</strong>
          {#if ev.residualZone}<span class="badge {ZONE_BADGE[ev.residualZone]}">{ZONE_LABELS[ev.residualZone]}</span>{/if}
        </div>
      </div>
      {#if rec}<div class="callout {ev.zone === 'danger' ? 'danger' : ev.zone === 'control' ? 'warning' : 'success'} small mb"><strong>{rec.acceptability}</strong> — {rec.actions}</div>{/if}
      {#if paths.length > 0}<div class="small muted mb">Impliquée dans : {paths.join(" · ")}</div>{/if}
      <div class="grid-2">
        <div>
          <table class="table">
            <thead><tr><th>Critère</th><th class="num">Initial</th><th>Niveau cible (après mesures)</th></tr></thead>
            <tbody>
              {#each CRIT as [k, , label] (k)}
                <tr>
                  <td>{label}</td>
                  <td class="num"><strong>{sh.criteria[k] ?? "—"}</strong></td>
                  <td>
                    <LevelSelect scale={s.scales[k]} value={sh.residualCriteria[k]} disabled={ro} placeholder="Inchangé ({sh.criteria[k] ?? '—'})" ariaLabel="{label} cible"
                      onChange={(v) => update((x) => void (x.stakeholders[i].residualCriteria[k] = v))} />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          <DerivedField label="Dangerosité résiduelle" computed={ev.residual.computed} forced={ev.residual.forced} disabled={ro} numeric={{ min: 0, max: 100, step: 0.01 }}
            onForce={(v) => update((x) => void (x.stakeholders[i].residualForced = v))} format={strong} />
        </div>
        <div>
          <div class="row between"><h4 style="margin: 0">Mesures associées</h4>
            {#if !ro}<button class="btn sm" onclick={() => addMeasure(sh.id)}><Icon name="plus" size={12} /> Mesure</button>{/if}
          </div>
          {#each measures as m (m.id)}
            <div class="row mt" style="cursor: pointer" use:activable onclick={() => (editMeasure = m.id)}>
              <Ref>{m.ref}</Ref><span class="grow small">{m.title || "Sans intitulé"}</span>
              <span class="badge" style:color={MEASURE_STATUS[m.status].color}>{MEASURE_STATUS[m.status].label}</span>
            </div>
          {/each}
          {#if measures.length === 0}<div class="muted small mt">Aucune mesure. Agir en priorité sur le critère le plus pénalisant, le moins coûteux ou le plus efficace.</div>{/if}
          <div class="callout small mt">Une mesure ne réduit la dangerosité actuelle que si elle est effectivement mise en œuvre avant la suite de l'analyse.</div>
        </div>
      </div>
    </div>
  {/each}
</div>
{#if editMeasure}<MeasureDrawer id={editMeasure} onClose={() => (editMeasure = null)} />{/if}
