<script lang="ts">
  import type { Snippet } from "svelte";
  import { HELP, progress } from "@beffroi/shared";
  import Icon from "../components/Icon.svelte";
  import ProgressRing from "../components/ProgressRing.svelte";
  import { auth } from "../lib/auth.svelte";
  import { link, router } from "../lib/router.svelte";
  import { chapterForSection } from "../docs/chapitres";
  import { SECTION_PROGRESS_KEY, TOOLS, WORKSHOPS, WS_COLORS, workshopOf } from "./nav";
  import ProtectionBanner from "./ProtectionBanner.svelte";
  import { useStudy } from "./study.svelte";

  let { section, children }: { section: string; children: Snippet } = $props();
  const study = useStudy();
  const SAVE_LABEL = { saved: "Enregistré", dirty: "Modifications non enregistrées", saving: "Enregistrement…", error: "Échec de l'enregistrement", conflict: "Conflit d'édition" };

  let helpOpen = $state(readHelpPref());
  let navOpen = $state(false);
  const prog = $derived(progress(study.d));
  const current = $derived(workshopOf(section));
  const help = $derived(HELP[section]);
  const vq = $derived(study.versionId ? `?version=${study.versionId}` : "");
  const to = (key: string) => `/etudes/${study.studyId}/${key}${vq}`;

  function readHelpPref() {
    try {
      const stored = localStorage.getItem("beffroi-help");
      return stored === null ? window.innerWidth >= 1700 : stored === "1";
    } catch {
      return false;
    }
  }
  $effect(() => {
    try {
      localStorage.setItem("beffroi-help", helpOpen ? "1" : "0");
    } catch {
      /* stockage indisponible */
    }
  });
  $effect(() => {
    void section;
    navOpen = false;
  });

  // Raccourcis Alt+1..5 : aller à l'atelier ; Alt+0 : vue d'ensemble.
  function onKey(e: KeyboardEvent) {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "0") { router.navigate(to("vue-ensemble")); e.preventDefault(); }
    const n = Number(e.key);
    if (n >= 1 && n <= 5) { router.navigate(to(WORKSHOPS[n - 1].items[0].key)); e.preventDefault(); }
  }

  const ratioFor = (key: string) => {
    const keys = SECTION_PROGRESS_KEY[key] ?? [];
    const items = prog.filter((p) => keys.includes(p.key));
    return items.length ? items.reduce((s, p) => s + p.ratio, 0) / items.length : 0;
  };
  const wsRatio = (n: number) => {
    const items = prog.filter((p) => p.workshop === n);
    return items.reduce((s, p) => s + p.ratio, 0) / Math.max(1, items.length);
  };
  const m = $derived(study.m);
</script>

<svelte:window onkeydown={onKey} />

