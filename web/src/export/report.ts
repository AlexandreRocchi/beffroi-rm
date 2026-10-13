/**
 * Contenu du rapport d'analyse, indépendant du format de sortie.
 * Le contenu est écrit une seule fois ; chaque format (Word, PDF) fournit un ReportWriter.
 */
import {
  COST_LABELS,
  CRITERIA_LABELS,
  coverage,
  ECOSYSTEM_RECOMMENDATIONS,
  evaluateStakeholder,
  levelLabel,
  MEASURE_CATEGORY,
  MEASURE_STATUS,
  operationalLikelihood,
  pertinence,
  PROTECTION_MARKS,
  PURPOSES,
  referentialStatus,
  REQUIREMENT_STATUS,
  riskLevelDef,
  riskRows,
  srovGravity,
  strategicGravity,
  stripHtml,
  TREATMENT,
  ZONE_LABELS,
  BASELINE_STATUS,
  type StudyData,
  type StudyMeta,
} from "@beffroi/shared";
import type { Component } from "svelte";
import Kiviat from "../charts/Kiviat.svelte";
import PerimeterMap from "../charts/PerimeterMap.svelte";
import RiskMatrix from "../charts/RiskMatrix.svelte";
import SrovRadar from "../charts/SrovRadar.svelte";
import StackedBars from "../charts/StackedBars.svelte";
import StakeholderRadar from "../charts/StakeholderRadar.svelte";
import StaticAttackGraph from "../charts/StaticAttackGraph.svelte";
import StrategicDiagram from "../charts/StrategicDiagram.svelte";
import ThreatMap from "../charts/ThreatMap.svelte";
import LogoMark from "../components/LogoMark.svelte";
import { renderPng, type Png } from "./raster";

export type Cell = string | number | null | undefined;

export interface Cover {
  logo: Png | null;
  title: string;
  subject: string;
  version: string;
  date: string;
  reference: string;
  organisation: string;
  protectionLabel: string;
  /** Couleur de la mention de protection, au format #rrggbb. */
  protectionColor: string;
}

export interface ReportWriter {
  cover(c: Cover): void;
  /** Titre ; le niveau 1 commence une nouvelle page. */
  h(text: string, level?: 1 | 2 | 3): void;
  p(text: string, opts?: { italics?: boolean; bold?: boolean }): void;
  kv(key: string, value: string): void;
  /** `widths` : largeurs relatives des colonnes. */
  table(headers: string[], rows: Cell[][], widths?: number[]): void;
  /** `maxW` : largeur maximale en pixels à 96 dpi (page utile ≈ 660 px). */
  image(png: Png, maxW: number, caption?: string): void;
}

