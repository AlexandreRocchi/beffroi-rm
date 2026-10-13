<script lang="ts">
  import { evaluateStakeholder, nextRef, suggestThresholds, uid, ZONE_LABELS } from "@beffroi/shared";
  import StakeholderLegend from "../../charts/StakeholderLegend.svelte";
  import StakeholderRadar from "../../charts/StakeholderRadar.svelte";
  import Checkbox from "../../components/Checkbox.svelte";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import NumberInput from "../../components/NumberInput.svelte";
  import Ref from "../../components/Ref.svelte";
  import SearchBox from "../../components/SearchBox.svelte";
  import { activable } from "../../lib/actions";
  import { toast } from "../../lib/feedback.svelte";
  import { matches } from "../../lib/levels";
  import { STAKEHOLDER_CRITERIA as CRIT, ZONE_BADGE } from "../helpers";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import StakeholderDrawer from "./a3/StakeholderDrawer.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const t = $derived(s.dangerosity.thresholds);
  let edit = $state<string | null>(null);
  let q = $state("");

  function add() {
    const id = uid();
    update((x) => void x.stakeholders.push({
      id, ref: nextRef("PP", x.stakeholders), name: "", categoryId: null, description: "", rank: 1, parentId: null,
      criteria: { dependency: null, penetration: null, maturity: null, trust: null }, dangerForced: null, justification: "", critical: null,
      residualCriteria: { dependency: null, penetration: null, maturity: null, trust: null }, residualForced: null,
    }));
    edit = id;
  }
  function suggest() {
    const values = d.stakeholders.map((x) => evaluateStakeholder(s, x).initial.value).filter((v): v is number => v !== null);
    const sug = suggestThresholds(values);
    if (!sug) return toast("Au moins trois parties prenantes évaluées sont nécessaires.", "error");
    update((x) => void (x.settings.dangerosity.thresholds = sug));
    toast(`Seuils proposés : veille ${sug.watch}, contrôle ${sug.control}, danger ${sug.danger}.`);
  }
  const list = $derived(d.stakeholders.filter((x) => matches(q, x.ref, x.name)));
</script>

