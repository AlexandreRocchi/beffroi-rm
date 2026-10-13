<script lang="ts">
  import { produce, type Draft } from "immer";
  import { defaultSettings, studyDataSchema, type ScaleLevel, type StudyData, type StudySettings } from "@beffroi/shared";
  import Checkbox from "../../components/Checkbox.svelte";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import NumberInput from "../../components/NumberInput.svelte";
  import Tabs from "../../components/Tabs.svelte";
  import { download, pickFile } from "../../export/csv";
  import { confirm, toast } from "../../lib/feedback.svelte";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import KnowledgeBases from "./settings/KnowledgeBases.svelte";
  import MatrixEditor from "./settings/MatrixEditor.svelte";
  import RiskLevelsEditor from "./settings/RiskLevelsEditor.svelte";
  import ScaleEditor from "./settings/ScaleEditor.svelte";

  type ScaleKey = keyof StudySettings["scales"];
  const SCALES: { key: ScaleKey; label: string; color?: boolean }[] = [
    { key: "gravity", label: "Gravité (ateliers 1 et 3)", color: true },
    { key: "likelihood", label: "Vraisemblance (ateliers 4 et 5)", color: true },
    { key: "probability", label: "Probabilité de succès d'une action élémentaire" },
    { key: "difficulty", label: "Difficulté technique d'une action élémentaire" },
    { key: "motivation", label: "Motivation de la source de risque" },
    { key: "resources", label: "Ressources de la source de risque" },
    { key: "activity", label: "Activité de la source de risque" },
    { key: "pertinence", label: "Pertinence d'un couple SR/OV", color: true },
    { key: "dependency", label: "Dépendance (partie prenante)" },
    { key: "penetration", label: "Pénétration (partie prenante)" },
    { key: "maturity", label: "Maturité cyber (partie prenante)" },
    { key: "trust", label: "Confiance (partie prenante)" },
    { key: "securityNeeds", label: "Besoins de sécurité D/I/C/T" },
  ];
  const WEIGHTS = [["dependency", "Dépendance"], ["penetration", "Pénétration"], ["maturity", "Maturité"], ["trust", "Confiance"]] as const;
  const THRESHOLDS = [["watch", "Veille"], ["control", "Contrôle"], ["danger", "Danger"]] as const;

  const study = useStudy();
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  let tab = $state<"echelles" | "matrices" | "calculs" | "bases">("echelles");
  const set = (fn: (st: Draft<StudySettings>) => void, key?: string) => study.update((x) => fn(x.settings), key);

  const exportMetrics = () =>
    download("metriques-beffroi.json", JSON.stringify({ format: "beffroi-metriques", version: 1, scaleSize: s.scaleSize, scales: s.scales, pertinenceMatrix: s.pertinenceMatrix, likelihoodCross: s.likelihoodCross, riskMatrix: s.riskMatrix, dangerosity: s.dangerosity, useActivityInPertinence: s.useActivityInPertinence, longChainThreshold: s.longChainThreshold }, null, 2), "application/json");

  async function importMetrics() {
    const f = await pickFile(".json,application/json");
    if (!f) return;
    try {
      const m = JSON.parse(await f.text());
      if (m.format !== "beffroi-metriques" || !m.scales) throw new Error("format");
      if (m.scaleSize !== s.scaleSize && !(await confirm({ title: "Taille d'échelle différente", message: `Les métriques importées utilisent des échelles à ${m.scaleSize} niveaux (étude : ${s.scaleSize}). Les cotations existantes seront conservées telles quelles.`, confirmLabel: "Importer quand même" }))) return;
      const apply = (x: Draft<StudyData>) => {
        x.settings.scaleSize = m.scaleSize;
        x.settings.scales = m.scales;
        x.settings.pertinenceMatrix = m.pertinenceMatrix ?? x.settings.pertinenceMatrix;
        x.settings.likelihoodCross = m.likelihoodCross ?? x.settings.likelihoodCross;
        x.settings.riskMatrix = m.riskMatrix ?? x.settings.riskMatrix;
        if (m.dangerosity) x.settings.dangerosity = m.dangerosity;
        if (typeof m.useActivityInPertinence === "boolean") x.settings.useActivityInPertinence = m.useActivityInPertinence;
        if (typeof m.longChainThreshold === "number") x.settings.longChainThreshold = m.longChainThreshold;
      };
      if (!studyDataSchema.safeParse(produce(study.d, apply)).success) throw new Error("schema");
      study.update(apply);
      toast("Métriques importées.", "success");
    } catch {
      toast("Fichier de métriques illisible.", "error");
    }
  }
  async function reset() {
    if (await confirm({ title: "Réinitialiser les métriques", message: "Les échelles, matrices et bases de connaissances seront remplacées par les valeurs par défaut de la méthode (les données de l'étude sont conservées).", danger: true, confirmLabel: "Réinitialiser" })) {
      study.update((x) => {
        const def = defaultSettings(x.settings.scaleSize);
        def.likelihoodMethod = x.settings.likelihoodMethod;
        def.dangerosity.thresholds = x.settings.dangerosity.thresholds;
        x.settings = def;
      });
    }
  }
</script>

