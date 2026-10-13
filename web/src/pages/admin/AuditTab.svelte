<script lang="ts">
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import { api } from "../../lib/api";
  import { confirm, toast } from "../../lib/feedback.svelte";
  import { fmtDateTime } from "../../study/helpers";
  import { ACTION_LABELS, type AuditRow } from "./types";

  let rows = $state.raw<AuditRow[]>([]);
  let total = $state(0);
  let filter = $state({ action: "", user: "", from: "", to: "" });
  let page = $state(0);
  let verify = $state<{ ok: boolean; checked: number; brokenAt: number | null } | null>(null);
  const qs = () =>
    new URLSearchParams(Object.entries({ ...filter, from: filter.from ? `${filter.from}T00:00:00` : "", to: filter.to ? `${filter.to}T23:59:59` : "" }).filter(([, v]) => v)).toString();
  function load() {
    api<{ total: number; rows: AuditRow[] }>("GET", `/api/admin/audit?${qs()}&limit=100&offset=${page * 100}`)
      .then((r) => {
        rows = r.rows;
        total = r.total;
      })
      .catch((e) => toast(e.message, "error"));
  }
  $effect(() => {
    void page;
    load();
  });

  async function purge() {
    const before = new Date(Date.now() - 366 * 24 * 3600_000).toISOString();
    if (await confirm({ title: "Purger le journal", message: "Les entrées de plus d'un an seront supprimées. Cette opération est elle-même journalisée.", danger: true, confirmLabel: "Purger" })) {
      const r = await api<{ deleted: number }>("POST", "/api/admin/audit/purge", { before });
      toast(`${r.deleted} entrée(s) purgée(s).`);
      load();
    }
  }
  const tone = (a: string) => (a.includes("failure") || a.includes("denied") || a.includes("lockout") ? "red" : a.startsWith("study") ? "blue" : "");
</script>

<div class="card mb">
  <div class="row wrap">
    <Field label="Action">
      <select bind:value={filter.action}>
        <option value="">Toutes</option>
        {#each ["auth.", "user.", "group.", "study.", "access.", "audit.", "app."] as p (p)}<option value={p}>{p.replace(".", "")}</option>{/each}
      </select>
    </Field>
    <Field label="Utilisateur"><input type="text" bind:value={filter.user} /></Field>
    <Field label="Du"><input type="date" bind:value={filter.from} /></Field>
    <Field label="Au"><input type="date" bind:value={filter.to} /></Field>
    <div class="row" style="align-self: flex-end">
      <button class="btn primary" onclick={() => { page = 0; load(); }}>Filtrer</button>
      <a class="btn" href="/api/admin/audit/export?{qs()}"><Icon name="download" size={14} /> CSV</a>
      <button class="btn" onclick={async () => (verify = await api("GET", "/api/admin/audit/verify"))}><Icon name="shield" size={14} /> Vérifier l'intégrité</button>
      <button class="btn danger" onclick={purge}>Purger (&gt; 1 an)</button>
    </div>
  </div>
  {#if verify}
    <div class="callout {verify.ok ? 'success' : 'danger'} mt">
      {verify.ok ? `Chaîne d'intégrité valide (${verify.checked} entrées vérifiées).` : `Rupture de la chaîne d'intégrité détectée à l'entrée n° ${verify.brokenAt} : le journal a été altéré.`}
    </div>
  {/if}
</div>
<div class="table-wrap">
  <table class="table">
    <thead><tr><th>N°</th><th>Horodatage</th><th>Utilisateur</th><th>IP</th><th>Action</th><th>Cible</th><th>Détails</th></tr></thead>
    <tbody>
      {#each rows as r (r.seq)}
        <tr>
          <td class="mono">{r.seq}</td>
          <td class="nowrap">{fmtDateTime(r.ts)}</td>
          <td>{#if r.username}{r.username}{:else}<span class="muted">—</span>{/if}</td>
          <td class="mono">{r.ip}</td>
          <td><span class="badge {tone(r.action)}">{ACTION_LABELS[r.action] ?? r.action}</span></td>
          <td class="mono small">{r.target_type}{r.target_id ? `:${r.target_id.slice(0, 8)}` : ""}</td>
          <td class="mono small" style="max-width: 380px; word-break: break-all">{r.details}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
<div class="row between mt">
  <span class="muted small">{total} entrée(s)</span>
  <div class="row">
    <button class="btn sm" disabled={page === 0} onclick={() => page--}>Précédent</button>
    <span class="small">Page {page + 1} / {Math.max(1, Math.ceil(total / 100))}</span>
    <button class="btn sm" disabled={(page + 1) * 100 >= total} onclick={() => page++}>Suivant</button>
  </div>
</div>
