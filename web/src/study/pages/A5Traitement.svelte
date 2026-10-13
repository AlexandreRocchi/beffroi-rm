<script lang="ts">
  import { COST_LABELS, MEASURE_CATEGORY, MEASURE_ORIGIN, MEASURE_STATUS, riskLevelDef, riskRows, TREATMENT, type Measure, type TreatmentOption } from "@beffroi/shared";
  import RiskMatrix from "../../charts/RiskMatrix.svelte";
  import StackedBars from "../../charts/StackedBars.svelte";
  import Timeline from "../../charts/Timeline.svelte";
  import Icon from "../../components/Icon.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import Ref from "../../components/Ref.svelte";
  import SearchBox from "../../components/SearchBox.svelte";
  import Tabs from "../../components/Tabs.svelte";
  import { download, toCsv } from "../../export/csv";
  import { activable } from "../../lib/actions";
  import { Api } from "../../lib/api";
  import { matches } from "../../lib/levels";
  import { fmtDate } from "../helpers";
  import MeasureDrawer from "../MeasureDrawer.svelte";
  import { newMeasure } from "../measures";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  type SortKey = "ref" | "category" | "owner" | "cost" | "dueDate" | "priority" | "status" | "progress";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const rows = $derived(riskRows(d).filter((r) => r.active));
  let tab = $state<"strategie" | "plan" | "pilotage">("strategie");
  let selRisk = $state<string | null>(null);
  let edit = $state<string | null>(null);
  let q = $state("");
  let fCat = $state("");
  let fStatus = $state("");
  let fOrigin = $state("");
  let fRisk = $state("");
  let sort = $state<{ k: SortKey; asc: boolean }>({ k: "ref", asc: true });
  const today = new Date().toISOString().slice(0, 10);
  const late = (m: Measure) => !!m.dueDate && m.dueDate < today && m.status !== "done";

  const measures = $derived.by(() => {
    const list = d.measures.filter((m) => matches(q, m.ref, m.title, m.owner) && (!fCat || m.category === fCat) && (!fStatus || m.status === fStatus) && (!fOrigin || m.origin === fOrigin) && (!fRisk || m.riskIds.includes(fRisk)));
    const val = (m: Measure): string | number => {
      switch (sort.k) {
        case "ref": return Number(m.ref.replace(/\D/g, "")) || 0;
        case "cost": return m.cost ?? 99;
        case "progress": return m.progress;
        case "priority": return m.priority ?? "P9";
        default: return (m[sort.k] as string) || "~";
      }
    };
    return [...list].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * (sort.asc ? 1 : -1));
  });
  const sel = $derived(rows.find((r) => r.record.id === selRisk));
  const statusSeries = $derived(Object.entries(MEASURE_STATUS).map(([k, v]) => ({ key: k, label: v.label, color: v.color })));

  function add() {
    let id = "";
    const risk = fRisk;
    update((x) => void (id = newMeasure(x, risk ? { riskIds: [risk] } : {})));
    edit = id;
  }
  function exportCsv() {
    const m0 = study.m;
    download(`plan-de-traitement_${m0.protection}.csv`, toCsv([
      [`Mention de protection : ${m0.protection}`],
      ["Réf.", "Mesure", "Catégorie", "Origine", "Risques", "Responsable", "Freins et difficultés", "Coût", "Charge", "Échéance", "Priorité", "Statut", "Avancement (%)"],
      ...measures.map((m) => [m.ref, m.title, MEASURE_CATEGORY[m.category].label, MEASURE_ORIGIN[m.origin], m.riskIds.map((id) => d.risks.find((r) => r.id === id)?.ref).join(", "), m.owner, m.obstacles, m.cost ? COST_LABELS[m.cost] : "", m.effort, m.dueDate, m.priority ?? "", MEASURE_STATUS[m.status].label, m.progress]),
    ]), "text/csv");
    void Api.logExport(m0.id, "csv", "plan de traitement (sélection)");
  }
  const setAcceptability = (riskId: string, value: number, level: number | null) =>
    update((x) => {
      const r = x.risks.find((y) => y.id === riskId);
      if (r) r.acceptabilityForced = value === level ? null : value;
    });
  const setTreatment = (riskId: string, t: TreatmentOption | null) =>
    update((x) => {
      const r = x.risks.find((y) => y.id === riskId);
      if (r) r.treatment = t;
    });
</script>

