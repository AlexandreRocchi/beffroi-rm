<script lang="ts">
  import {
    BASELINE_STATUS,
    instantiateReferential,
    REFERENTIAL_LIBRARY,
    REFERENTIAL_TYPES,
    referentialStatus,
    REQUIREMENT_STATUS,
    uid,
    type Referential,
    type ReferentialType,
    type RequirementStatus,
  } from "@beffroi/shared";
  import Kiviat from "../../charts/Kiviat.svelte";
  import Checkbox from "../../components/Checkbox.svelte";
  import Icon from "../../components/Icon.svelte";
  import Modal from "../../components/Modal.svelte";
  import RichText from "../../components/RichText.svelte";
  import { download, parseCsv, pickFile, toCsv } from "../../export/csv";
  import { activable } from "../../lib/actions";
  import { toast } from "../../lib/feedback.svelte";
  import { shortText } from "../helpers";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import { confirmDelete } from "../useDelete";
  import RequirementDrawer from "./a1/RequirementDrawer.svelte";
  import { STATUS_ORDER } from "./a1/requirements";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const ro = $derived(study.readOnly);
  const refs = $derived(d.baseline.referentials);
  let onlyGaps = $state(false);
  let adding = $state(false);
  let editReq = $state<{ ri: number; id: string } | null>(null);

  function statusFromText(t: string): RequirementStatus {
    const s = t.toLowerCase();
    if (/restri|partiel/.test(s)) return "partial";
    if (/non.?appliq|^non$|rouge/.test(s)) return "not_applied";
    if (/non.?applicable|n\/a|na$/.test(s)) return "na";
    if (/appliq|oui|vert/.test(s)) return "applied";
    return "unknown";
  }

  const axes = $derived.by(() => {
    const score = (reqs: Referential["requirements"]) => {
      const rel = reqs.filter((r) => r.status !== "na");
      const ev = rel.filter((r) => r.status !== "unknown");
      if (!ev.length) return null;
      return rel.reduce((s, r) => s + (r.status === "applied" ? 1 : r.status === "partial" ? 0.5 : 0), 0) / rel.length;
    };
    if (refs.length === 1 && refs[0].requirements.some((r) => r.section)) {
      const sections = [...new Set(refs[0].requirements.map((r) => r.section ?? "Autres"))];
      return sections.map((sec) => ({ label: sec, value: score(refs[0].requirements.filter((r) => (r.section ?? "Autres") === sec)) }));
    }
    return refs.map((r) => ({ label: r.name, value: score(r.requirements) }));
  });

  async function importCsv(refIndex: number) {
    const f = await pickFile(".csv,text/csv");
    if (!f) return;
    const rows = parseCsv(await f.text());
    rows.shift();
    update((x) => {
      for (const r of rows) {
        if (!r[1] && !r[0]) continue;
        x.baseline.referentials[refIndex].requirements.push({ id: uid(), ref: r[0] ?? "", title: r[1] ?? "", ...(r[2] ? { section: r[2] } : {}), status: statusFromText(r[3] ?? ""), gap: r[4] ?? "", justification: r[5] ? `<p>${r[5]}</p>` : "" });
      }
    });
    toast(`${rows.length} exigence(s) importée(s).`, "success");
  }
  function addRequirement(ri: number, n: number) {
    const id = uid();
    update((x) => void x.baseline.referentials[ri].requirements.push({ id, ref: `E${n + 1}`, title: "", status: "unknown", gap: "", justification: "" }));
    editReq = { ri, id };
  }
  function addEmpty() {
    update((x) => void x.baseline.referentials.push({ id: uid(), type: "internal", name: "Nouveau référentiel", description: "", statusForced: null, requirements: [] }));
    adding = false;
  }
  const isGap = (s: RequirementStatus) => s === "partial" || s === "not_applied";
</script>