<div class="app-shell" style="height: calc(100% - var(--header))">
  <ProtectionBanner mark={m.protection} />
  <div class="study-header">
    <button class="btn ghost sm icon nav-toggle" onclick={() => (navOpen = !navOpen)} title="Carte de la méthode" aria-label="Afficher la navigation"><Icon name="grid" size={15} /></button>
    <a href="/" use:link class="btn ghost sm" title="Portefeuille d'études" aria-label="Portefeuille d'études"><Icon name="left" size={14} /></a>
    <span class="title" title={m.name}>{m.name}</span>
    <span class="badge blue" title="Version de l'analyse (x.y)">v{m.major}.{m.minor}</span>
    {#if m.reference}<span class="badge outline">{m.reference}</span>{/if}
    {#if study.readOnly}<span class="badge orange"><Icon name="lock" size={12} /> {study.viewingOldVersion || m.frozen ? "Version figée" : "Lecture seule"}</span>{/if}
    <div class="method-strip" style="margin-left: 12px">
      {#each WORKSHOPS as w, i (w.n)}
        <span class="row" style="gap: 4px">
          {#if i > 0}<span class="arrow">›</span>{/if}
          <a href={to(w.items[0].key)} use:link class="step" class:current={current === w.n} class:ws-disabled={!study.d.framing.workshopsEnabled[w.n]}
            style:background={current === w.n ? WS_COLORS[w.n] : undefined} title="Atelier {w.n} — {w.label} (Alt+{w.n})">
            <span class="ws-num" style:background={current === w.n ? "rgba(255,255,255,.25)" : WS_COLORS[w.n]}>{w.n}</span>
            <span class="lbl">{w.short}</span>
          </a>
        </span>
      {/each}
    </div>
    <span style="flex: 1"></span>
    {#if !study.readOnly}
      <span class="save-state" class:dirty={study.saveState === "dirty" || study.saveState === "saving"} class:error={study.saveState === "error" || study.saveState === "conflict"}>
        <Icon name={study.saveState === "saved" ? "check" : study.saveState === "error" ? "warn" : "save"} size={13} />
        {SAVE_LABEL[study.saveState]}
      </span>
      {#if study.saveState === "error"}<button class="btn sm" onclick={() => void study.save()}>Réessayer</button>{/if}
      <button class="btn ghost icon sm" disabled={!study.canUndo} onclick={study.undo} title="Annuler (Ctrl+Z)" aria-label="Annuler"><Icon name="undo" size={15} /></button>
      <button class="btn ghost icon sm" disabled={!study.canRedo} onclick={study.redo} title="Rétablir (Ctrl+Y)" aria-label="Rétablir"><Icon name="redo" size={15} /></button>
    {/if}
    <button class="btn ghost icon sm" class:active={helpOpen} onclick={() => (helpOpen = !helpOpen)} title="Aide méthodologique" aria-label="Aide méthodologique"><Icon name="help" size={15} /></button>
  </div>
  {#if study.viewingOldVersion}
    <div class="callout warning" style="border-radius: 0">
      Vous consultez la version {m.major}.{m.minor}, figée. <a href="/etudes/{study.studyId}/{section}" use:link>Revenir à la version courante</a>
    </div>
  {/if}
  <div class="main-area">
    <nav class="sidebar" class:open={navOpen} aria-label="Carte de la méthode">
      <a href={to("vue-ensemble")} use:link class="nav-item" class:active={section === "vue-ensemble"}>
        <Icon name="home" size={15} /> <span class="grow">Vue d'ensemble</span>
      </a>
      {#each WORKSHOPS as w (w.n)}
        <div class="ws" class:current={current === w.n} class:ws-disabled={!study.d.framing.workshopsEnabled[w.n]}>
          <div class="ws-head">
            <span class="ws-num" style:background={WS_COLORS[w.n]}>{w.n}</span>
            <span class="grow">Atelier {w.n} · {w.short}</span>
            <ProgressRing ratio={wsRatio(w.n)} size={16} color={WS_COLORS[w.n]} />
          </div>
          {#each w.items as it (it.key)}
            <a href={to(it.key)} use:link class="nav-item sub" class:active={section === it.key}>
              <span class="grow">{it.label}</span>
              <ProgressRing ratio={ratioFor(it.key)} size={14} color={WS_COLORS[w.n]} />
            </a>
          {/each}
        </div>
      {/each}
      <div class="sep"></div>
      {#each TOOLS as t (t.key)}
        <a href={to(t.key)} use:link class="nav-item" class:active={section === t.key}>
          <Icon name={t.icon} size={15} /> <span class="grow">{auth.poste && t.key === "partage" ? "Propriétés" : t.label}</span>
        </a>
      {/each}
    </nav>
    <main class="page" id="study-page">{@render children()}</main>
    {#if helpOpen && help}
      <aside class="help-panel" aria-label="Aide méthodologique">
        <div class="row between"><span class="eyebrow">Aide méthodologique</span><button class="btn ghost icon sm" onclick={() => (helpOpen = false)} aria-label="Fermer l'aide"><Icon name="close" size={14} /></button></div>
        <h3 style="margin-top: 8px">{help.title}</h3>
        <p>{help.objective}</p>
        <p><strong>Participants :</strong> {help.participants}</p>
        {#if help.duration}<p><strong>Durée indicative :</strong> {help.duration}</p>{/if}
        <strong>Données de sortie</strong>
        <ul>{#each help.outputs as o (o)}<li>{o}</li>{/each}</ul>
        <strong>Conseils</strong>
        <ul>{#each help.tips as o (o)}<li>{o}</li>{/each}</ul>
        <p class="muted small">Source : {help.source}</p>
        <p><a href="/documentation/{chapterForSection(section)}" use:link class="btn sm"><Icon name="book" size={13} /> Tutoriel illustré</a></p>
        <hr />
        <p class="muted small">Raccourcis : <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>5</kbd> ateliers, <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> annuler/rétablir, <kbd>Ctrl</kbd>+<kbd>S</kbd> enregistrer.</p>
      </aside>
    {/if}
  </div>
</div>