export async function buildReport(w: ReportWriter, meta: StudyMeta, d: StudyData, workshops: number[], onProgress?: (msg: string) => void): Promise<void> {
  const s = d.settings;
  const mark = PROTECTION_MARKS.find((m) => m.id === meta.protection);
  const lv = (scale: Parameters<typeof levelLabel>[0], v: number | null | undefined) => (v === null || v === undefined ? "—" : levelLabel(scale, v));
  const h = (text: string, level: 1 | 2 | 3 = 1) => w.h(text, level);
  const p = (text: string, opts: { italics?: boolean; bold?: boolean } = {}) => w.p(text, opts);
  const kv = (k: string, v: string) => w.kv(k, v);
  const table = (headers: string[], rows: Cell[][], widths?: number[]) => w.table(headers, rows, widths);
  const image = async <P extends Record<string, unknown>>(component: Component<P>, props: P, maxW = 620, caption?: string) => {
    const png = await renderPng(component, props, 1600);
    if (png) w.image(png, maxW, caption);
  };

  w.cover({
    logo: await renderPng(LogoMark, { size: null }, 192),
    title: meta.name,
    subject: d.framing.subject,
    version: `${meta.major}.${meta.minor}`,
    date: new Date().toLocaleDateString("fr-FR"),
    reference: meta.reference,
    organisation: meta.organisation,
    protectionLabel: mark?.label ?? meta.protection,
    protectionColor: mark?.color ?? "#555555",
  });

  // Synthèse.
  onProgress?.("Synthèse…");
  const rows = riskRows(d);
  const active = rows.filter((r) => r.active);
  h("Synthèse");
  p(`Cette analyse identifie ${active.length} scénario(s) de risque issus de ${d.srovPairs.filter((x) => x.retained).length} couple(s) source de risque / objectif visé retenus, portant sur ${d.businessValues.length} valeur(s) métier.`);
  for (const l of [...s.scales.riskLevels].reverse()) {
    p(`• Risques ${l.label.toLowerCase()}s — ${l.acceptability} : ${active.filter((r) => r.level === l.value).length} en initial, ${active.filter((r) => r.residualLevel === l.value).length} en résiduel.`);
  }
  await image(RiskMatrix, { settings: s, title: "Cartographie du risque initial", items: active.map((r) => ({ id: r.record.id, ref: r.record.ref, g: r.gravity.value, v: r.likelihood.value, title: r.record.title, color: "#1b2333" })) }, 520);
  await image(ThreatMap, { data: d, width: 1200 }, 640, "Carte de la menace : sources de risque, objectifs visés, valeurs métier et niveaux de risque");

  if (workshops.includes(1)) {
    onProgress?.("Atelier 1…");
    const f = d.framing;
    h("Atelier 1 — Cadrage et socle de sécurité");
    h("Cadre de l'étude", 2);
    kv("Objet de l'étude", f.subject);
    kv("Finalité", PURPOSES.find((x) => x.id === f.purpose)?.label ?? "");
    kv("Objectifs", stripHtml(f.objectives));
    kv("Responsable de l'acceptation des risques résiduels", f.participants.find((x) => x.id === f.riskOwnerId)?.name ?? "À désigner");
    kv("Cadre temporel", `cycle stratégique de ${f.strategicCycleMonths} mois, cycle opérationnel de ${f.operationalCycleMonths} mois`);
    kv("Hypothèses", stripHtml(f.assumptions));
    kv("Contraintes", stripHtml(f.constraints));
    table(["Participant", "Rôle", "Organisation", "A1", "A2", "A3", "A4", "A5"], f.participants.map((x) => [x.name, x.role, x.organisation, ...[1, 2, 3, 4, 5].map((w) => f.raci[String(w)]?.[x.id] ?? "")]), [24, 18, 18, 5, 5, 5, 5, 5]);
    h("Périmètre métier et technique", 2);
    table(["Valeur métier", "Nature", "Description", "Responsable", "Biens supports"], d.businessValues.map((b) => [`${b.ref} ${b.name}`, b.nature === "process" ? "Processus" : "Information", stripHtml(b.description), b.owner,
      d.supportingAssets.filter((a) => a.businessValueIds.includes(b.id)).map((a) => `${a.ref} ${a.name}`).join("\n")]), [20, 10, 36, 14, 22]);
    if (d.businessValues.length) await image(PerimeterMap, { data: d }, 620, "Missions, valeurs métier et biens supports");
    h("Événements redoutés", 2);
    table(["Réf.", "Valeur métier", "Événement redouté", "Impacts", "Gravité"], d.fearedEvents.map((e) => [e.ref, d.businessValues.find((b) => b.id === e.businessValueId)?.name ?? "Non intentionnel",
      e.name, [e.criteria.map((c) => CRITERIA_LABELS[c]).join(", "), e.impactCategoryIds.map((id) => s.catalogs.impactCategories.find((c) => c.id === id)?.label).join(", ")].filter(Boolean).join("\n"), lv(s.scales.gravity, e.gravity)]), [7, 18, 40, 22, 13]);
    h("Socle de sécurité", 2);
    for (const r of d.baseline.referentials) {
      const st = referentialStatus(r);
      h(`${r.name} — ${st.value ? BASELINE_STATUS[st.value].label : "non évalué"}`, 3);
      const gaps = r.requirements.filter((q) => q.status === "partial" || q.status === "not_applied");
      p(`${r.requirements.filter((q) => q.status === "applied").length} exigence(s) appliquée(s), ${gaps.length} écart(s).`);
      if (gaps.length) table(["Réf.", "Exigence", "État", "Écart", "Justification"], gaps.map((q) => [q.ref, q.title, REQUIREMENT_STATUS[q.status].label, q.gap, stripHtml(q.justification)]), [8, 34, 14, 22, 22]);
    }
    if (d.baseline.referentials.length === 1 && d.baseline.referentials[0].requirements.some((q) => q.section)) {
      const ref = d.baseline.referentials[0];
      const sections = [...new Set(ref.requirements.map((q) => q.section ?? "Autres"))];
      await image(Kiviat, { axes: sections.map((sec) => {
        const rel = ref.requirements.filter((q) => (q.section ?? "Autres") === sec && q.status !== "na");
        return { label: sec, value: rel.length ? rel.reduce((a, q) => a + (q.status === "applied" ? 1 : q.status === "partial" ? 0.5 : 0), 0) / rel.length : null };
      }) }, 480, "Couverture du socle de sécurité");
    }
    kv("Décision", d.baseline.decision === "continue" ? "Poursuite de l'étude en considérant les non-conformités" : d.baseline.decision === "strengthen_first" ? "Renforcement du socle avant de poursuivre" : "À décider");
    if (d.baseline.decisionComment) p(stripHtml(d.baseline.decisionComment));
  }

  if (workshops.includes(2)) {
    onProgress?.("Atelier 2…");
    h("Atelier 2 — Sources de risque");
    table(["Réf.", "Source de risque", "Objectif visé", "Motivation", "Ressources", "Activité", "Pertinence", "Retenu"], d.srovPairs.map((x) => [x.ref, d.riskSources.find((r) => r.id === x.riskSourceId)?.name, x.objective,
      lv(s.scales.motivation, x.motivation), lv(s.scales.resources, x.resources), lv(s.scales.activity, x.activity), lv(s.scales.pertinence, pertinence(s, x).value), x.retained ? `Oui (${x.priority ?? ""})` : "Non"]), [6, 14, 34, 10, 10, 10, 10, 6]);
    for (const x of d.srovPairs.filter((y) => stripHtml(y.justification) || (!y.retained && y.exclusionJustification))) {
      p(`${x.ref} — ${stripHtml(x.justification)}${!x.retained && x.exclusionJustification ? ` Exclusion : ${x.exclusionJustification}` : ""}`, { italics: true });
    }
    if (d.srovPairs.length) await image(SrovRadar, { data: d, mode: "source", size: 620 }, 460, "Cartographie des sources de risque (distance au centre : pertinence)");
    h("Croisement objectifs visés / événements redoutés", 2);
    table(["Couple", "Événements redoutés associés", "Gravité héritée"], d.srovPairs.filter((x) => x.retained).map((x) => [x.ref, d.fearedEvents.filter((f) => x.fearedEventIds.includes(f.id)).map((f) => `${f.ref} ${f.name}`).join("\n"), lv(s.scales.gravity, srovGravity(d, x))]), [10, 70, 20]);
  }

  if (workshops.includes(3)) {
    onProgress?.("Atelier 3…");
    h("Atelier 3 — Scénarios stratégiques");
    h("Cartographie de dangerosité de l'écosystème", 2);
    const t = s.dangerosity.thresholds;
    p(`Niveau de dangerosité = (Dépendance × Pénétration) / (Maturité cyber × Confiance). Seuils : veille ${t.watch}, contrôle ${t.control}, danger ${t.danger}.`);
    table(["Réf.", "Partie prenante", "D", "P", "M", "C", "Dangerosité", "Zone", "Critique", "Résiduelle"], d.stakeholders.map((x) => {
      const e = evaluateStakeholder(s, x);
      return [x.ref, x.name, x.criteria.dependency, x.criteria.penetration, x.criteria.maturity, x.criteria.trust, e.initial.value, e.zone ? ZONE_LABELS[e.zone] : "", e.critical ? "Oui" : "", e.residual.value];
    }), [6, 26, 5, 5, 5, 5, 11, 15, 8, 11]);
    if (d.stakeholders.length) {
      await image(StakeholderRadar, { data: d, size: 620, title: "Dangerosité initiale" }, 420, "Cartographie de dangerosité initiale");
      await image(StakeholderRadar, { data: d, residual: true, size: 620, title: "Dangerosité résiduelle" }, 420, "Cartographie de dangerosité résiduelle (après mesures sur l'écosystème)");
    }
    h("Scénarios stratégiques", 2);
    for (const sc of d.strategicScenarios) {
      const pair = d.srovPairs.find((x) => x.id === sc.srovId);
      h(`${sc.ref} — ${sc.name}`, 3);
      kv("Couple SR/OV", `${d.riskSources.find((r) => r.id === pair?.riskSourceId)?.name ?? ""} / ${pair?.objective ?? ""}`);
      kv("Gravité", lv(s.scales.gravity, strategicGravity(d, sc).value));
      if (sc.description) p(stripHtml(sc.description));
      await image(StrategicDiagram, { data: d, scenario: sc }, 640);
      table(["Chemin", "Séquence d'événements", "Retenu"], sc.paths.map((x) => [`${x.ref} ${x.name}`, x.steps.map((st, i) => `${i + 1}. ${st.kind === "intermediate" ? `[${d.stakeholders.find((y) => y.id === st.stakeholderId)?.name ?? "PP"}] ` : `[${d.fearedEvents.find((f) => f.id === st.fearedEventId)?.ref ?? "ER"}] `}${st.label}`).join("\n"), x.retained ? "Oui" : "Non"]), [28, 62, 10]);
    }
    h("Mesures de sécurité sur l'écosystème", 2);
    const crit = d.stakeholders.filter((x) => evaluateStakeholder(s, x).critical);
    table(["Partie prenante critique", "Zone initiale", "Recommandation", "Mesures", "Menace initiale → résiduelle"], crit.map((x) => {
      const e = evaluateStakeholder(s, x);
      return [`${x.ref} ${x.name}`, e.zone ? ZONE_LABELS[e.zone] : "", e.zone ? ECOSYSTEM_RECOMMENDATIONS[e.zone].acceptability : "", d.measures.filter((m) => m.stakeholderIds.includes(x.id)).map((m) => `${m.ref} ${m.title}`).join("\n"), `${e.initial.value ?? "—"} → ${e.residual.value ?? "—"}`];
    }), [20, 12, 14, 38, 16]);
  }

  if (workshops.includes(4)) {
    onProgress?.("Atelier 4…");
    h("Atelier 4 — Scénarios opérationnels");
    p(`Méthode d'évaluation de la vraisemblance : ${s.likelihoodMethod === "express" ? "expresse" : s.likelihoodMethod === "standard" ? "standard (probabilité de succès des actions élémentaires)" : "avancée (probabilité de succès et difficulté technique)"}.`);
    for (const o of d.operationalScenarios) {
      const lk = operationalLikelihood(d, o);
      h(`${o.ref} — ${o.name}`, 3);
      kv("Vraisemblance globale", `${lv(s.scales.likelihood, lk.value)}${lk.forced !== null ? " (forcée)" : ""}`);
      if (o.description) p(stripHtml(o.description));
      if (o.nodes.length > 1) await image(StaticAttackGraph, { data: d, scenario: o }, 640, "Graphe d'attaque (en rouge : mode opératoire le plus vraisemblable)");
      if (o.operatingModes.length) table(["Mode opératoire", "Description", "Vraisemblance"], o.operatingModes.map((m) => [m.name, stripHtml(m.description), lv(s.scales.likelihood, m.likelihood)]), [25, 60, 15]);
      if (o.justification) p(stripHtml(o.justification), { italics: true });
    }
  }

  if (workshops.includes(5)) {
    onProgress?.("Atelier 5…");
    h("Atelier 5 — Traitement du risque");
    h("Synthèse des scénarios de risque", 2);
    table(["Réf.", "Scénario de risque", "Gravité", "Vraisemblance", "Niveau", "Acceptabilité", "Traitement"], active.map((r) => [r.record.ref, r.record.title, lv(s.scales.gravity, r.gravity.value), lv(s.scales.likelihood, r.likelihood.value),
      riskLevelDef(s, r.level)?.label, riskLevelDef(s, r.acceptability)?.acceptability, r.record.treatment ? TREATMENT[r.record.treatment] : "À décider"]), [6, 40, 12, 14, 8, 12, 8]);
    const uncovered = coverage(d, rows).filter((c) => c.riskIds.length === 0);
    if (uncovered.length) p(`Événements redoutés non couverts par un scénario de risque : ${uncovered.map((c) => `${c.fearedEvent.ref} (G${c.fearedEvent.gravity ?? "?"})`).join(", ")}.`, { italics: true });
    h("Plan de traitement du risque", 2);
    table(["Réf.", "Mesure", "Catégorie", "Risques", "Responsable", "Coût", "Échéance", "Statut"], d.measures.map((m) => [m.ref, m.title, MEASURE_CATEGORY[m.category].label, m.riskIds.map((id) => d.risks.find((r) => r.id === id)?.ref).join(", "), m.owner, m.cost ? COST_LABELS[m.cost] : "", m.dueDate, `${MEASURE_STATUS[m.status].label} (${m.progress} %)`]), [6, 36, 11, 9, 12, 6, 10, 10]);
    if (d.measures.length) await image(StackedBars, { rows: Object.entries(MEASURE_CATEGORY).map(([k, v]) => ({ label: v.label, values: Object.fromEntries(Object.keys(MEASURE_STATUS).map((st) => [st, d.measures.filter((m) => m.category === k && m.status === st).length])) })), series: Object.entries(MEASURE_STATUS).map(([k, v]) => ({ key: k, label: v.label, color: v.color })) }, 480, "Mesures par catégorie et statut");
    h("Risques résiduels", 2);
    await image(RiskMatrix, { settings: s, title: "Cartographie du risque résiduel", items: active.map((r) => ({ id: r.record.id, ref: r.record.ref, g: r.residualGravity, v: r.residualLikelihood, title: r.record.title, color: riskLevelDef(s, r.residualLevel)?.color })), arrows: active.filter((r) => r.gravity.value !== null && r.likelihood.value !== null && r.residualGravity !== null && r.residualLikelihood !== null).map((r) => ({ id: r.record.id, from: { g: r.gravity.value as number, v: r.likelihood.value as number }, to: { g: r.residualGravity as number, v: r.residualLikelihood as number } })) }, 520);
    for (const r of active) {
      h(`RR — ${r.record.ref} : ${r.record.title}`, 3);
      kv("Niveau initial", `${riskLevelDef(s, r.level)?.label ?? "—"} (G${r.gravity.value ?? "?"} / V${r.likelihood.value ?? "?"})`);
      kv("Niveau résiduel", `${riskLevelDef(s, r.residualLevel)?.label ?? "—"} (G${r.residualGravity ?? "?"} / V${r.residualLikelihood ?? "?"})`);
      kv("Événements redoutés concernés", r.fearedEvents.map((f) => `${f.ref} ${f.name}`).join(" ; "));
      kv("Mesures", r.measureIds.map((id) => d.measures.find((m) => m.id === id)).map((m) => `${m?.ref} ${m?.title}`).join(" ; "));
      if (r.record.residualDoc.description) kv("Description", stripHtml(r.record.residualDoc.description));
      if (r.record.residualDoc.vulnerabilities) kv("Vulnérabilités résiduelles", stripHtml(r.record.residualDoc.vulnerabilities));
      if (r.record.residualDoc.aggravatingFactors) kv("Facteurs aggravants", stripHtml(r.record.residualDoc.aggravatingFactors));
      if (r.record.residualDoc.management) kv("Gestion du risque résiduel", stripHtml(r.record.residualDoc.management));
    }
    h("Cadre de suivi des risques", 2);
    kv("Comité de pilotage", `tous les ${d.monitoring.committeeFrequencyMonths} mois — prochain : ${d.monitoring.nextCommitteeDate || "à planifier"} — ${d.monitoring.committeeMembers}`);
    table(["Indicateur", "Cible", "Valeur", "Fréquence", "Responsable"], d.monitoring.indicators.map((i) => [i.name, i.target, i.current, i.frequency, i.owner]), [40, 14, 14, 16, 16]);
    table(["Déclencheur de mise à jour", "Veille assurée par"], d.monitoring.triggers.map((t) => [t.description, t.owner]), [75, 25]);
  }

  h("Annexe — Échelles de cotation");
  for (const [k, label] of [["gravity", "Gravité"], ["likelihood", "Vraisemblance"]] as const) {
    h(label, 2);
    table(["Niveau", "Libellé", "Description"], s.scales[k].map((l) => [l.value, l.label, l.description]), [8, 20, 72]);
  }
  table(["Niveau de risque", "Acceptabilité", "Décision"], s.scales.riskLevels.map((l) => [l.label, l.acceptability, l.decision]), [15, 20, 65]);
}