<PageTitle ws={1} title="Socle de sécurité" subtitle="Référentiels applicables, état d'application, écarts et justification (approche par conformité).">
  {#snippet actions()}
    <Checkbox checked={onlyGaps} onChange={(v) => (onlyGaps = v)} label="Seulement les exigences non respectées" />
    {#if !ro}<button class="btn primary" onclick={() => (adding = true)}><Icon name="plus" size={14} /> Référentiel</button>{/if}
  {/snippet}
</PageTitle>

<div class="grid-2 mb-lg">
  <div class="card">
    <div class="card-title"><h3>Couverture du socle</h3></div>
    {#if axes.length >= 3}
      <Kiviat {axes} size={440} />
    {:else}
      <div class="col">
        {#each refs as r (r.id)}
          {@const st = referentialStatus(r)}
          <div>
            <div class="row between small"><span>{r.name}</span><span>{st.total ? Math.round((st.applied / st.total) * 100) : 0} %</span></div>
            <div class="progress-bar"><div style:width="{st.total ? (st.applied / st.total) * 100 : 0}%"></div></div>
          </div>
        {/each}
        {#if refs.length === 0}<div class="muted">Ajoutez un référentiel pour visualiser la couverture.</div>{/if}
      </div>
    {/if}
  </div>
  <div class="card col">
    <h3>Décision de poursuite de l'étude</h3>
    <p class="small muted">En cas d'écarts trop significatifs, il n'est pas pertinent d'évaluer des risques ciblés : renforcer d'abord le socle. Sinon, poursuivre en considérant les non-conformités, que les scénarios viendront exploiter.</p>
    <select value={d.baseline.decision} disabled={ro} aria-label="Décision de poursuite" onchange={(e) => { const v = e.currentTarget.value as typeof d.baseline.decision; update((x) => void (x.baseline.decision = v)); }}>
      <option value="undecided">À décider</option>
      <option value="continue">Poursuivre l'étude en considérant les non-conformités</option>
      <option value="strengthen_first">Renforcer le socle avant de poursuivre</option>
    </select>
    <RichText value={d.baseline.decisionComment} disabled={ro} onChange={(v) => update((x) => void (x.baseline.decisionComment = v), "decision")} placeholder="Motivation de la décision…" />
    <div class="legend">
      {#each Object.entries(BASELINE_STATUS) as [k, v] (k)}<span><span class="sw" style:background={v.color}></span>{v.label}</span>{/each}
    </div>
  </div>
</div>

{#each refs as r, ri (r.id)}
  {@const st = referentialStatus(r)}
  {@const color = st.value ? BASELINE_STATUS[st.value].color : "#9e9e9e"}
  {@const reqs = r.requirements.filter((q) => !onlyGaps || isGap(q.status))}
  <div class="card mb-lg" style:border-left="5px solid {color}">
    <div class="row top">
      <button class="btn ghost sm icon" onclick={() => update((x) => void (x.baseline.referentials[ri].collapsed = !r.collapsed))} title={r.collapsed ? "Afficher les exigences" : "Masquer les exigences"}>
        <Icon name={r.collapsed ? "right" : "down"} size={14} />
      </button>
      <div class="col grow" style="gap: 6px">
        <input type="text" class="inline-input" style="font-weight: 700; font-size: 15px" value={r.name} disabled={ro} aria-label="Nom du référentiel" oninput={(e) => update((x) => void (x.baseline.referentials[ri].name = e.currentTarget.value), `rn-${r.id}`)} />
        <div class="row wrap small">
          <select style="width: 240px; height: 28px" value={r.type} disabled={ro} aria-label="Type de référentiel" onchange={(e) => { const v = e.currentTarget.value as ReferentialType; update((x) => void (x.baseline.referentials[ri].type = v)); }}>
            {#each Object.entries(REFERENTIAL_TYPES) as [k, v] (k)}<option value={k}>{v}</option>{/each}
          </select>
          <span class="muted">{r.requirements.length} exigence(s) · {r.requirements.filter((q) => isGap(q.status)).length} écart(s) · {r.requirements.filter((q) => q.status === "unknown").length} non évaluée(s)</span>
          <span class="grow"></span>
          <span class="badge" style:background={color} style="color: #fff" title={st.forced ? "Indicateur forcé" : "Indicateur calculé à partir des exigences"}>
            {st.value ? BASELINE_STATUS[st.value].label : "Non évalué"}{st.forced ? " ✎" : ""}
          </span>
          <select value={r.statusForced ?? ""} disabled={ro} style="width: 200px; height: 28px" title="Forcer l'indicateur global"
            onchange={(e) => { const v = (e.currentTarget.value || null) as Referential["statusForced"]; update((x) => void (x.baseline.referentials[ri].statusForced = v)); }}>
            <option value="">Indicateur calculé</option>
            {#each Object.entries(BASELINE_STATUS) as [k, v] (k)}<option value={k}>Forcer : {v.label}</option>{/each}
          </select>
          {#if !ro}
            <select value="" style="width: 150px; height: 28px" title="Appliquer un état à toutes les exigences"
              onchange={(e) => { const v = e.currentTarget.value as RequirementStatus; e.currentTarget.value = ""; if (v) update((x) => { for (const q of x.baseline.referentials[ri].requirements) q.status = v; }); }}>
              <option value="">Tout marquer…</option>
              {#each STATUS_ORDER as k (k)}<option value={k}>{REQUIREMENT_STATUS[k].label}</option>{/each}
            </select>
            <button class="btn sm" onclick={() => importCsv(ri)} title="Importer des exigences (CSV : réf ; exigence ; rubrique ; état ; écart ; justification)"><Icon name="upload" size={13} /> CSV</button>
            <button class="btn sm" onclick={() => addRequirement(ri, r.requirements.length)}><Icon name="plus" size={13} /> Exigence</button>
            <button class="btn sm ghost icon danger" title="Supprimer le référentiel" onclick={() => confirmDelete(study, `le référentiel « ${r.name} »`, (x) => void x.baseline.referentials.splice(ri, 1))}><Icon name="trash" size={13} /></button>
          {/if}
        </div>
      </div>
    </div>
    {#if !r.collapsed}
      <div class="table-wrap auto mt">
        <table class="table">
          <thead><tr><th style="width: 80px">Réf.</th><th>Exigence</th><th style="width: 220px">État d'application</th><th style="width: 22%">Écart</th><th style="width: 24%">Justification</th><th style="width: 40px"></th></tr></thead>
          <tbody>
            {#each reqs as q (q.id)}
              {@const qi = r.requirements.indexOf(q)}
              <tr class="clickable" use:activable onclick={() => (editReq = { ri, id: q.id })}>
                <td class="mono nowrap">{q.ref}</td>
                <td>{#if q.title}{q.title}{:else}<span class="muted">Sans intitulé</span>{/if}{#if q.section}<div class="muted small">{q.section}</div>{/if}</td>
                <td onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                  <select value={q.status} disabled={ro} aria-label="État {q.ref}" style:border-left="5px solid {REQUIREMENT_STATUS[q.status].color}" onchange={(e) => { const v = e.currentTarget.value as RequirementStatus; update((x) => void (x.baseline.referentials[ri].requirements[qi].status = v)); }}>
                    {#each STATUS_ORDER as k (k)}<option value={k}>{REQUIREMENT_STATUS[k].label}</option>{/each}
                  </select>
                </td>
                <td class="small">{#if q.gap}{q.gap}{:else if isGap(q.status)}<span style="color: var(--warning)">Écart à décrire</span>{/if}</td>
                <td class="small muted">{shortText(q.justification, 140)}</td>
                <td><Icon name="edit" size={14} /></td>
              </tr>
            {/each}
            {#if reqs.length === 0}<tr><td colspan="6" class="muted center">{onlyGaps ? "Aucune exigence non respectée." : "Aucune exigence."}</td></tr>{/if}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{/each}
{#if refs.length === 0}<div class="card empty">Aucun référentiel. Ajoutez le guide d'hygiène de l'ANSSI, les exigences NIS 2, votre PSSI ou tout autre référentiel applicable.</div>{/if}

{#if editReq}<RequirementDrawer ri={editReq.ri} id={editReq.id} onClose={() => (editReq = null)} />{/if}
{#if adding}
  <Modal title="Ajouter un référentiel" onClose={() => (adding = false)}>
    <p class="muted">Bibliothèque intégrée :</p>
    {#each REFERENTIAL_LIBRARY as lib (lib.key)}
      <div class="card row between mb">
        <div><strong>{lib.name}</strong><div class="muted small">{lib.description} — {lib.requirements.length} exigences</div></div>
        <button class="btn primary sm" onclick={() => { update((x) => void x.baseline.referentials.push(instantiateReferential(lib))); adding = false; }}>Ajouter</button>
      </div>
    {/each}
    <hr />
    <div class="row">
      <button class="btn" onclick={addEmpty}><Icon name="plus" size={14} /> Référentiel vide</button>
      <button class="btn" onclick={() => download("modele-referentiel.csv", toCsv([["Réf.", "Exigence", "Rubrique", "État (appliqué / restrictions / non appliqué / N/A)", "Écart", "Justification"], ["PSSI-01", "Les comptes d'administration sont nominatifs", "Contrôle d'accès", "appliqué", "", ""]]), "text/csv")}>
        <Icon name="download" size={14} /> Modèle CSV d'import
      </button>
    </div>
  </Modal>
{/if}
