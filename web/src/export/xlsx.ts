import {
  COST_LABELS,
  CRITERIA_LABELS,
  coverage,
  evaluateGraph,
  evaluateStakeholder,
  levelLabel,
  MEASURE_CATEGORY,
  MEASURE_ORIGIN,
  MEASURE_STATUS,
  operationalLikelihood,
  pertinence,
  PROTECTION_MARKS,
  PURPOSES,
  referentialStatus,
  REFERENTIAL_TYPES,
  REQUIREMENT_STATUS,
  riskLevelDef,
  riskRows,
  srovGravity,
  strategicGravity,
  stripHtml,
  TREATMENT,
  ZONE_LABELS,
  type StudyData,
  type StudyMeta,
} from "@beffroi/shared";

type Cell = string | number | null | undefined;

export async function exportExcel(meta: StudyMeta, d: StudyData, workshops: number[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Beffroi RM";
  wb.created = new Date();
  const mark = PROTECTION_MARKS.find((m) => m.id === meta.protection);
  const s = d.settings;
  const lv = (scale: Parameters<typeof levelLabel>[0], v: number | null | undefined) => (v === null || v === undefined ? "" : levelLabel(scale, v));
  const names = <T extends { id: string; ref?: string; name?: string }>(list: T[], ids: string[]) => ids.map((id) => list.find((x) => x.id === id)).filter(Boolean).map((x) => `${x!.ref ?? ""} ${x!.name ?? ""}`.trim()).join(", ");

  const sheet = (name: string, title: string, headers: string[], rows: Cell[][], widths?: number[]) => {
    const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 4 }] });
    ws.mergeCells(1, 1, 1, Math.max(headers.length, 2));
    const b = ws.getCell(1, 1);
    b.value = (mark?.label ?? meta.protection).toUpperCase();
    b.font = { bold: true, color: { argb: "FFFFFFFF" } };
    b.alignment = { horizontal: "center" };
    b.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + (mark?.color ?? "#555555").slice(1).toUpperCase() } };
    ws.getCell(2, 1).value = `${meta.name} — v${meta.major}.${meta.minor} — ${title}`;
    ws.getCell(2, 1).font = { bold: true, size: 13 };
    const hr = ws.getRow(4);
    headers.forEach((h, i) => {
      const c = hr.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D3B72" } };
      c.alignment = { vertical: "middle", wrapText: true };
    });
    rows.forEach((r, ri) => {
      const row = ws.getRow(5 + ri);
      r.forEach((v, ci) => {
        const c = row.getCell(ci + 1);
        c.value = v === null || v === undefined ? "" : v;
        c.alignment = { vertical: "top", wrapText: true };
        if (ri % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F6FA" } };
      });
    });
    headers.forEach((_, i) => (ws.getColumn(i + 1).width = widths?.[i] ?? 22));
    if (rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: headers.length } };
    return ws;
  };

  if (workshops.includes(1)) {
    const f = d.framing;
    sheet("A1 Cadre", "Cadre de l'étude", ["Élément", "Valeur"], [
      ["Objet de l'étude", f.subject],
      ["Finalité", PURPOSES.find((p) => p.id === f.purpose)?.label],
      ["Objectifs", stripHtml(f.objectives)],
      ["Ateliers conduits", Object.entries(f.workshopsEnabled).filter(([, v]) => v).map(([k]) => `A${k}`).join(", ")],
      ["Responsable de l'acceptation des risques", f.participants.find((p) => p.id === f.riskOwnerId)?.name],
      ["Cycle stratégique (mois)", f.strategicCycleMonths],
      ["Cycle opérationnel (mois)", f.operationalCycleMonths],
      ["Hypothèses", stripHtml(f.assumptions)],
      ["Contraintes", stripHtml(f.constraints)],
      ...f.meetings.map((m) => [`Séance ${m.workshop ? `atelier ${m.workshop}` : ""}`, `${m.date} — ${m.title} ${m.notes}`] as Cell[]),
    ], [40, 100]);
    sheet("A1 Participants RACI", "Participants et matrice RACI", ["Nom", "Rôle", "Organisation", "A1", "A2", "A3", "A4", "A5"],
      f.participants.map((p) => [p.name, p.role, p.organisation, ...[1, 2, 3, 4, 5].map((w) => f.raci[String(w)]?.[p.id] ?? "")]), [28, 22, 22, 6, 6, 6, 6, 6]);
    const perim: Cell[][] = [];
    for (const b of d.businessValues) {
      const assets = d.supportingAssets.filter((a) => a.businessValueIds.includes(b.id));
      const base: Cell[] = [names(d.missions, b.missionIds), `${b.ref} ${b.name}`, b.nature === "process" ? "Processus" : "Information", stripHtml(b.description), `${b.owner}${b.ownerType === "external" ? " (externe)" : ""}`];
      if (!assets.length) perim.push([...base, "", "", ""]);
      for (const a of assets) perim.push([...base, `${a.ref} ${a.name}`, stripHtml(a.description), `${a.owner}${a.ownerType === "external" ? " (externe)" : ""}`]);
    }
    sheet("A1 Périmètre", "Missions, valeurs métier et biens supports", ["Mission(s)", "Valeur métier", "Nature", "Description", "Responsable", "Bien support", "Description", "Responsable"], perim, [24, 30, 12, 40, 20, 28, 40, 20]);
    sheet("A1 Biens supports", "Biens supports", ["Réf.", "Bien support", "Type", "Description", "Responsable", "Interne/externe", "Valeurs métier"],
      d.supportingAssets.map((a) => [a.ref, a.name, s.catalogs.supportingAssetTypes.find((t) => t.id === a.typeId)?.label, stripHtml(a.description), a.owner, a.ownerType === "external" ? "Externe" : "Interne", names(d.businessValues, a.businessValueIds)]), [8, 30, 22, 40, 20, 12, 30]);
    sheet("A1 Événements redoutés", "Événements redoutés", ["Réf.", "Valeur métier", "Événement redouté", "Critères", "Impacts", "Description des impacts", "Gravité", "Justification", "Vraisemblance (non intentionnel)"],
      d.fearedEvents.map((e) => [e.ref, d.businessValues.find((b) => b.id === e.businessValueId)?.name ?? "(non liée — non intentionnel)", e.name, e.criteria.map((c) => CRITERIA_LABELS[c]).join(", "),
        e.impactCategoryIds.map((id) => s.catalogs.impactCategories.find((c) => c.id === id)?.label).join(", "), stripHtml(e.impacts), lv(s.scales.gravity, e.gravity), stripHtml(e.justification), lv(s.scales.likelihood, e.expressLikelihood)]), [8, 26, 45, 18, 30, 35, 16, 40, 18]);
    const socle: Cell[][] = [];
    for (const r of d.baseline.referentials) {
      const st = referentialStatus(r);
      for (const q of r.requirements) socle.push([REFERENTIAL_TYPES[r.type], r.name, st.value ?? "", q.section ?? "", q.ref, q.title, REQUIREMENT_STATUS[q.status].label, q.gap, stripHtml(q.justification)]);
    }
    sheet("A1 Socle", "Socle de sécurité", ["Type de référentiel", "Référentiel", "État global", "Rubrique", "Réf.", "Exigence", "État d'application", "Écart", "Justification"], socle, [22, 30, 14, 24, 10, 50, 22, 35, 40]);
  }

  if (workshops.includes(2)) {
    sheet("A2 Sources de risque", "Sources de risque", ["Réf.", "Source de risque", "Catégorie", "Caractérisation"],
      d.riskSources.map((r) => [r.ref, r.name, s.catalogs.riskSourceCategories.find((c) => c.id === r.categoryId)?.label, stripHtml(r.description)]), [8, 28, 26, 70]);
    sheet("A2 Couples SR-OV", "Couples source de risque / objectif visé", ["Réf.", "Source de risque", "Objectif visé", "Catégorie d'OV", "Motivation", "Ressources", "Activité", "Pertinence", "Pertinence forcée", "Justification", "Priorité", "Retenu", "Justification de l'exclusion", "ER associés", "Gravité héritée"],
      d.srovPairs.map((p) => {
        const pert = pertinence(s, p);
        return [p.ref, d.riskSources.find((r) => r.id === p.riskSourceId)?.name, p.objective, s.catalogs.targetObjectiveCategories.find((c) => c.id === p.objectiveCategoryId)?.label,
          lv(s.scales.motivation, p.motivation), lv(s.scales.resources, p.resources), lv(s.scales.activity, p.activity), lv(s.scales.pertinence, pert.value), pert.forced !== null ? "oui" : "",
          stripHtml(p.justification), p.priority, p.retained ? "OUI" : "NON", p.exclusionJustification, d.fearedEvents.filter((f) => p.fearedEventIds.includes(f.id)).map((f) => f.ref).join(", "), lv(s.scales.gravity, srovGravity(d, p))];
      }), [8, 20, 45, 20, 16, 16, 16, 16, 10, 40, 8, 8, 30, 16, 16]);
  }

  if (workshops.includes(3)) {
    sheet("A3 Parties prenantes", "Cartographie de dangerosité de l'écosystème", ["Réf.", "Partie prenante", "Catégorie", "Rang", "Dépendance", "Pénétration", "Maturité", "Confiance", "Exposition", "Fiabilité cyber", "Dangerosité initiale", "Forcée", "Zone", "Critique", "Justification", "D cible", "P cible", "M cible", "C cible", "Dangerosité résiduelle", "Zone résiduelle"],
      d.stakeholders.map((x) => {
        const e = evaluateStakeholder(s, x);
        return [x.ref, x.name, s.catalogs.stakeholderCategories.find((c) => c.id === x.categoryId)?.label, x.rank, x.criteria.dependency, x.criteria.penetration, x.criteria.maturity, x.criteria.trust, e.exposure, e.reliability, e.initial.value, e.initial.forced !== null ? "oui" : "",
          e.zone ? ZONE_LABELS[e.zone] : "", e.critical ? "OUI" : "", stripHtml(x.justification), x.residualCriteria.dependency, x.residualCriteria.penetration, x.residualCriteria.maturity, x.residualCriteria.trust, e.residual.value, e.residualZone ? ZONE_LABELS[e.residualZone] : ""];
      }), [8, 28, 24, 6, 10, 10, 10, 10, 10, 10, 12, 8, 18, 9, 40, 8, 8, 8, 8, 12, 18]);
    const ss: Cell[][] = [];
    for (const sc of d.strategicScenarios) {
      const pair = d.srovPairs.find((p) => p.id === sc.srovId);
      for (const p of sc.paths) {
        ss.push([sc.ref, sc.name, d.riskSources.find((r) => r.id === pair?.riskSourceId)?.name, pair?.objective, `${p.ref} ${p.name}`, p.retained ? "OUI" : "NON",
          p.steps.map((st, i) => `${i + 1}. ${st.kind === "intermediate" ? `[${d.stakeholders.find((x) => x.id === st.stakeholderId)?.name ?? "PP"}]` : `[${d.fearedEvents.find((f) => f.id === st.fearedEventId)?.ref ?? "ER"}]`} ${st.label}`).join("\n"),
          lv(s.scales.gravity, strategicGravity(d, sc).value), sc.gravityForced !== null ? "oui" : ""]);
      }
    }
    sheet("A3 Scénarios stratégiques", "Scénarios stratégiques et chemins d'attaque", ["Réf.", "Scénario stratégique", "Source de risque", "Objectif visé", "Chemin d'attaque", "Retenu", "Séquence d'événements", "Gravité", "Gravité forcée"], ss, [8, 34, 20, 38, 36, 8, 70, 16, 10]);
    sheet("A3 Mesures écosystème", "Mesures de sécurité sur l'écosystème", ["Partie prenante", "Mesure", "Statut", "Dangerosité initiale", "Dangerosité résiduelle"],
      d.measures.filter((m) => m.stakeholderIds.length).flatMap((m) => m.stakeholderIds.map((sid) => {
        const x = d.stakeholders.find((y) => y.id === sid);
        const e = x ? evaluateStakeholder(s, x) : null;
        return [x ? `${x.ref} ${x.name}` : "", `${m.ref} ${m.title}`, MEASURE_STATUS[m.status].label, e?.initial.value, e?.residual.value];
      })), [30, 60, 14, 14, 14]);
  }

  if (workshops.includes(4)) {
    const pathOf = (id: string) => d.strategicScenarios.flatMap((sc) => sc.paths.map((p) => ({ sc, p }))).find((x) => x.p.id === id);
    sheet("A4 Scénarios opérationnels", "Scénarios opérationnels", ["Réf.", "Chemin d'attaque stratégique associé", "Scénario opérationnel", "Modes opératoires", "Méthode", "Vraisemblance globale", "Forcée", "Justification"],
      d.operationalScenarios.map((o) => {
        const lk = operationalLikelihood(d, o);
        const ix = pathOf(o.attackPathId);
        return [o.ref, ix ? `${ix.sc.ref}.${ix.p.ref} ${ix.p.name}` : "", o.name, o.operatingModes.map((m) => `${m.name}${m.likelihood !== null ? ` (V${m.likelihood})` : ""}`).join("\n"), s.likelihoodMethod, lv(s.scales.likelihood, lk.value), lk.forced !== null ? "oui" : "", stripHtml(o.justification)];
      }), [8, 40, 34, 40, 12, 20, 8, 50]);
    const ae: Cell[][] = [];
    for (const o of d.operationalScenarios) {
      const g = evaluateGraph(s, o, s.likelihoodMethod === "advanced" ? "advanced" : "standard");
      const crit = new Set(g.criticalNodeIds);
      for (const n of o.nodes) {
        if (n.type !== "action") continue;
        const preds = o.edges.filter((e) => e.target === n.id).map((e) => o.nodes.find((x) => x.id === e.source)).map((x) => (x?.type === "and" ? "[ET]" : x?.type === "or" ? "[OU]" : x?.label)).filter(Boolean).join(" ; ");
        ae.push([o.ref, s.catalogs.attackPhases.find((p) => p.id === n.phaseId)?.label, n.label, d.supportingAssets.find((a) => a.id === n.supportingAssetId)?.name ?? d.stakeholders.find((x) => x.id === n.stakeholderId)?.name, preds, n.probability, n.difficulty, g.nodes[n.id]?.pr, g.nodes[n.id]?.diff, crit.has(n.id) ? "OUI" : "", n.notes]);
      }
    }
    sheet("A4 Actions élémentaires", "Actions élémentaires des graphes d'attaque", ["Scénario", "Phase", "Action élémentaire", "Bien support / partie prenante", "Prédécesseurs", "Probabilité de succès", "Difficulté technique", "Indice Pr cumulé", "Indice D cumulé", "Mode le plus vraisemblable", "Notes"], ae, [8, 12, 45, 28, 40, 12, 12, 12, 12, 12, 30]);
  }

  if (workshops.includes(5)) {
    const rows = riskRows(d);
    sheet("A5 Risques", "Synthèse des scénarios de risque", ["Réf.", "Risque", "Source de risque", "Objectif visé", "Événements redoutés", "Scénario stratégique", "Chemin", "Scénario opérationnel", "Gravité", "Vraisemblance", "Niveau initial", "Acceptabilité", "Traitement", "Gravité résiduelle", "Vraisemblance résiduelle", "Niveau résiduel", "Écarté"],
      rows.map((r) => [r.record.ref, r.record.title, r.riskSourceName, r.objective, r.fearedEvents.map((f) => f.ref).join(", "), r.scenario?.ref, r.path?.ref, r.operational?.ref,
        lv(s.scales.gravity, r.gravity.value), lv(s.scales.likelihood, r.likelihood.value), riskLevelDef(s, r.level)?.label, riskLevelDef(s, r.acceptability)?.acceptability, r.record.treatment ? TREATMENT[r.record.treatment] : "",
        lv(s.scales.gravity, r.residualGravity), lv(s.scales.likelihood, r.residualLikelihood), riskLevelDef(s, r.residualLevel)?.label, r.active ? "" : "OUI"]), [8, 50, 18, 36, 14, 8, 8, 8, 16, 18, 12, 20, 14, 16, 18, 12, 8]);
    sheet("A5 Plan de traitement", "Plan de traitement du risque", ["Réf.", "Mesure de sécurité", "Catégorie", "Origine", "Scénarios de risque", "Valeurs métier", "Biens supports", "Parties prenantes", "Responsable", "Freins et difficultés", "Coût/complexité", "Charge", "Échéance", "Priorité", "Statut", "Avancement (%)", "Commentaires"],
      d.measures.map((m) => [m.ref, m.title, MEASURE_CATEGORY[m.category].label, MEASURE_ORIGIN[m.origin], m.riskIds.map((id) => d.risks.find((r) => r.id === id)?.ref).join(", "),
        names(d.businessValues, m.businessValueIds), names(d.supportingAssets, m.supportingAssetIds), names(d.stakeholders, m.stakeholderIds), m.owner, m.obstacles, m.cost ? COST_LABELS[m.cost] : "", m.effort, m.dueDate, m.priority, MEASURE_STATUS[m.status].label, m.progress, stripHtml(m.comments)]),
      [8, 50, 14, 20, 14, 24, 24, 24, 20, 30, 10, 10, 12, 8, 12, 10, 30]);
    sheet("A5 Risques résiduels", "Fiches de risques résiduels", ["Réf.", "Risque", "Description sommaire", "Vulnérabilités résiduelles", "Facteurs aggravants", "ER concernés", "Mesures", "Gravité initiale", "Vraisemblance initiale", "Niveau initial", "Gravité résiduelle", "Vraisemblance résiduelle", "Niveau résiduel", "Gestion du risque résiduel"],
      rows.filter((r) => r.active).map((r) => [r.record.ref, r.record.title, stripHtml(r.record.residualDoc.description), stripHtml(r.record.residualDoc.vulnerabilities), stripHtml(r.record.residualDoc.aggravatingFactors),
        r.fearedEvents.map((f) => `${f.ref} ${f.name}`).join("\n"), r.measureIds.map((id) => d.measures.find((m) => m.id === id)).map((m) => `${m?.ref} ${m?.title}`).join("\n"),
        r.gravity.value, r.likelihood.value, riskLevelDef(s, r.level)?.label, r.residualGravity, r.residualLikelihood, riskLevelDef(s, r.residualLevel)?.label, stripHtml(r.record.residualDoc.management)]),
      [8, 40, 40, 36, 30, 36, 40, 10, 10, 12, 10, 10, 12, 40]);
    const active = rows.filter((r) => r.active);
    sheet("A5 Couverture ER", "Matrice de couverture ER / scénarios de risque", ["Événement redouté", "Gravité", ...active.map((r) => r.record.ref), "Couvert"],
      coverage(d, rows).map((c) => [`${c.fearedEvent.ref} ${c.fearedEvent.name}`, c.fearedEvent.gravity, ...active.map((r) => (c.riskIds.includes(r.record.id) ? "X" : "")), c.riskIds.length ? "oui" : "NON — angle mort"]), [50, 8, ...active.map(() => 6), 18]);
    const m = d.monitoring;
    sheet("A5 Suivi", "Cadre de suivi des risques", ["Type", "Élément", "Cible / fréquence", "Valeur / veille", "Responsable"], [
      ["Comité de pilotage", `Tous les ${m.committeeFrequencyMonths} mois`, `Prochain : ${m.nextCommitteeDate}`, m.committeeMembers, ""],
      ...m.indicators.map((i) => ["Indicateur", i.name, `${i.target} (${i.frequency})`, i.current, i.owner] as Cell[]),
      ...m.triggers.map((t) => ["Déclencheur", t.description, "", "", t.owner] as Cell[]),
    ], [20, 60, 26, 30, 20]);
  }

  const scaleRows: Cell[][] = [];
  for (const [k, label] of [["gravity", "Gravité"], ["likelihood", "Vraisemblance"], ["probability", "Probabilité de succès"], ["difficulty", "Difficulté technique"], ["pertinence", "Pertinence"], ["dependency", "Dépendance"], ["penetration", "Pénétration"], ["maturity", "Maturité"], ["trust", "Confiance"]] as const) {
    for (const l of s.scales[k]) scaleRows.push([label, l.value, l.label, l.description]);
  }
  for (const l of s.scales.riskLevels) scaleRows.push(["Niveau de risque", l.value, `${l.label} — ${l.acceptability}`, l.decision]);
  sheet("Métriques", "Échelles de cotation", ["Échelle", "Niveau", "Libellé", "Description"], scaleRows, [22, 8, 30, 100]);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