<PageTitle ws={3} title="Cartographie de dangerosité de l'écosystème" subtitle="Niveau de dangerosité = (Dépendance × Pénétration) / (Maturité cyber × Confiance). Les parties prenantes des zones de danger et de contrôle sont critiques.">
  {#snippet actions()}
    {#if !ro}<button class="btn primary" onclick={add}><Icon name="plus" size={14} /> Partie prenante</button>{/if}
  {/snippet}
</PageTitle>

<div class="grid-2 mb-lg" style="grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr)">
  <div class="card">
    <div class="card-title"><h3>Cartographie de dangerosité initiale</h3></div>
    {#if d.stakeholders.length}
      <StakeholderRadar data={d} onPointClick={(id) => (edit = id)} selectedId={edit} />
    {:else}
      <div class="empty">Aucune partie prenante.</div>
    {/if}
    <StakeholderLegend />
  </div>
  <div class="col gap-lg">
    <div class="card col">
      <h3>Seuils des zones</h3>
      <p class="small muted">Fixés par la gouvernance projet ; identiques pour les cartographies initiale et résiduelle.</p>
      <div class="grid-3">
        <Field label="Veille ≥"><NumberInput value={t.watch} min={0} step={0.05} disabled={ro} onChange={(v) => update((x) => void (x.settings.dangerosity.thresholds.watch = v ?? 0), "tw")} /></Field>
        <Field label="Contrôle ≥"><NumberInput value={t.control} min={0} step={0.05} disabled={ro} onChange={(v) => update((x) => void (x.settings.dangerosity.thresholds.control = v ?? 0), "tc")} /></Field>
        <Field label="Danger ≥"><NumberInput value={t.danger} min={0} step={0.05} disabled={ro} onChange={(v) => update((x) => void (x.settings.dangerosity.thresholds.danger = v ?? 0), "td")} /></Field>
      </div>
      {#if !(t.watch < t.control && t.control < t.danger)}<div class="callout danger small">Les seuils doivent être croissants : veille &lt; contrôle &lt; danger.</div>{/if}
      {#if !ro}
        <button class="btn sm" style="align-self: flex-start; white-space: normal; height: auto; min-height: 26px; text-align: left" onclick={suggest}>Proposer des seuils (10 % / 40 % / 40 % / 10 %)</button>
      {/if}
    </div>
    <div class="card">
      <h3>Grille de cotation</h3>
      {#each CRIT as [k, , label] (k)}
        <details class="small mb">
          <summary><strong>{label}</strong></summary>
          <ol style="margin: 4px 0 0; padding-left: 18px">
            {#each s.scales[k] as l (l.value)}<li value={l.value}><strong>{l.label}</strong> — {l.description}</li>{/each}
          </ol>
        </details>
      {/each}
    </div>
  </div>
</div>

<div class="row between mb"><SearchBox value={q} onChange={(v) => (q = v)} /><span class="muted small">Cliquez sur une ligne pour éditer la justification ou forcer la dangerosité.</span></div>
<div class="table-wrap">
  <table class="table">
    <thead>
      <tr>
        <th>Réf.</th><th>Partie prenante</th><th>Catégorie</th><th class="num">Rang</th>
        {#each CRIT as [k, a, l] (k)}<th class="num" title={l}>{a}</th>{/each}
        <th class="num" title="Dépendance × Pénétration">Expo.</th><th class="num" title="Maturité × Confiance">Fiab.</th>
        <th class="num">Dangerosité</th><th>Zone</th><th class="num">Critique</th>
      </tr>
    </thead>
    <tbody>
      {#each list as sh (sh.id)}
        {@const i = d.stakeholders.indexOf(sh)}
        {@const ev = evaluateStakeholder(s, sh)}
        <tr class="clickable" use:activable onclick={() => (edit = sh.id)}>
          <td><Ref>{sh.ref}</Ref></td>
          <td><strong>{#if sh.name}{sh.name}{:else}<span class="muted">Sans nom</span>{/if}</strong></td>
          <td class="small">{s.catalogs.stakeholderCategories.find((c) => c.id === sh.categoryId)?.label ?? "—"}</td>
          <td class="num">{sh.rank}</td>
          {#each CRIT as [k, , label] (k)}
            <td class="num" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} style="width: 64px">
              <select class="inline-input" disabled={ro} value={sh.criteria[k] ?? ""} aria-label="{label} {sh.ref}" title={s.scales[k].find((l) => l.value === sh.criteria[k])?.description}
                onchange={(e) => { const v = e.currentTarget.value === "" ? null : Number(e.currentTarget.value); update((x) => void (x.stakeholders[i].criteria[k] = v)); }}>
                <option value="">–</option>
                {#each s.scales[k] as l (l.value)}<option value={l.value} title={l.description}>{l.value}</option>{/each}
              </select>
            </td>
          {/each}
          <td class="num">{ev.exposure ?? "—"}</td>
          <td class="num">{ev.reliability ?? "—"}</td>
          <td class="num"><strong class:forced-mark={ev.initial.forced !== null} style="padding: 0 4px">{ev.initial.value ?? "—"}</strong></td>
          <td>{#if ev.zone}<span class="badge {ZONE_BADGE[ev.zone]}">{ZONE_LABELS[ev.zone]}</span>{/if}</td>
          <td class="num">
            <Checkbox checked={ev.critical} disabled={ro} onChange={(v) => update((x) => void (x.stakeholders[i].critical = v === ev.suggestedCritical ? null : v))} />
            {#if sh.critical !== null}<span class="muted small" title="Choix différent de la suggestion liée à la zone"> ✎</span>{/if}
          </td>
        </tr>
      {/each}
      {#if list.length === 0}<tr><td colspan="13" class="muted center">Aucune partie prenante.</td></tr>{/if}
    </tbody>
  </table>
</div>
{#if edit}<StakeholderDrawer id={edit} onClose={() => (edit = null)} />{/if}
