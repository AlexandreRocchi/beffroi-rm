/**
 * Import du modèle de tableur de l'ANSSI (EBIOS_RM_Ateliers_modele.xlsx).
 * Le modèle étant rempli librement, l'import est tolérant : il reprend ce qui peut l'être
 * et signale le reste dans un rapport.
 */
import { emptyStudy, uid } from "./defaults.js";
import { nextRef, pertinence, syncRisks } from "./engine.js";
import { normalizeStudy } from "./normalize.js";
import type { AttackPath, RequirementStatus, StudyData, TreatmentOption } from "./types.js";

export type Cell = string | number | boolean | null;
/** Feuilles du classeur : lignes × colonnes, cellules fusionnées déjà remplies avec la valeur maîtresse. */
export type Grid = Record<string, Cell[][]>;

/** Interface minimale d'un classeur exceljs (évite toute dépendance dans le module partagé). */
export interface WorkbookLike {
  worksheets: {
    name: string;
    rowCount: number;
    columnCount: number;
    getCell(r: number, c: number): { value: unknown; master?: { value: unknown } };
  }[];
}

function cellText(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return cellText(o.result);
    if (typeof o.text === "string") return o.text;
    // Formule sans valeur calculée en cache, erreur, etc.
    return null;
  }
  return null;
}

export function workbookToGrid(wb: WorkbookLike): Grid {
  const grid: Grid = {};
  for (const ws of wb.worksheets) {
    const rows: Cell[][] = [];
    const nr = Math.min(ws.rowCount, 2000);
    const nc = Math.min(ws.columnCount, 200);
    for (let r = 1; r <= nr; r++) {
      const row: Cell[] = [];
      for (let c = 1; c <= nc; c++) {
        const cell = ws.getCell(r, c);
        row.push(cellText(cell.master ? cell.master.value : cell.value));
      }
      rows.push(row);
    }
    grid[ws.name] = rows;
  }
  return grid;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const str = (s: Cell | undefined) => (s === null || s === undefined ? "" : String(s).trim());
const html = (s: string) => (s ? s.split(/\n+/).map((l) => `<p>${l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string)}</p>`).join("") : "");

function sheet(grid: Grid, ...names: string[]): Cell[][] | null {
  const keys = Object.keys(grid);
  for (const n of names) {
    const k = keys.find((x) => norm(x) === norm(n)) ?? keys.find((x) => norm(x).includes(norm(n)));
    if (k) return grid[k];
  }
  return null;
}

/** Première valeur numérique d'une cellule (« 3. grave », « G3 », « V3 - … », 3). */
function level(v: Cell | undefined): number | null {
  if (typeof v === "number") return Math.round(v);
  const m = /(\d)/.exec(str(v));
  return m ? Number(m[1]) : null;
}

/** « + », « ++ », « +++ » ou un nombre, ramené à l'échelle 1..4. */
function plusLevel(v: Cell | undefined): number | null {
  if (typeof v === "number") return Math.max(1, Math.min(4, Math.round(v)));
  const t = str(v);
  const plus = (t.match(/\+/g) ?? []).length;
  if (plus) return Math.min(4, plus);
  const n = level(v);
  if (n !== null) return Math.max(1, Math.min(4, n));
  const w = norm(t);
  if (/maxim/.test(w)) return 4;
  if (/import|elev|fort/.test(w)) return 3;
  if (/signif|moyen|moder/.test(w)) return 2;
  if (/faibl/.test(w)) return 1;
  return null;
}

function pertinenceFromText(v: Cell | undefined): number | null {
  const w = norm(v);
  if (!w) return null;
  if (/elev|forte|haut/.test(w)) return 3;
  if (/moyen|modere/.test(w)) return 2;
  if (/faibl|bas/.test(w)) return 1;
  return level(v);
}

function srCategory(name: string): string | null {
  const w = norm(name);
  if (/concurr/.test(w)) return "sr-concurrent";
  if (/activ|hacktiv|militant/.test(w)) return "sr-activiste";
  if (/crimin|mafia|rancon|gang/.test(w)) return "sr-crime";
  if (/terror/.test(w)) return "sr-terro";
  if (/etat|etatique|renseignement|apt/.test(w)) return "sr-etat";
  if (/officine|mercenaire/.test(w)) return "sr-officine";
  if (/amateur|script/.test(w)) return "sr-amateur";
  if (/collabor|salari|employ|interne|initie/.test(w)) return "sr-collaborateur";
  if (/opportun|fraudeur|escroc/.test(w)) return "sr-tiers";
  return null;
}

function ppCategory(name: string): string | null {
  const w = norm(name);
  if (/client/.test(w)) return "pp-clients";
  if (/partenaire|cotraitant/.test(w)) return "pp-partenaires";
  if (/prestataire|fournisseur|sous-traitant|soustraitant/.test(w)) return "pp-prestataires";
  if (/filiale/.test(w)) return "pp-filiales";
  if (/service/.test(w)) return "pp-services-techniques";
  return null;
}

function treatment(v: Cell | undefined): TreatmentOption | null {
  const w = norm(v);
  if (/redui/.test(w)) return "reduce";
  if (/accept/.test(w)) return "accept";
  if (/transf|partag/.test(w)) return "transfer";
  if (/refus|evit/.test(w)) return "avoid";
  return null;
}

function similarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(/[^a-z0-9]+/).filter((x) => x.length > 3));
  const tb = new Set(norm(b).split(/[^a-z0-9]+/).filter((x) => x.length > 3));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