{#snippet th(k: SortKey, label: string, cls = "")}
  <th class={cls} style="cursor: pointer" onclick={() => (sort = { k, asc: sort.k === k ? !sort.asc : true })}>
    {label}{sort.k === k ? (sort.asc ? " ▲" : " ▼") : ""}
  </th>
{/snippet}

<PageTitle ws={5} title="Stratégie et plan de traitement du risque" subtitle="Acceptabilité de chaque risque, puis mesures de sécurité (socle, écosystème, scénarios) échelonnées dans un plan de traitement.">
  {#snippet actions()}
    {#if !ro}<button class="btn primary" onclick={add}><Icon name="plus" size={14} /> Mesure</button>{/if}
  {/snippet}
</PageTitle>
<Tabs value={tab} onChange={(v) => (tab = v)} tabs={[
  { id: "strategie", label: "Stratégie de traitement" },
  { id: "plan", label: `Plan de traitement (${d.measures.length})` },
  { id: "pilotage", label: "Avancement du plan" },
]} />

{#if tab === "strategie"}
  <div class="split">
    <div class="card">
      <RiskMatrix settings={s} selectedId={selRisk} onSelect={(id) => (selRisk = id)} title="Cliquez sur un risque pour définir sa stratégie"
        items={rows.map((r) => ({ id: r.record.id, ref: r.record.ref, g: r.gravity.value, v: r.likelihood.value, title: r.record.title, color: riskLevelDef(s, r.acceptability)?.color, forced: r.record.acceptabilityForced !== null }))} />
      <p class="small muted">Couleur des pastilles = acceptabilité retenue (par défaut, celle du niveau de risque).</p>
      <table class="table">
        <thead><tr><th>Niveau</th><th>Acceptabilité</th><th>Décision</th></tr></thead>
        <tbody>
          {#each [...s.scales.riskLevels].reverse() as l (l.value)}
            <tr><td><LevelChip scale={s.scales.riskLevels} value={l.value} showLabel /></td><td><strong>{l.acceptability}</strong></td><td class="small">{l.decision}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="col gap-lg">
      {#if sel}
        <div class="card" style="border-color: var(--primary-2)">
          <h3><Ref>{sel.record.ref}</Ref> {sel.record.title}</h3>
          <div class="row wrap mb">Niveau initial <LevelChip scale={s.scales.riskLevels} value={sel.level} showLabel /></div>
          <div class="small mb">Acceptabilité :</div>
          <div class="row wrap mb">
            {#each [...s.scales.riskLevels].reverse() as l (l.value)}
              {@const on = sel.acceptability === l.value}
              <button class="btn sm" disabled={ro} style:border-color={l.color} style:background={on ? l.color : undefined} style:color={on ? "#fff" : undefined} onclick={() => setAcceptability(sel.record.id, l.value, sel.level)}>
                {l.acceptability}
              </button>
            {/each}
          </div>
          <div class="small mb">Option de traitement :</div>
          <div class="btn-group">
            {#each Object.keys(TREATMENT) as TreatmentOption[] as t (t)}
              <button class="btn sm" class:active={sel.record.treatment === t} disabled={ro} onclick={() => setTreatment(sel.record.id, t)}>{TREATMENT[t]}</button>
            {/each}
          </div>
        </div>
      {/if}
      <div class="table-wrap auto">
        <table class="table">
          <thead><tr><th>Réf.</th><th>Scénario de risque</th><th class="num">Niveau</th><th>Acceptabilité</th><th>Traitement</th><th class="num">Mesures</th></tr></thead>
          <tbody>
            {#each rows as r (r.record.id)}
              {@const acc = riskLevelDef(s, r.acceptability)}
              <tr class="clickable" class:selected={selRisk === r.record.id} use:activable onclick={() => (selRisk = r.record.id)}>
                <td><Ref>{r.record.ref}</Ref></td>
                <td class="small">{r.record.title}</td>
                <td class="num"><LevelChip scale={s.scales.riskLevels} value={r.level} showLabel /></td>
                <td><span class="badge" style:background={acc?.color} style="color: #fff">{acc?.acceptability ?? "—"}{r.record.acceptabilityForced !== null ? " ✎" : ""}</span></td>
                <td onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                  <select value={r.record.treatment ?? ""} disabled={ro} aria-label="Traitement {r.record.ref}" onchange={(e) => setTreatment(r.record.id, (e.currentTarget.value || null) as TreatmentOption | null)}>
                    <option value="">À décider</option>
                    {#each Object.keys(TREATMENT) as TreatmentOption[] as t (t)}<option value={t}>{TREATMENT[t]}</option>{/each}
                  </select>
                </td>
                <td class="num"><button class="btn sm ghost" onclick={(e) => { e.stopPropagation(); fRisk = r.record.id; tab = "plan"; }}>{r.measureIds.length}</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
{:else if tab === "plan"}
  <div class="row wrap mb">
    <SearchBox value={q} onChange={(v) => (q = v)} />
    <select bind:value={fCat} style="width: 160px" aria-label="Catégorie"><option value="">Toutes catégories</option>{#each Object.entries(MEASURE_CATEGORY) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select>
    <select bind:value={fOrigin} style="width: 190px" aria-label="Origine"><option value="">Toutes origines</option>{#each Object.entries(MEASURE_ORIGIN) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select>
    <select bind:value={fStatus} style="width: 150px" aria-label="Statut"><option value="">Tous statuts</option>{#each Object.entries(MEASURE_STATUS) as [k, v] (k)}<option value={k}>{v.label}</option>{/each}</select>
    <select bind:value={fRisk} style="width: 200px" aria-label="Risque"><option value="">Tous les risques</option>{#each d.risks as r (r.id)}<option value={r.id}>{r.ref} · {r.title.slice(0, 50)}</option>{/each}</select>
    <span class="muted small">{measures.length} mesure(s)</span>
    <button class="btn sm" onclick={exportCsv}><Icon name="download" size={13} /> Exporter la sélection (CSV)</button>
  </div>
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          {@render th("ref", "Réf.")}<th>Mesure de sécurité</th>{@render th("category", "Catégorie")}<th>Risques</th>{@render th("owner", "Responsable")}<th>Freins et difficultés</th>
          {@render th("cost", "Coût", "num")}<th>Charge</th>{@render th("dueDate", "Échéance")}{@render th("priority", "Priorité", "num")}{@render th("status", "Statut")}{@render th("progress", "Avancement")}
        </tr>
      </thead>
      <tbody>
        {#each measures as m (m.id)}
          <tr class="clickable" use:activable onclick={() => (edit = m.id)}>
            <td><Ref>{m.ref}</Ref></td>
            <td style="max-width: 320px">{#if m.title}{m.title}{:else}<span class="muted">Sans intitulé</span>{/if}<div class="muted small">{MEASURE_ORIGIN[m.origin]}</div></td>
            <td><span class="badge" style:background={MEASURE_CATEGORY[m.category].color} style="color: #fff">{MEASURE_CATEGORY[m.category].label}</span></td>
            <td class="small">{m.riskIds.map((id) => d.risks.find((r) => r.id === id)?.ref).filter(Boolean).join(", ")}</td>
            <td class="small">{m.owner}</td>
            <td class="small" style="max-width: 200px">{m.obstacles}</td>
            <td class="num">{m.cost ? COST_LABELS[m.cost] : "—"}</td>
            <td class="small">{m.effort}</td>
            <td class="nowrap small" style:color={late(m) ? "var(--danger)" : undefined}>{fmtDate(m.dueDate)}</td>
            <td class="num">{m.priority ?? "—"}</td>
            <td><span class="badge dot" style:color={MEASURE_STATUS[m.status].color}>{MEASURE_STATUS[m.status].label}</span></td>
            <td style="width: 110px"><div class="progress-bar"><div style:width="{m.progress}%" style:background={m.progress === 100 ? "var(--success)" : undefined}></div></div><span class="small muted">{m.progress} %</span></td>
          </tr>
        {/each}
        {#if measures.length === 0}<tr><td colspan="12" class="muted center">Aucune mesure.</td></tr>{/if}
      </tbody>
    </table>
  </div>
{:else}
  <div class="col gap-lg">
    <div class="grid-4">
      <div class="card kpi"><div class="v">{d.measures.length}</div><div class="l">mesures au plan</div></div>
      <div class="card kpi"><div class="v" style="color: var(--success)">{d.measures.filter((m) => m.status === "done").length}</div><div class="l">terminées</div></div>
      <div class="card kpi"><div class="v">{d.measures.length ? Math.round(d.measures.reduce((a, m) => a + m.progress, 0) / d.measures.length) : 0} %</div><div class="l">avancement moyen</div></div>
      <div class="card kpi"><div class="v" style="color: var(--danger)">{d.measures.filter(late).length}</div><div class="l">en retard</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <StackedBars title="Mesures par catégorie et statut" series={statusSeries} rows={Object.entries(MEASURE_CATEGORY).map(([k, v]) => ({
          label: v.label,
          values: Object.fromEntries(Object.keys(MEASURE_STATUS).map((st) => [st, d.measures.filter((m) => m.category === k && m.status === st).length])),
        }))} />
      </div>
      <div class="card">
        <StackedBars title="Mesures par scénario de risque" series={statusSeries} rows={rows.map((r) => ({
          label: `${r.record.ref} (${riskLevelDef(s, r.level)?.label ?? "?"})`,
          values: Object.fromEntries(Object.keys(MEASURE_STATUS).map((st) => [st, d.measures.filter((m) => m.riskIds.includes(r.record.id) && m.status === st).length])),
        }))} />
      </div>
    </div>
    <div class="card">
      <Timeline title="Échéancier du plan de traitement" items={d.measures.map((m) => ({ id: m.id, label: `${m.ref} ${m.title}`, date: m.dueDate, color: MEASURE_CATEGORY[m.category].color, done: m.status === "done" }))} />
      <div class="legend">{#each Object.values(MEASURE_CATEGORY) as c (c.label)}<span><span class="sw" style:background={c.color}></span>{c.label}</span>{/each}<span><span class="sw" style="background: #fff; border: 1px dashed #c62828"></span>Aujourd'hui</span></div>
    </div>
  </div>
{/if}
{#if edit}<MeasureDrawer id={edit} onClose={() => (edit = null)} />{/if}
