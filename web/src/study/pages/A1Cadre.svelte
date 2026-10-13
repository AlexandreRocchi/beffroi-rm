<script lang="ts">
  import { PURPOSES, uid, type RaciValue } from "@beffroi/shared";
  import Checkbox from "../../components/Checkbox.svelte";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import NumberInput from "../../components/NumberInput.svelte";
  import RichText from "../../components/RichText.svelte";
  import { WORKSHOPS, WS_COLORS } from "../nav";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  const ROLES = ["Direction", "Métier", "RSSI", "DSI", "Spécialiste Threat Intel", "Architecte fonctionnel", "Architecte technique", "Achats / Juridique", "Animateur", "Autre"];
  const study = useStudy();
  const update = study.update;
  const f = $derived(study.d.framing);
  const ro = $derived(study.readOnly);
  const meetings = $derived([...f.meetings].sort((a, b) => a.date.localeCompare(b.date)));

  function setPurpose(v: string) {
    update((d) => {
      d.framing.purpose = v as typeof d.framing.purpose;
      const ws = PURPOSES.find((p) => p.id === v)?.workshops ?? [1, 2, 3, 4, 5];
      for (const n of [1, 2, 3, 4, 5] as const) d.framing.workshopsEnabled[n] = ws.includes(n) || n === 1;
    });
  }
</script>

<PageTitle ws={1} title="Cadre de l'étude" subtitle="Objectifs, participants et responsabilités, cadre temporel, hypothèses et contraintes." />

