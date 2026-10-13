<script lang="ts">
  import { PROTECTION_MARKS } from "@beffroi/shared";
  import Empty from "../components/Empty.svelte";
  import Icon from "../components/Icon.svelte";
  import SearchBox from "../components/SearchBox.svelte";
  import { activable } from "../lib/actions";
  import { Api, type StudyListItem } from "../lib/api";
  import { auth } from "../lib/auth.svelte";
  import { confirm, toast } from "../lib/feedback.svelte";
  import { matches } from "../lib/levels";
  import { router } from "../lib/router.svelte";
  import { fmtDateTime } from "../study/helpers";
  import { WS_COLORS } from "../study/nav";
  import CreateStudyModal from "./CreateStudyModal.svelte";
  import RiskBar from "./RiskBar.svelte";

  let studies = $state.raw<StudyListItem[] | null>(null);
  let q = $state("");
  let creating = $state<null | "new" | "import">(null);

  const load = () => Api.studies().then((s) => (studies = s)).catch((e) => toast(e.message, "error"));
  void load();

  const filtered = $derived((studies ?? []).filter((s) => matches(q, s.name, s.reference, s.organisation, s.ownerName)));
  const totals = $derived.by(() => {
    const t = { studies: studies?.length ?? 0, high: 0, highResidual: 0, measures: 0, done: 0 };
    for (const s of studies ?? []) {
      t.high += s.stats.risks?.["3"] ?? 0;
      t.highResidual += s.stats.residual?.["3"] ?? 0;
      t.measures += s.stats.measures?.total ?? 0;
      t.done += s.stats.measures?.done ?? 0;
    }
    return t;
  });

  async function duplicate(s: StudyListItem) {
    await Api.duplicateStudy(s.id);
    toast("Étude dupliquée.", "success");
    void load();
  }

  async function remove(s: StudyListItem) {
    if (await confirm({ title: "Supprimer l'étude", message: `L'étude « ${s.name} » et toutes ses versions seront définitivement supprimées.`, confirmLabel: "Supprimer", danger: true })) {
      await Api.deleteStudy(s.id);
      toast("Étude supprimée.");
      void load();
    }
  }
</script>

<div class="page narrow">
  <div class="section-title">
    <div>
      <div class="eyebrow">Portefeuille</div>
      <h1>Mes analyses de risques</h1>
      <div class="subtitle">Études EBIOS Risk Manager auxquelles vous avez accès.</div>
    </div>
    <div class="row wrap">
      <SearchBox value={q} onChange={(v) => (q = v)} placeholder="Rechercher une étude…" />
      {#if auth.user?.canCreate}
        <button class="btn" onclick={() => (creating = "import")}><Icon name="upload" size={14} /> Importer</button>
        <button class="btn primary" onclick={() => (creating = "new")}><Icon name="plus" size={14} /> Nouvelle étude</button>
      {/if}
    </div>
  </div>

  {#if studies && studies.length > 0}
    <div class="grid-4 mb-lg">
      <div class="card kpi"><div class="v">{totals.studies}</div><div class="l">études accessibles</div></div>
      <div class="card kpi"><div class="v" style="color: #e53935">{totals.high}</div><div class="l">risques initiaux élevés</div></div>
      <div class="card kpi"><div class="v" style:color={totals.highResidual ? "#e53935" : "#2e7d32"}>{totals.highResidual}</div><div class="l">risques résiduels élevés</div></div>
      <div class="card kpi"><div class="v">{totals.done}/{totals.measures}</div><div class="l">mesures terminées</div></div>
    </div>
  {/if}

  {#if studies === null}
    <div class="muted">Chargement…</div>
  {:else if filtered.length === 0}
    <div class="card">
      <Empty title={studies.length ? "Aucune étude ne correspond" : "Aucune étude pour le moment"}>
        {auth.user?.canCreate ? "Créez une étude vide, partez de l'exemple du guide ANSSI (société de biotechnologie) ou importez un fichier." : "Demandez à un propriétaire d'étude de vous en donner l'accès."}
      </Empty>
    </div>
  {:else}
    <div class="grid-3">
      {#each filtered as s (s.id)}
        {@const mark = PROTECTION_MARKS.find((m) => m.id === s.protection)}
        <div class="card study-card" role="link" tabindex="0" use:activable onclick={() => router.navigate(`/etudes/${s.id}/vue-ensemble`)}>
          <div class="row between top">
            <div class="grow">
              <div style="font-weight: 700; font-size: 15px">{s.name}</div>
              <div class="muted small">{[s.reference, s.organisation].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <span class="badge" style:background={mark?.color} style="color: #fff">{mark?.label}</span>
          </div>
          <div class="row wrap small">
            <span class="badge blue">v{s.major}.{s.minor}</span>
            {#if !auth.poste}
              <span class="badge outline">{s.access === "owner" ? "Propriétaire" : s.access === "write" ? "Écriture" : "Lecture"}</span>
              <span class="muted">par {s.ownerName}</span>
            {/if}
          </div>
          <RiskBar counts={s.stats.risks ?? {}} />
          <div>
            <div class="small muted" style="margin-bottom: 3px">Avancement des ateliers</div>
            <div class="ws-bars">
              {#each [1, 2, 3, 4, 5] as w (w)}
                <div class="b" title="Atelier {w} : {s.stats.progress?.[w] ?? 0} %"><div style="width: {s.stats.progress?.[w] ?? 0}%; background: {WS_COLORS[w]}"></div></div>
              {/each}
            </div>
          </div>
          <div class="row between">
            <span class="muted small">Modifiée le {fmtDateTime(s.updatedAt)}</span>
            <div class="row" onclick={(e) => e.stopPropagation()}>
              {#if auth.user?.canCreate}
                <button class="btn ghost sm icon" title="Dupliquer" aria-label="Dupliquer" onclick={() => duplicate(s)}><Icon name="copy" size={14} /></button>
              {/if}
              {#if s.access === "owner"}
                <button class="btn ghost sm icon danger" title="Supprimer" aria-label="Supprimer" onclick={() => remove(s)}><Icon name="trash" size={14} /></button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
  {#if creating}
    {@const mode = creating}
    <CreateStudyModal {mode} onClose={() => (creating = null)} onCreated={(id) => router.navigate(`/etudes/${id}/${mode === "new" ? "a1-cadre" : "vue-ensemble"}`)} />
  {/if}
</div>