<PageTitle title="Métriques et bases de connaissances" subtitle="Toutes les échelles, grilles et bases de connaissances de l'étude sont adaptables au contexte de l'organisation.">
  {#snippet actions()}
    {#if !ro}
      <button class="btn" onclick={exportMetrics}><Icon name="download" size={14} /> Exporter les métriques</button>
      <button class="btn" onclick={importMetrics}><Icon name="upload" size={14} /> Importer des métriques</button>
      <button class="btn danger" onclick={reset}>Réinitialiser</button>
    {/if}
  {/snippet}
</PageTitle>
<Tabs value={tab} onChange={(v) => (tab = v)} tabs={[
  { id: "echelles", label: "Échelles" },
  { id: "matrices", label: "Grilles de croisement" },
  { id: "calculs", label: "Règles de calcul" },
  { id: "bases", label: "Bases de connaissances" },
]} />

{#if tab === "echelles"}
  <div class="col gap-lg">
    <div class="callout small">Échelles à {s.scaleSize} niveaux. Les échelles de cotation des actions élémentaires doivent avoir autant de niveaux que l'échelle de vraisemblance (fiche 8).</div>
    <RiskLevelsEditor levels={s.scales.riskLevels} disabled={ro} onChange={(fn) => set((st) => fn(st.scales.riskLevels), "rl")} />
    <div class="grid-2">
      {#each SCALES as sc (sc.key)}
        <ScaleEditor title={sc.label} scale={s.scales[sc.key]} withColor={sc.color} disabled={ro} onChange={(fn) => set((st) => fn(st.scales[sc.key] as ScaleLevel[]), `sc-${sc.key}`)} />
      {/each}
    </div>
  </div>
{:else if tab === "matrices"}
  <div class="grid-2">
    <div class="card">
      <h3>Niveau de risque (gravité × vraisemblance)</h3>
      <MatrixEditor rows={s.scales.gravity} cols={s.scales.likelihood} rowPrefix="G" colPrefix="V" out={s.scales.riskLevels} matrix={s.riskMatrix} disabled={ro} onChange={(r, c, v) => set((st) => void (st.riskMatrix[r] = { ...st.riskMatrix[r], [c]: v }))} />
    </div>
    <div class="card">
      <h3>Pertinence SR/OV (ressources × motivation)</h3>
      <MatrixEditor rows={s.scales.resources} cols={s.scales.motivation} out={s.scales.pertinence} matrix={s.pertinenceMatrix} disabled={ro} onChange={(r, c, v) => set((st) => void (st.pertinenceMatrix[r] = { ...st.pertinenceMatrix[r], [c]: v }))} />
    </div>
    <div class="card">
      <h3>Vraisemblance (probabilité de succès × difficulté technique)</h3>
      <MatrixEditor rows={s.scales.probability} cols={s.scales.difficulty} rowPrefix="Pr" colPrefix="D" out={s.scales.likelihood} matrix={s.likelihoodCross} disabled={ro} onChange={(r, c, v) => set((st) => void (st.likelihoodCross[r] = { ...st.likelihoodCross[r], [c]: v }))} />
    </div>
  </div>
{:else if tab === "calculs"}
  <div class="grid-2">
    <div class="card col">
      <h3>Dangerosité des parties prenantes</h3>
      <p class="small muted">Formule générique : (Dépendance × Pénétration) / (Maturité × Confiance). Chaque critère peut être pondéré (exposant) ; un poids de 0 retire le critère (ex. confiance non prépondérante si la partie prenante n'est qu'un intermédiaire).</p>
      <div class="grid-4">
        {#each WEIGHTS as [k, label] (k)}
          <Field {label}><NumberInput value={s.dangerosity.weights[k]} min={0} max={5} step={0.1} disabled={ro} onChange={(v) => set((st) => void (st.dangerosity.weights[k] = v ?? 1), `w-${k}`)} /></Field>
        {/each}
      </div>
      <div class="mono small">Dangerosité = (D<sup>{s.dangerosity.weights.dependency}</sup> × P<sup>{s.dangerosity.weights.penetration}</sup>) / (M<sup>{s.dangerosity.weights.maturity}</sup> × C<sup>{s.dangerosity.weights.trust}</sup>)</div>
      <h4 class="mt">Seuils</h4>
      <div class="grid-3">
        {#each THRESHOLDS as [k, label] (k)}
          <Field {label}><NumberInput value={s.dangerosity.thresholds[k]} min={0} step={0.05} disabled={ro} onChange={(v) => set((st) => void (st.dangerosity.thresholds[k] = v ?? 0), `t-${k}`)} /></Field>
        {/each}
      </div>
    </div>
    <div class="card col">
      <h3>Pertinence et vraisemblance</h3>
      <Checkbox checked={s.useActivityInPertinence} disabled={ro} onChange={(v) => set((st) => void (st.useActivityInPertinence = v))} label="Moduler la pertinence SR/OV par l'activité de la source de risque (+1 si forte, −1 si faible)" />
      <Field label="Méthode d'évaluation de la vraisemblance">
        <select value={s.likelihoodMethod} disabled={ro} onchange={(e) => { const v = e.currentTarget.value as StudySettings["likelihoodMethod"]; set((st) => void (st.likelihoodMethod = v)); }}>
          <option value="express">Expresse</option><option value="standard">Standard</option><option value="advanced">Avancée</option>
        </select>
      </Field>
      <Field label="Correction des chaînes longues (fiche 8)" hint="Au-delà de ce nombre d'actions élémentaires en série, la probabilité cumulée est diminuée (standard) ou la difficulté augmentée (avancée) d'un niveau. 0 = désactivé.">
        <NumberInput value={s.longChainThreshold} min={0} max={100} disabled={ro} onChange={(v) => set((st) => void (st.longChainThreshold = v ?? 0), "lct")} />
      </Field>
    </div>
  </div>
{:else}
  <KnowledgeBases />
{/if}
