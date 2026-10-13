<script lang="ts">
  import type { Component } from "svelte";
  import Modal from "../components/Modal.svelte";
  import { Api } from "../lib/api";
  import A1Cadre from "./pages/A1Cadre.svelte";
  import A1Events from "./pages/A1Events.svelte";
  import A1Perimetre from "./pages/A1Perimetre.svelte";
  import A1Socle from "./pages/A1Socle.svelte";
  import A2Carto from "./pages/A2Carto.svelte";
  import A2Couples from "./pages/A2Couples.svelte";
  import A3Ecosysteme from "./pages/A3Ecosysteme.svelte";
  import A3Mesures from "./pages/A3Mesures.svelte";
  import A3Scenarios from "./pages/A3Scenarios.svelte";
  import A4Scenarios from "./pages/A4Scenarios.svelte";
  import A5Residuels from "./pages/A5Residuels.svelte";
  import A5Suivi from "./pages/A5Suivi.svelte";
  import A5Synthese from "./pages/A5Synthese.svelte";
  import A5Traitement from "./pages/A5Traitement.svelte";
  import Exports from "./pages/Exports.svelte";
  import Overview from "./pages/Overview.svelte";
  import Settings from "./pages/Settings.svelte";
  import Sharing from "./pages/Sharing.svelte";
  import ThreatMapPage from "./pages/ThreatMapPage.svelte";
  import Versions from "./pages/Versions.svelte";
  import { provideStudy, StudyState } from "./study.svelte";
  import StudyLayout from "./StudyLayout.svelte";

  let { id, section, version }: { id: string; section: string; version: string | null } = $props();

  const PAGES: Record<string, Component> = {
    "vue-ensemble": Overview,
    "a1-cadre": A1Cadre,
    "a1-perimetre": A1Perimetre,
    "a1-er": A1Events,
    "a1-socle": A1Socle,
    "a2-couples": A2Couples,
    "a2-carto": A2Carto,
    "a3-ecosysteme": A3Ecosysteme,
    "a3-scenarios": A3Scenarios,
    "a3-mesures": A3Mesures,
    "a4-scenarios": A4Scenarios,
    "a5-synthese": A5Synthese,
    "a5-traitement": A5Traitement,
    "a5-residuels": A5Residuels,
    "a5-suivi": A5Suivi,
    "carte-menace": ThreatMapPage,
    parametres: Settings,
    versions: Versions,
    partage: Sharing,
    exports: Exports,
  };
  const Page = $derived(PAGES[section] ?? Overview);

  // svelte-ignore state_referenced_locally
  const study = new StudyState(id, version);
  provideStudy(study);
  void study.load();

  // Maintien de la session tant que l'utilisateur est actif (l'expiration par inactivité reste effective).
  $effect(() => {
    let last = Date.now();
    const touch = () => (last = Date.now());
    const events = ["keydown", "pointerdown", "wheel"] as const;
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    const t = setInterval(() => {
      if (Date.now() - last < 4 * 60_000) void Api.me().catch(() => undefined);
    }, 4 * 60_000);
    return () => {
      clearInterval(t);
      events.forEach((ev) => window.removeEventListener(ev, touch));
      study.dispose();
    };
  });

  function beforeUnload(e: BeforeUnloadEvent) {
    if (study.hasUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = "";
    }
  }

  function onKey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || !study.data) return;
    const inField = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]");
    const k = e.key.toLowerCase();
    if (k === "s") {
      e.preventDefault();
      void study.save();
    } else if (!inField && k === "z" && !e.shiftKey) {
      e.preventDefault();
      study.undo();
    } else if (!inField && (k === "y" || (k === "z" && e.shiftKey))) {
      e.preventDefault();
      study.redo();
    }
  }
</script>

<svelte:window onbeforeunload={beforeUnload} onkeydown={onKey} />

{#if study.error}
  <div class="page"><div class="callout danger">{study.error}</div></div>
{:else if !study.data || !study.meta}
  <div class="page muted">Chargement de l'étude…</div>
{:else}
  <StudyLayout {section}>
    <Page />
  </StudyLayout>
  {#if study.pending && !study.readOnly}
    <Modal title="Modifications non enregistrées" onClose={() => study.discardPending()}>
      <p>Votre session a expiré le {new Date(study.pending.at).toLocaleString("fr-FR")} alors que des modifications n'avaient pas pu être enregistrées.</p>
      <p class="muted">Vous pouvez les restaurer maintenant ; elles seront enregistrées automatiquement (Ctrl+Z pour revenir à la version enregistrée).</p>
      {#if study.pending.rev !== study.meta.rev}<div class="callout warning small">L'étude a été modifiée par ailleurs depuis : restaurer vos modifications remplacera ces changements.</div>{/if}
      {#snippet footer()}
        <button class="btn" onclick={() => study.discardPending()}>Ignorer</button>
        <button class="btn primary" onclick={() => study.restorePending()}>Restaurer mes modifications</button>
      {/snippet}
    </Modal>
  {/if}
  {#if study.conflict}
    <Modal title="Conflit d'édition" onClose={() => (study.conflict = null)}>
      <p>{study.conflict}</p>
      <p class="muted">Rechargez pour récupérer la version enregistrée, ou écrasez-la avec vos modifications locales.</p>
      {#snippet footer()}
        <button class="btn" onclick={() => void study.resolveConflict(false)}>Recharger (abandonner mes modifications)</button>
        <button class="btn danger solid" onclick={() => void study.resolveConflict(true)}>Écraser avec ma version</button>
      {/snippet}
    </Modal>
  {/if}
{/if}
