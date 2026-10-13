<script lang="ts">
  import Checkbox from "../../components/Checkbox.svelte";
  import Icon from "../../components/Icon.svelte";
  import { download, safeFilename } from "../../export/csv";
  import { Api } from "../../lib/api";
  import { toast } from "../../lib/feedback.svelte";
  import { WORKSHOPS } from "../nav";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  const study = useStudy();
  const id = study.studyId;
  const meta = $derived(study.m);
  let ws = $state<number[]>([1, 2, 3, 4, 5]);
  let busy = $state<string | null>(null);
  const base = $derived(`${safeFilename(meta.name)}_v${meta.major}.${meta.minor}_${meta.protection}`);
  const scope = $derived(ws.map((w) => `A${w}`).join(","));

  async function run(label: string, fn: () => Promise<void>) {
    busy = label;
    try {
      await fn();
      toast("Export généré.", "success");
    } catch (e) {
      toast(`Échec de l'export : ${(e as Error).message}`, "error");
    } finally {
      busy = null;
    }
  }
  const pdf = () =>
    run("pdf", async () => {
      const { exportPdf } = await import("../../export/pdf");
      const blob = await exportPdf(study.m, study.d, ws, (m) => (busy = `pdf:${m}`));
      download(`${base}_rapport.pdf`, blob, "application/pdf");
      void Api.logExport(id, "pdf", scope);
    });
  const docx = () =>
    run("docx", async () => {
      const { exportWord } = await import("../../export/docx");
      const blob = await exportWord(study.m, study.d, ws, (m) => (busy = `docx:${m}`));
      download(`${base}_rapport.docx`, blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      void Api.logExport(id, "docx", scope);
    });
  const xlsx = () =>
    run("xlsx", async () => {
      const { exportExcel } = await import("../../export/xlsx");
      const buf = await exportExcel(study.m, study.d, ws);
      download(`${base}.xlsx`, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      void Api.logExport(id, "xlsx", scope);
    });
  const json = () =>
    run("json", async () => {
      const m = study.m;
      const payload = { format: "beffroi", version: 1, exportedAt: new Date().toISOString(), meta: { name: m.name, reference: m.reference, organisation: m.organisation, protection: m.protection, version: `${m.major}.${m.minor}` }, data: study.d };
      download(`${base}.json`, JSON.stringify(payload, null, 2), "application/json");
      void Api.logExport(id, "json", "complet");
    });
  const label = (kind: string, idle: string) => (busy?.startsWith(kind) ? busy.replace(new RegExp(`^${kind}:?`), "") || "Génération…" : idle);
</script>

<PageTitle title="Exports et livrables" subtitle="Livrables par atelier ou complets. Les fichiers exportés ne sont pas chiffrés : protégez-les conformément à leur mention de protection." />
<div class="callout warning mb-lg">Mention de protection de l'analyse : <strong>{meta.protection}</strong> — elle figure dans l'en-tête et le pied de page de chaque livrable.</div>
<div class="card mb-lg">
  <h3>Périmètre de l'export</h3>
  <div class="row wrap">
    {#each WORKSHOPS as w (w.n)}
      <Checkbox checked={ws.includes(w.n)} onChange={(v) => (ws = v ? [...ws, w.n].sort() : ws.filter((x) => x !== w.n))} label="Atelier {w.n} · {w.short}" />
    {/each}
  </div>
</div>
<div class="grid-2">
  <div class="card col">
    <h3><Icon name="file" size={16} /> Rapport PDF</h3>
    <p class="small muted">Rapport d'analyse figé, prêt à diffuser ou à archiver : même contenu que le rapport Word, police et visuels embarqués, mention de protection sur chaque page.</p>
    <button class="btn primary" disabled={!!busy || !ws.length} onclick={pdf}>{label("pdf", "Générer le rapport (.pdf)")}</button>
  </div>
  <div class="card col">
    <h3><Icon name="file" size={16} /> Rapport Word</h3>
    <p class="small muted">Rapport d'analyse structuré par atelier, avec tableaux et visuels (cartographies, radars, scénarios stratégiques, graphes d'attaque, matrices de risque, fiches de risques résiduels), modifiable.</p>
    <button class="btn primary" disabled={!!busy || !ws.length} onclick={docx}>{label("docx", "Générer le rapport (.docx)")}</button>
  </div>
  <div class="card col">
    <h3><Icon name="grid" size={16} /> Classeur Excel</h3>
    <p class="small muted">Un onglet par activité (cadre, périmètre, ER, socle, couples SR/OV, parties prenantes, scénarios, actions élémentaires, risques, plan de traitement, risques résiduels, couverture, suivi, métriques), avec filtres.</p>
    <button class="btn primary" disabled={!!busy || !ws.length} onclick={xlsx}>{busy === "xlsx" ? "Génération…" : "Exporter (.xlsx)"}</button>
  </div>
  <div class="card col">
    <h3><Icon name="download" size={16} /> Fichier d'échange JSON</h3>
    <p class="small muted">Export complet et ré-importable (toutes les données, métriques et bases de connaissances) : sauvegarde, transfert vers une autre instance, archivage.</p>
    <button class="btn primary" disabled={!!busy} onclick={json}>Exporter (.json)</button>
  </div>
</div>
<div class="card mt-lg">
  <h3>Imports</h3>
  <ul class="small">
    <li>Étude complète (JSON) : depuis le portefeuille, bouton « Importer ».</li>
    <li>Valeurs métier et biens supports (CSV) : atelier 1, « Périmètre métier et technique ».</li>
    <li>Exigences d'un référentiel (CSV) : atelier 1, « Socle de sécurité ».</li>
    <li>Bases de connaissances (catégories de sources de risque, d'objectifs, de parties prenantes, actions élémentaires, aide à la cotation) : « Métriques et référentiels » › « Bases de connaissances ».</li>
  </ul>
</div>
