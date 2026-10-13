<script lang="ts">
  import { importAnssiTemplate, PROTECTION_MARKS, workbookToGrid, type ImportReport } from "@beffroi/shared";
  import Field from "../components/Field.svelte";
  import Icon from "../components/Icon.svelte";
  import Modal from "../components/Modal.svelte";
  import { Api } from "../lib/api";
  import { toast } from "../lib/feedback.svelte";

  let { mode, onClose, onCreated }: { mode: "new" | "import"; onClose: () => void; onCreated: (id: string) => void } = $props();
  let name = $state("");
  let reference = $state("");
  let organisation = $state("");
  let protection = $state("");
  let scaleSize = $state<4 | 5>(4);
  let template = $state<"empty" | "example">("empty");
  let file = $state.raw<{ data: unknown; name: string; report?: ImportReport } | null>(null);
  let error = $state<string | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();
  const counts = $derived(file?.report ? Object.entries(file.report.counts).filter(([, n]) => n > 0) : []);

  async function readFile(f: File) {
    if (/\.xlsx$/i.test(f.name)) return readTemplate(f);
    try {
      const json = JSON.parse(await f.text());
      const data = json.format === "beffroi" ? json.data : json;
      if (json.meta) {
        name = json.meta.name ?? "";
        reference = json.meta.reference ?? "";
        organisation = json.meta.organisation ?? "";
        protection = json.meta.protection ?? "";
      }
      file = { data, name: f.name };
      error = null;
    } catch {
      error = "Fichier illisible : un export JSON de Beffroi RM ou le modèle Excel de l'ANSSI est attendu.";
    }
  }

  // Modèle de tableur « EBIOS RM – Ateliers » publié par l'ANSSI.
  async function readTemplate(f: File) {
    file = null;
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const { data, report } = importAnssiTemplate(workbookToGrid(wb));
      file = { data, name: f.name, report };
      name = name || f.name.replace(/\.xlsx$/i, "");
      error = null;
    } catch (e) {
      error = `Classeur illisible : ${(e as Error).message}`;
    }
  }

  async function submit() {
    error = null;
    try {
      const r =
        mode === "import"
          ? await Api.importStudy({ name, reference, organisation, protection, data: file?.data })
          : await Api.createStudy({ name, reference, organisation, protection, scaleSize, template });
      toast("Étude créée.", "success");
      onCreated(r.id);
    } catch (e) {
      error = (e as Error).message;
    }
  }
</script>

<Modal title={mode === "import" ? "Importer une étude" : "Nouvelle étude"} {onClose}>
  {#if mode === "import"}
    <Field label="Fichier" required hint="Export JSON complet de Beffroi RM, ou modèle Excel « EBIOS RM – Ateliers » de l'ANSSI (.xlsx) complété.">
      <div class="row">
        <button class="btn" onclick={() => fileInput?.click()}><Icon name="upload" size={14} /> Choisir un fichier</button>
        <span class="muted small">{file?.name ?? "Aucun fichier"}</span>
        <input bind:this={fileInput} type="file" accept="application/json,.json,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onchange={(e) => e.currentTarget.files?.[0] && readFile(e.currentTarget.files[0])} />
      </div>
    </Field>
  {/if}
  {#if file?.report}
    {@const report = file.report}
    <div class="callout small" data-testid="import-report">
      <strong>Reprise du modèle ANSSI</strong>
      {#if counts.length}<p style="margin: 4px 0">{counts.map(([k, n]) => `${n} ${k}`).join(" · ")}</p>{/if}
      {#if report.warnings.length > 0}
        <details open={report.warnings.length <= 4}>
          <summary>{report.warnings.length} point{report.warnings.length > 1 ? "s" : ""} d'attention</summary>
          <ul style="margin: 4px 0 0; padding-left: 18px">{#each report.warnings as w, i (i)}<li>{w}</li>{/each}</ul>
        </details>
      {/if}
      <p class="muted" style="margin: 4px 0 0">La vraisemblance est importée en méthode expresse ; les graphes d'attaque et séquences d'événements restent à construire dans l'outil.</p>
    </div>
  {/if}
  <Field label="Nom de l'étude" required>
    <!-- svelte-ignore a11y_autofocus -->
    <input type="text" bind:value={name} autofocus maxlength="300" />
  </Field>
  <div class="grid-2">
    <Field label="Référence"><input type="text" bind:value={reference} maxlength="100" /></Field>
    <Field label="Organisation"><input type="text" bind:value={organisation} maxlength="300" /></Field>
  </div>
  <Field label="Mention de protection" required hint="Obligatoire : elle figure sur chaque écran et chaque livrable de l'analyse.">
    <select bind:value={protection}>
      <option value="">Choisir…</option>
      {#each PROTECTION_MARKS as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
    </select>
  </Field>
  {#if mode === "new"}
    <Field label="Point de départ">
      <label class="checkbox"><input type="radio" bind:group={template} value="empty" /> Étude vide</label>
      <label class="checkbox"><input type="radio" bind:group={template} value="example" /> Exemple du guide ANSSI (société de biotechnologie fabriquant des vaccins)</label>
    </Field>
    {#if template === "empty"}
      <Field label="Échelles de cotation" hint="5 niveaux si des impacts sectoriels ou régaliens sont à mesurer (fiche méthode 3), sinon 4.">
        <select value={scaleSize} onchange={(e) => (scaleSize = Number(e.currentTarget.value) as 4 | 5)}>
          <option value={4}>4 niveaux (G1–G4, V1–V4)</option>
          <option value={5}>5 niveaux (G1–G5, V0–V4)</option>
        </select>
      </Field>
    {/if}
  {/if}
  {#if error}<div class="callout danger">{error}</div>{/if}
  {#snippet footer()}
    <button class="btn" onclick={onClose}>Annuler</button>
    <button class="btn primary" disabled={!name.trim() || !protection || (mode === "import" && !file)} onclick={submit}>{mode === "import" ? "Importer" : "Créer l'étude"}</button>
  {/snippet}
</Modal>