/** Lignes de données d'une feuille tabulaire : repère la ligne d'en-tête contenant `anchor`. */
function table(rows: Cell[][] | null, anchor: string): { header: string[]; data: Cell[][] } {
  if (!rows) return { header: [], data: [] };
  const hi = rows.findIndex((r) => r.some((c) => norm(c).startsWith(norm(anchor))));
  if (hi < 0) return { header: [], data: [] };
  const header = rows[hi].map((c) => norm(c));
  const data = rows.slice(hi + 1).filter((r) => r.some((c) => str(c) !== ""));
  return { header, data };
}

const col = (header: string[], ...names: string[]) => {
  for (const n of names) {
    const i = header.findIndex((h) => h.startsWith(norm(n)));
    if (i >= 0) return i;
  }
  return -1;
};

export interface ImportReport {
  counts: Record<string, number>;
  warnings: string[];
}

export function importAnssiTemplate(grid: Grid): { data: StudyData; report: ImportReport } {
  const d = emptyStudy(4);
  d.baseline.decision = "undecided";
  d.settings.likelihoodMethod = "express";
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  const inc = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

  // ───── Atelier 1 : missions, valeurs métier, biens supports (feuille transposée) ─────
  const mis = sheet(grid, "Atelier 1 - Missions");
  if (mis) {
    const rowOf = (label: string, from = 0) => mis.findIndex((r, i) => i >= from && norm(r[0]).startsWith(norm(label)));
    const rMission = rowOf("Missions");
    const rBv = rowOf("Dénomination de la valeur");
    const rNature = rowOf("Nature");
    const rDesc = rowOf("Description");
    const rOwner = rowOf("Entité ou personne");
    const rAsset = rowOf("Dénomination du/des biens");
    const rAssetDesc = rAsset >= 0 ? rowOf("Description", rAsset + 1) : -1;
    const rAssetOwner = rAsset >= 0 ? rowOf("Entité ou personne", rAsset + 1) : -1;
    const width = Math.max(...mis.map((r) => r.length));
    const missions = new Map<string, string>();
    const bvs = new Map<string, string>();
    const assets = new Map<string, string>();
    for (let c = 1; c < width; c++) {
      const bvName = rBv >= 0 ? str(mis[rBv][c]) : "";
      const mName = rMission >= 0 ? str(mis[rMission][c]) : "";
      let mId: string | undefined;
      if (mName) {
        mId = missions.get(norm(mName));
        if (!mId) {
          mId = uid();
          missions.set(norm(mName), mId);
          d.missions.push({ id: mId, ref: nextRef("MI", d.missions), name: mName, description: "" });
        }
      }
      if (!bvName) continue;
      let bvId = bvs.get(norm(bvName));
      if (!bvId) {
        bvId = uid();
        bvs.set(norm(bvName), bvId);
        const owner = rOwner >= 0 ? str(mis[rOwner][c]) : "";
        d.businessValues.push({
          id: bvId, ref: nextRef("VM", d.businessValues), name: bvName,
          nature: /info/i.test(rNature >= 0 ? str(mis[rNature][c]) : "") ? "information" : "process",
          description: html(rDesc >= 0 ? str(mis[rDesc][c]) : ""), owner: owner.replace(/\((interne|externe)\)/i, "").trim(),
          ownerType: /externe/i.test(owner) ? "external" : "internal", missionIds: mId ? [mId] : [], needs: { D: null, I: null, C: null, T: null },
        });
      }
      const aName = rAsset >= 0 ? str(mis[rAsset][c]) : "";
      if (aName) {
        const existing = assets.get(norm(aName));
        if (existing) {
          const a = d.supportingAssets.find((x) => x.id === existing);
          if (a && !a.businessValueIds.includes(bvId)) a.businessValueIds.push(bvId);
        } else {
          const id = uid();
          assets.set(norm(aName), id);
          const owner = rAssetOwner >= 0 ? str(mis[rAssetOwner][c]) : "";
          d.supportingAssets.push({
            id, ref: nextRef("BS", d.supportingAssets), name: aName, typeId: null, description: html(rAssetDesc >= 0 ? str(mis[rAssetDesc][c]) : ""),
            owner: owner.replace(/\((interne|externe)\)/i, "").trim(), ownerType: /externe/i.test(owner) ? "external" : "internal", businessValueIds: [bvId],
          });
        }
      }
    }
    inc("missions", d.missions.length);
    inc("valeurs métier", d.businessValues.length);
    inc("biens supports", d.supportingAssets.length);
  }

  const findBv = (name: string) => {
    const n = norm(name);
    if (!n) return null;
    let bv = d.businessValues.find((b) => norm(b.name) === n) ?? d.businessValues.find((b) => norm(b.name).includes(n) || n.includes(norm(b.name)));
    if (!bv) {
      bv = { id: uid(), ref: nextRef("VM", d.businessValues), name, nature: "process", description: "", owner: "", ownerType: "internal", missionIds: [], needs: { D: null, I: null, C: null, T: null } };
      d.businessValues.push(bv);
      warnings.push(`Valeur métier « ${name} » absente de la feuille Missions : créée.`);
    }
    return bv.id;
  };

  // ───── Atelier 1 : événements redoutés ─────
  const er = table(sheet(grid, "Atelier 1 - ER"), "Valeur métier");
  {
    const cBv = col(er.header, "valeur"), cEr = col(er.header, "evenement", "événement"), cImp = col(er.header, "impact"), cG = col(er.header, "gravite", "gravité");
    for (const r of er.data) {
      const name = str(r[cEr]);
      if (!name) continue;
      d.fearedEvents.push({
        id: uid(), ref: nextRef("ER", d.fearedEvents), businessValueId: cBv >= 0 && str(r[cBv]) ? findBv(str(r[cBv])) : null, name: name.replace(/\s+/g, " "),
        criteria: [], impactCategoryIds: [], impacts: html(cImp >= 0 ? str(r[cImp]) : ""), gravity: cG >= 0 ? level(r[cG]) : null, justification: "", expressLikelihood: null,
      });
      inc("événements redoutés");
    }
  }

  // ───── Atelier 1 : socle (écarts) ─────
  const gap = table(sheet(grid, "Atelier 1 - GAP"), "Type de référentiel");
  {
    const cType = col(gap.header, "type"), cName = col(gap.header, "nom"), cState = col(gap.header, "etat"), cGap = col(gap.header, "ecart"), cJust = col(gap.header, "justification");
    for (const r of gap.data) {
      const name = str(r[cName]) || str(r[cType]);
      if (!name) continue;
      let ref = d.baseline.referentials.find((x) => norm(x.name) === norm(name));
      const state = norm(r[cState]);
      const status: RequirementStatus = /restri|partiel/.test(state) ? "partial" : /non/.test(state) ? "not_applied" : /appliq/.test(state) ? "applied" : "unknown";
      if (!ref) {
        const t = norm(r[cType]);
        ref = {
          id: uid(), name, description: str(r[cType]), requirements: [],
          type: /hygien|bonne/.test(t) ? "hygiene" : /norme|iso/.test(t) ? "standard" : /regle|pssi|intern/.test(t) ? "internal" : /regl|loi|legis/.test(t) ? "regulation" : /tiers|client/.test(t) ? "third_party" : "other",
          statusForced: status === "applied" || status === "partial" || status === "not_applied" ? status : null,
        };
        d.baseline.referentials.push(ref);
        inc("référentiels");
      }
      const g = str(r[cGap]);
      if (g && !ref.requirements.some((q) => norm(q.title) === norm(g))) {
        ref.requirements.push({ id: uid(), ref: `E${ref.requirements.length + 1}`, title: g.split("\n")[0].slice(0, 300), status: status === "applied" ? "partial" : status, gap: g, justification: html(str(r[cJust])) });
        inc("écarts du socle");
      }
    }
  }

  // ───── Atelier 2 : couples SR/OV ─────
  const findSr = (name: string) => {
    let sr = d.riskSources.find((s) => norm(s.name) === norm(name));
    if (!sr) {
      sr = { id: uid(), ref: nextRef("SR", d.riskSources), categoryId: srCategory(name), name, description: "" };
      d.riskSources.push(sr);
      inc("sources de risque");
    }
    return sr.id;
  };
  const findPair = (srName: string, ov: string) => {
    const srId = findSr(srName || "Source de risque non précisée");
    return d.srovPairs.find((p) => p.riskSourceId === srId && (norm(p.objective) === norm(ov) || similarity(p.objective, ov) >= 0.6));
  };
  const srov = table(sheet(grid, "Atelier 2 - SROV"), "Sources de risque");
  {
    const cSr = col(srov.header, "source"), cOv = col(srov.header, "objectif"), cM = col(srov.header, "motivation"), cR = col(srov.header, "ressource"),
      cP = col(srov.header, "pertinence"), cPr = col(srov.header, "priorite", "priorité"), cRet = col(srov.header, "retenu"), cJ = col(srov.header, "justification");
    for (const r of srov.data) {
      const srName = str(r[cSr]);
      const ov = str(r[cOv]);
      if (!srName && !ov) continue;
      const pair = {
        id: uid(), ref: nextRef("OV", d.srovPairs), riskSourceId: findSr(srName || "Source de risque non précisée"), objective: ov || "Objectif visé à préciser",
        objectiveCategoryId: null, motivation: plusLevel(r[cM]), resources: plusLevel(r[cR]), activity: null, pertinenceForced: null as number | null,
        justification: "", priority: null as "P1" | "P2" | null, retained: /oui|yes|x|1/i.test(str(r[cRet])), exclusionJustification: str(r[cJ]), fearedEventIds: [] as string[],
      };
      const prio = level(r[cPr]);
      pair.priority = prio === 1 ? "P1" : prio === 2 ? "P2" : pair.retained ? "P1" : null;
      const given = pertinenceFromText(r[cP]);
      if (given !== null && pertinence(d.settings, pair).computed !== given) pair.pertinenceForced = given;
      d.srovPairs.push(pair);
      inc("couples SR/OV");
    }
  }

  // ───── Atelier 3 : parties prenantes ─────
  const pp = table(sheet(grid, "Atelier 3 - PP"), "Catégories");
  {
    const cCat = col(pp.header, "categorie", "catégorie"), cName = col(pp.header, "parties", "partie"), cD = col(pp.header, "dependance", "dépendance"),
      cP = col(pp.header, "penetration", "pénétration"), cM = col(pp.header, "maturite", "maturité"), cC = col(pp.header, "confiance");
    const num = (v: Cell | undefined) => { const n = level(v); return n === null ? null : Math.max(1, Math.min(4, n)); };
    for (const r of pp.data) {
      const name = str(r[cName]);
      if (!name) continue;
      d.stakeholders.push({
        id: uid(), ref: nextRef("PP", d.stakeholders), name, categoryId: ppCategory(str(r[cCat]) || name), description: "", rank: 1, parentId: null,
        criteria: { dependency: num(r[cD]), penetration: num(r[cP]), maturity: num(r[cM]), trust: num(r[cC]) }, dangerForced: null, justification: "", critical: null,
        residualCriteria: { dependency: null, penetration: null, maturity: null, trust: null }, residualForced: null,
      });
      inc("parties prenantes");
    }
  }

  // ───── Atelier 3 : scénarios stratégiques ─────
  const ss = table(sheet(grid, "Atelier 3 - SS"), "Sources de risque");
  const scenarioOrder: string[] = [];
  {
    const cSr = col(ss.header, "source"), cOv = col(ss.header, "objectif"), cCh = col(ss.header, "chemin"), cG = col(ss.header, "gravite", "gravité");
    for (const r of ss.data) {
      const srName = str(r[cSr]);
      const ov = str(r[cOv]);
      const text = str(r[cCh]);
      if (!text && !ov) continue;
      let pair = findPair(srName, ov);
      if (!pair) {
        pair = {
          id: uid(), ref: nextRef("OV", d.srovPairs), riskSourceId: findSr(srName || "Source de risque non précisée"), objective: ov || "Objectif visé à préciser", objectiveCategoryId: null,
          motivation: null, resources: null, activity: null, pertinenceForced: null, justification: "", priority: "P1", retained: true, exclusionJustification: "", fearedEventIds: [],
        };
        d.srovPairs.push(pair);
        inc("couples SR/OV");
        warnings.push(`Couple « ${srName} / ${ov.slice(0, 60)} » absent de la feuille SR/OV : créé et retenu.`);
      }
      pair.retained = true;
      const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const numbered = lines.filter((l) => /^\d+\s*[.)-]/.test(l));
      const pathNames = numbered.length ? numbered.map((l) => l.replace(/^\d+\s*[.)-]\s*/, "")) : [lines.join(" ") || "Chemin d'attaque"];
      const intro = numbered.length ? lines.filter((l) => !/^\d+\s*[.)-]/.test(l)).join(" ").replace(/\s*:\s*$/, "").trim() : "";
      const paths: AttackPath[] = pathNames.map((n, i) => ({
        id: uid(), ref: `CA${i + 1}`, name: (intro ? `${n}` : n).slice(0, 300), description: intro ? html(`${intro} ${n}`) : "", steps: [], retained: true,
      }));
      const id = uid();
      const g = level(r[cG]);
      d.strategicScenarios.push({ id, ref: nextRef("SS", d.strategicScenarios), srovId: pair.id, name: (intro || pathNames[0]).slice(0, 200), description: html(text), gravityForced: g, paths });
      scenarioOrder.push(id);
      inc("scénarios stratégiques");
      inc("chemins d'attaque", paths.length);
    }
  }
  if (d.strategicScenarios.some((s) => s.paths.some((p) => !p.steps.length))) {
    warnings.push("Les séquences d'événements des chemins d'attaque ne sont pas structurées dans le modèle : à compléter (atelier 3). Les gravités importées sont conservées comme valeurs forcées.");
  }

  // ───── Atelier 4 : vraisemblance des scénarios opérationnels ─────
  const allPaths = () => d.strategicScenarios.flatMap((s) => s.paths.map((p) => ({ s, p })));
  const so = table(sheet(grid, "Atelier 4 - SO"), "Chemin");
  {
    const cCh = col(so.header, "chemin"), cV = col(so.header, "vraisemblance", "vraissemblance");
    for (const r of so.data) {
      const text = str(r[cCh]);
      if (!text) continue;
      const best = allPaths().map((x) => ({ ...x, sim: Math.max(similarity(x.p.name, text), similarity(`${x.s.name} ${x.p.name}`, text)) })).sort((a, b) => b.sim - a.sim)[0];
      if (!best || best.sim < 0.4) {
        warnings.push(`Scénario opérationnel « ${text.slice(0, 70)}… » : aucun chemin d'attaque correspondant.`);
        continue;
      }
      if (d.operationalScenarios.some((o) => o.attackPathId === best.p.id)) continue;
      d.operationalScenarios.push({
        id: uid(), ref: nextRef("SO", d.operationalScenarios), attackPathId: best.p.id, name: best.p.name.slice(0, 200), description: html(text), nodes: [], edges: [], operatingModes: [],
        expressLikelihood: cV >= 0 ? level(r[cV]) : null, expressProbability: null, expressDifficulty: null, determinedSource: false, likelihoodForced: null, justification: "",
      });
      inc("scénarios opérationnels");
    }
  }

  // ───── Atelier 5 : scénarios de risque ─────
  d.risks = syncRisks(d);
  const rk = table(sheet(grid, "Atelier 5 - Risques"), "Index");
  {
    const cIdx = col(rk.header, "index"), cT = col(rk.header, "risque"), cTr = col(rk.header, "traitement"), cSs = col(rk.header, "scenarios strat", "scénarios strat"),
      cCh = col(rk.header, "chemin"), cG = col(rk.header, "gravite", "gravité"), cV = col(rk.header, "vraisemblance", "vraissemblance"), cEr = col(rk.header, "evenement", "evennement", "événement");
    for (const r of rk.data) {
      const ssN = level(r[cSs]);
      const chN = level(r[cCh]);
      const sc = ssN !== null ? d.strategicScenarios.find((s) => s.id === scenarioOrder[ssN - 1]) : undefined;
      const path = sc && chN !== null ? sc.paths[chN - 1] : undefined;
      const title = str(r[cT]);
      const rec = path ? d.risks.find((x) => x.attackPathId === path.id) : title ? d.risks.find((x) => similarity(x.title, title) >= 0.6) : undefined;
      if (!rec) {
        if (title) warnings.push(`Risque ${str(r[cIdx])} « ${title.slice(0, 60)} » : chemin d'attaque introuvable, non importé.`);
        continue;
      }
      if (title) rec.title = title;
      if (str(r[cIdx])) rec.ref = str(r[cIdx]).slice(0, 30);
      rec.treatment = treatment(r[cTr]);
      const g = level(r[cG]);
      const v = level(r[cV]);
      if (path && !d.operationalScenarios.some((o) => o.attackPathId === path.id) && v !== null) rec.likelihoodForced = v;
      if (g !== null && sc && sc.gravityForced === null) sc.gravityForced = g;
      const erText = str(r[cEr]);
      if (erText && sc) {
        const fe = d.fearedEvents.find((f) => similarity(f.name, erText) >= 0.6);
        const pair = d.srovPairs.find((p) => p.id === sc.srovId);
        if (fe && pair && !pair.fearedEventIds.includes(fe.id)) pair.fearedEventIds.push(fe.id);
        if (fe && path && !path.steps.some((st) => st.fearedEventId === fe.id)) path.steps.push({ id: uid(), kind: "feared", label: fe.name, stakeholderId: null, fearedEventId: fe.id });
      }
      inc("scénarios de risque");
    }
  }

  normalizeStudy(d);
  if (!Object.keys(counts).length) warnings.push("Aucune donnée reconnue : le fichier ne semble pas suivre le modèle de l'ANSSI.");
  return { data: d, report: { counts, warnings } };
}