<div class="grid-2 mb-lg">
  <div class="card col gap-lg">
    <Field label="Objet de l'étude" hint="Organisation, système d'information ou produit faisant l'objet de l'appréciation des risques.">
      <input type="text" value={f.subject} disabled={ro} maxlength="2000" oninput={(e) => update((d) => void (d.framing.subject = e.currentTarget.value), "subject")} />
    </Field>
    <Field label="Finalité de l'étude" hint="Détermine les ateliers principaux à conduire (grille des usages, guide p.14).">
      <select value={f.purpose} disabled={ro} onchange={(e) => setPurpose(e.currentTarget.value)}>
        {#each PURPOSES as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
      </select>
    </Field>
    <Field label="Ateliers conduits">
      <div class="row wrap">
        {#each WORKSHOPS as w (w.n)}
          <Checkbox disabled={ro || w.n === 1} checked={f.workshopsEnabled[w.n]} onChange={(v) => update((d) => void (d.framing.workshopsEnabled[w.n] = v))}>
            {#snippet label()}<span style="color: {WS_COLORS[w.n]}; font-weight: 600">A{w.n} · {w.short}</span>{/snippet}
          </Checkbox>
        {/each}
      </div>
      {#if !f.workshopsEnabled[4]}<div class="hint">Sans atelier 4, la vraisemblance des scénarios de risque est déduite de la pertinence des couples SR/OV (étude préliminaire).</div>{/if}
    </Field>
    <Field label="Objectifs de l'étude">
      <RichText value={f.objectives} disabled={ro} onChange={(v) => update((d) => void (d.framing.objectives = v), "objectives")} placeholder="Ex. homologation du système, mise en place d'un processus de management du risque, niveau de sécurité à atteindre pour une certification…" />
    </Field>
  </div>
  <div class="card col gap-lg">
    <div class="grid-2">
      <Field label="Cycle stratégique (mois)" hint="Revue complète de l'étude (souvent 36 mois pour une homologation).">
        <NumberInput value={f.strategicCycleMonths} min={0} max={600} disabled={ro} onChange={(v) => update((d) => void (d.framing.strategicCycleMonths = v ?? 0), "scm")} />
      </Field>
      <Field label="Cycle opérationnel (mois)" hint="Revue des scénarios opérationnels (souvent 12 mois).">
        <NumberInput value={f.operationalCycleMonths} min={0} max={600} disabled={ro} onChange={(v) => update((d) => void (d.framing.operationalCycleMonths = v ?? 0), "ocm")} />
      </Field>
    </div>
    <Field label="Responsable de l'acceptation des risques résiduels" hint="Indispensable dès l'atelier 1 (guide p.19).">
      <select value={f.riskOwnerId ?? ""} disabled={ro} onchange={(e) => update((d) => void (d.framing.riskOwnerId = e.currentTarget.value || null))}>
        <option value="">— À désigner —</option>
        {#each f.participants as p (p.id)}<option value={p.id}>{p.name} ({p.role})</option>{/each}
      </select>
    </Field>
    <Field label="Hypothèses">
      <RichText value={f.assumptions} disabled={ro} onChange={(v) => update((d) => void (d.framing.assumptions = v), "assumptions")} />
    </Field>
    <Field label="Contraintes">
      <RichText value={f.constraints} disabled={ro} onChange={(v) => update((d) => void (d.framing.constraints = v), "constraints")} />
    </Field>
  </div>
</div>

<div class="card mb-lg">
  <div class="card-title">
    <h3>Participants et matrice RACI</h3>
    {#if !ro}
      <button class="btn sm" onclick={() => update((d) => void d.framing.participants.push({ id: uid(), name: "", role: "RSSI", organisation: "" }))}><Icon name="plus" size={13} /> Participant</button>
    {/if}
  </div>
  <p class="muted small">R : réalise · A : approuve · C : consulté · I : informé.</p>
  <div class="table-wrap auto">
    <table class="table">
      <thead>
        <tr>
          <th>Nom</th><th>Rôle</th><th>Organisation</th>
          {#each WORKSHOPS as w (w.n)}<th class="num" style:color={WS_COLORS[w.n]}>A{w.n}</th>{/each}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each f.participants as p, i (p.id)}
          <tr>
            <td><input type="text" class="inline-input" value={p.name} disabled={ro} placeholder="Nom" aria-label="Nom" oninput={(e) => update((d) => void (d.framing.participants[i].name = e.currentTarget.value), `pn-${p.id}`)} /></td>
            <td><input type="text" class="inline-input" list="roles" value={p.role} disabled={ro} aria-label="Rôle" oninput={(e) => update((d) => void (d.framing.participants[i].role = e.currentTarget.value), `pr-${p.id}`)} /></td>
            <td><input type="text" class="inline-input" value={p.organisation} disabled={ro} aria-label="Organisation" oninput={(e) => update((d) => void (d.framing.participants[i].organisation = e.currentTarget.value), `po-${p.id}`)} /></td>
            {#each WORKSHOPS as w (w.n)}
              <td class="num">
                <select class="inline-input" style="width: 52px; font-weight: 700" disabled={ro} value={f.raci[String(w.n)]?.[p.id] ?? ""} aria-label="RACI atelier {w.n}"
                  onchange={(e) => { const v = e.currentTarget.value as RaciValue; update((d) => { d.framing.raci[String(w.n)] ??= {}; d.framing.raci[String(w.n)][p.id] = v; }); }}>
                  {#each ["", "R", "A", "C", "I"] as v (v)}<option value={v}>{v || "·"}</option>{/each}
                </select>
              </td>
            {/each}
            <td>{#if !ro}<button class="btn ghost sm icon" title="Retirer" aria-label="Retirer" onclick={() => update((d) => void d.framing.participants.splice(i, 1))}><Icon name="trash" size={13} /></button>{/if}</td>
          </tr>
        {/each}
        {#if f.participants.length === 0}<tr><td colspan="9" class="muted center">Aucun participant.</td></tr>{/if}
      </tbody>
    </table>
  </div>
  <datalist id="roles">{#each ROLES as r (r)}<option value={r}></option>{/each}</datalist>
</div>

<div class="card">
  <div class="card-title">
    <h3>Planning des ateliers</h3>
    {#if !ro}<button class="btn sm" onclick={() => update((d) => void d.framing.meetings.push({ id: uid(), workshop: 1, date: "", title: "", notes: "" }))}><Icon name="plus" size={13} /> Séance</button>{/if}
  </div>
  <div class="table-wrap auto">
    <table class="table">
      <thead><tr><th style="width: 110px">Atelier</th><th style="width: 160px">Date</th><th>Intitulé</th><th>Notes</th><th></th></tr></thead>
      <tbody>
        {#each meetings as m (m.id)}
          {@const i = f.meetings.findIndex((x) => x.id === m.id)}
          <tr>
            <td>
              <select class="inline-input" disabled={ro} value={m.workshop} aria-label="Atelier" onchange={(e) => { const v = Number(e.currentTarget.value); update((d) => void (d.framing.meetings[i].workshop = v)); }}>
                {#each [0, 1, 2, 3, 4, 5] as n (n)}<option value={n}>{n === 0 ? "Autre" : `Atelier ${n}`}</option>{/each}
              </select>
            </td>
            <td><input type="date" class="inline-input" disabled={ro} value={m.date} aria-label="Date" onchange={(e) => { const v = e.currentTarget.value; update((d) => void (d.framing.meetings[i].date = v)); }} /></td>
            <td><input type="text" class="inline-input" disabled={ro} value={m.title} aria-label="Intitulé" oninput={(e) => update((d) => void (d.framing.meetings[i].title = e.currentTarget.value), `mt-${m.id}`)} /></td>
            <td><input type="text" class="inline-input" disabled={ro} value={m.notes} aria-label="Notes" oninput={(e) => update((d) => void (d.framing.meetings[i].notes = e.currentTarget.value), `mn-${m.id}`)} /></td>
            <td>{#if !ro}<button class="btn ghost sm icon" aria-label="Retirer" onclick={() => update((d) => void d.framing.meetings.splice(i, 1))}><Icon name="trash" size={13} /></button>{/if}</td>
          </tr>
        {/each}
        {#if f.meetings.length === 0}<tr><td colspan="5" class="muted center">Aucune séance planifiée.</td></tr>{/if}
      </tbody>
    </table>
  </div>
</div>
