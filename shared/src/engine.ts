/**
 * Moteur de calcul EBIOS RM : toutes les valeurs dérivées de l'étude.
 * Fonctions pures, partagées par le navigateur et le serveur.
 */
import type {
  AttackPath,
  Criteria,
  DiffEntry,
  FearedEvent,
  GraphNode,
  Matrix,
  OperationalScenario,
  Referential,
  RiskLevelDef,
  RiskRecord,
  ScaleLevel,
  SrovPair,
  Stakeholder,
  StrategicScenario,
  StudyData,
  StudySettings,
} from "./types.js";
import { uid } from "./defaults.js";

// ─────────────────────────── utilitaires ───────────────────────────

export interface Derived<T = number> {
  computed: T | null;
  forced: T | null;
  value: T | null;
}

function derived<T>(computed: T | null, forced: T | null | undefined): Derived<T> {
  const f = forced ?? null;
  return { computed, forced: f, value: f ?? computed };
}

export function level(scale: ScaleLevel[], value: number | null | undefined): ScaleLevel | undefined {
  if (value === null || value === undefined) return undefined;
  return scale.find((l) => l.value === value);
}

export function levelLabel(scale: ScaleLevel[], value: number | null | undefined, withValue = true): string {
  const l = level(scale, value);
  if (!l) return value === null || value === undefined ? "—" : String(value);
  return withValue ? `${l.value} – ${l.label}` : l.label;
}

export function scaleBounds(scale: ScaleLevel[]): { min: number; max: number } {
  const values = scale.map((l) => l.value);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function clampToScale(scale: ScaleLevel[], v: number): number {
  const { min, max } = scaleBounds(scale);
  return Math.max(min, Math.min(max, v));
}

export function lookup(m: Matrix, row: number | null | undefined, col: number | null | undefined): number | null {
  if (row === null || row === undefined || col === null || col === undefined) return null;
  const v = m[String(row)]?.[String(col)];
  return v === undefined ? null : v;
}

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function nextRef(prefix: string, items: { ref: string }[]): string {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const i of items) {
    const m = re.exec(i.ref);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─────────────────────────── Atelier 1 ───────────────────────────

export type BaselineStatus = "applied" | "partial" | "not_applied" | null;

export function referentialStatus(ref: Referential): Derived<BaselineStatus> & { applied: number; total: number } {
  const relevant = ref.requirements.filter((r) => r.status !== "na");
  const evaluated = relevant.filter((r) => r.status !== "unknown");
  const applied = relevant.filter((r) => r.status === "applied").length;
  const partial = relevant.filter((r) => r.status === "partial").length;
  let computed: BaselineStatus = null;
  if (evaluated.length > 0) {
    if (applied === relevant.length) computed = "applied";
    else if (applied === 0 && partial === 0) computed = "not_applied";
    else computed = "partial";
  }
  const d = derived<BaselineStatus>(computed, ref.statusForced);
  return { ...d, applied: applied + partial * 0.5, total: relevant.length };
}

// ─────────────────────────── Atelier 2 ───────────────────────────

export function pertinence(settings: StudySettings, pair: SrovPair): Derived {
  let computed = lookup(settings.pertinenceMatrix, pair.resources, pair.motivation);
  if (computed !== null && settings.useActivityInPertinence && pair.activity !== null) {
    const { min: amin, max: amax } = scaleBounds(settings.scales.activity);
    const mid = (amin + amax) / 2;
    const delta = pair.activity > mid + 0.5 ? 1 : pair.activity < mid - 0.5 ? -1 : 0;
    computed = clampToScale(settings.scales.pertinence, computed + delta);
  }
  return derived(computed, pair.pertinenceForced);
}

/** Gravité héritée par un objectif visé : max des gravités des ER associés (guide p.40). */
export function srovGravity(data: StudyData, pair: SrovPair): number | null {
  const fe = byId(data.fearedEvents);
  let g: number | null = null;
  for (const id of pair.fearedEventIds) {
    const v = fe.get(id)?.gravity ?? null;
    if (v !== null && (g === null || v > g)) g = v;
  }
  return g;
}

// ─────────────────────────── Atelier 3 ───────────────────────────

export type Zone = "danger" | "control" | "watch" | "out";

export function dangerosity(settings: StudySettings, c: Criteria): number | null {
  const { dependency, penetration, maturity, trust } = c;
  const w = settings.dangerosity.weights;
  const parts: [number | null, number][] = [
    [dependency, w.dependency],
    [penetration, w.penetration],
    [maturity, w.maturity],
    [trust, w.trust],
  ];
  if (parts.some(([v, wt]) => wt !== 0 && (v === null || v <= 0))) return null;
  const pow = (v: number | null, wt: number) => (wt === 0 ? 1 : Math.pow(v as number, wt));
  const num = pow(dependency, w.dependency) * pow(penetration, w.penetration);
  const den = pow(maturity, w.maturity) * pow(trust, w.trust);
  return Math.round((num / den) * 100) / 100;
}

export function zone(settings: StudySettings, d: number | null): Zone | null {
  if (d === null) return null;
  const t = settings.dangerosity.thresholds;
  if (d >= t.danger) return "danger";
  if (d >= t.control) return "control";
  if (d >= t.watch) return "watch";
  return "out";
}

export const ZONE_LABELS: Record<Zone, string> = {
  danger: "Zone de danger",
  control: "Zone de contrôle",
  watch: "Zone de veille",
  out: "Hors périmètre",
};

export function residualCriteria(s: Stakeholder): Criteria {
  const r = s.residualCriteria;
  return {
    dependency: r.dependency ?? s.criteria.dependency,
    penetration: r.penetration ?? s.criteria.penetration,
    maturity: r.maturity ?? s.criteria.maturity,
    trust: r.trust ?? s.criteria.trust,
  };
}

export interface StakeholderEval {
  initial: Derived;
  residual: Derived;
  exposure: number | null;
  reliability: number | null;
  residualExposure: number | null;
  residualReliability: number | null;
  zone: Zone | null;
  residualZone: Zone | null;
  suggestedCritical: boolean;
  critical: boolean;
}

export function evaluateStakeholder(settings: StudySettings, s: Stakeholder): StakeholderEval {
  const initial = derived(dangerosity(settings, s.criteria), s.dangerForced);
  const rc = residualCriteria(s);
  const residual = derived(dangerosity(settings, rc), s.residualForced);
  const z = zone(settings, initial.value);
  const suggestedCritical = z === "danger" || z === "control";
  const prod = (a: number | null, b: number | null) => (a === null || b === null ? null : a * b);
  return {
    initial,
    residual,
    exposure: prod(s.criteria.dependency, s.criteria.penetration),
    reliability: prod(s.criteria.maturity, s.criteria.trust),
    residualExposure: prod(rc.dependency, rc.penetration),
    residualReliability: prod(rc.maturity, rc.trust),
    zone: z,
    residualZone: zone(settings, residual.value),
    suggestedCritical,
    critical: s.critical ?? suggestedCritical,
  };
}

/** Seuils proposés par la fiche 5 à défaut d'arbitrage : 10 % / 40 % / 40 % / 10 %. */
export function suggestThresholds(values: number[]): { watch: number; control: number; danger: number } | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => b - a);
  if (v.length < 3) return null;
  const at = (ratio: number) => v[Math.min(v.length - 1, Math.max(0, Math.ceil(v.length * ratio) - 1))];
  return { danger: at(0.1), control: at(0.5), watch: at(0.9) };
}

export const ECOSYSTEM_RECOMMENDATIONS: Record<Zone, { acceptability: string; actions: string }> = {
  danger: {
    acceptability: "Inacceptable",
    actions: "Aucune partie prenante ne devrait se situer dans cette zone : réduction du risque ou refus d'établir l'interaction.",
  },
  control: {
    acceptability: "Tolérable sous contrôle",
    actions: "Enrôlement dans le processus de management du risque : surveillance particulière (voire accrue en termes de cyberdéfense), audit de sécurité technique et organisationnel, réduction ou transfert du risque dans le cadre du plan de traitement.",
  },
  watch: { acceptability: "Acceptable en l'état", actions: "Sans objet (menace résiduelle) : veille." },
  out: { acceptability: "Négligeable", actions: "Hors périmètre." },
};

export function strategicGravity(data: StudyData, ss: StrategicScenario): Derived {
  const fe = byId(data.fearedEvents);
  let g: number | null = null;
  for (const p of ss.paths) {
    for (const st of p.steps) {
      if (st.kind === "feared" && st.fearedEventId) {
        const v = fe.get(st.fearedEventId)?.gravity ?? null;
        if (v !== null && (g === null || v > g)) g = v;
      }
    }
  }
  if (g === null) {
    const pair = data.srovPairs.find((p) => p.id === ss.srovId);
    if (pair) g = srovGravity(data, pair);
  }
  return derived(g, ss.gravityForced);
}

// ─────────────────────────── Atelier 4 ───────────────────────────

export interface NodeEval {
  /** Indice de probabilité cumulé (standard / avancée). */
  pr: number | null;
  /** Indice de difficulté cumulé du mode le plus vraisemblable (avancée). */
  diff: number | null;
  /** Vraisemblance cumulée (avancée : croisement du meilleur couple). */
  likelihood: number | null;
}

export interface GraphEval {
  method: StudySettings["likelihoodMethod"];
  nodes: Record<string, NodeEval>;
  likelihood: number | null;
  criticalNodeIds: string[];
  criticalEdgeIds: string[];
  /** AE du mode opératoire le plus vraisemblable, triées de la plus facile à la plus difficile. */
  criticalActions: string[];
  pathLength: number;
  corrected: boolean;
  warnings: string[];
}

interface Pair {
  p: number;
  d: number;
  /** Provenance : (nœud, index du couple) des prédécesseurs retenus. */
  from: { node: string; idx: number; edge: string }[];
}

function pareto(pairs: Pair[]): Pair[] {
  const out: Pair[] = [];
  for (const a of pairs) {
    if (pairs.some((b) => b !== a && b.p >= a.p && b.d <= a.d && (b.p > a.p || b.d < a.d))) continue;
    if (out.some((b) => b.p === a.p && b.d === a.d)) continue;
    out.push(a);
  }
  return out;
}

function topoOrder(nodes: GraphNode[], edges: { id: string; source: string; target: string }[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const valid = edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target);
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of valid) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift() as string;
    order.push(id);
    for (const e of valid) {
      if (e.source !== id) continue;
      const d = (indeg.get(e.target) ?? 0) - 1;
      indeg.set(e.target, d);
      if (d === 0) queue.push(e.target);
    }
  }
  const cyclic = order.length !== nodes.length;
  const inOrder = new Set(order);
  return { order, cyclic, valid: valid.filter((e) => inOrder.has(e.source) && inOrder.has(e.target)) };
}

/**
 * Évalue un graphe d'attaque selon la fiche méthode 8.
 * - standard : Pr_cumulé(AE) = min(Pr(AE), max(Pr_cumulés des prédécesseurs)) ; OU = max ; ET = min.
 * - avancée : propagation exacte de fronts de Pareto (Pr, D) : un mode opératoire ne croise
 *   jamais la probabilité d'un mode avec la difficulté d'un autre ; ET combine les branches
 *   (min Pr, max D) ; vraisemblance = max du croisement Pr × D sur les modes aboutissant à l'objectif.
 */
export function evaluateGraph(settings: StudySettings, os: OperationalScenario, forceMethod?: "standard" | "advanced"): GraphEval {
  const method = forceMethod ?? (settings.likelihoodMethod === "express" ? "standard" : settings.likelihoodMethod);
  const warnings: string[] = [];
  const nodes = os.nodes;
  const nodeMap = byId(nodes);
  const { order, cyclic, valid } = topoOrder(nodes, os.edges);
  if (cyclic) warnings.push("Le graphe contient un cycle : les nœuds concernés sont ignorés.");
  const incoming = new Map<string, { node: string; edge: string }[]>();
  for (const e of valid) {
    const list = incoming.get(e.target) ?? [];
    list.push({ node: e.source, edge: e.id });
    incoming.set(e.target, list);
  }
  const goals = nodes.filter((n) => n.type === "goal");
  const sinks = goals.length
    ? goals.map((g) => g.id)
    : order.filter((id) => !valid.some((e) => e.source === id));
  if (!goals.length && nodes.length) warnings.push("Aucun nœud « objectif visé » : les actions terminales sont utilisées comme étape finale.");

  const res: Record<string, NodeEval> = {};
  const sets = new Map<string, Pair[]>();
  const missing = new Set<string>();

  for (const id of order) {
    const n = nodeMap.get(id) as GraphNode;
    const preds = incoming.get(id) ?? [];
    let pairs: Pair[] = [];
    if (n.type === "action") {
      const P = n.probability;
      const D = method === "advanced" ? n.difficulty : 0;
      if (P === null || D === null) {
        missing.add(id);
      } else if (preds.length === 0) {
        pairs = [{ p: P, d: D, from: [] }];
      } else {
        for (const pr of preds) {
          (sets.get(pr.node) ?? []).forEach((q, idx) =>
            pairs.push({ p: Math.min(P, q.p), d: Math.max(D, q.d), from: [{ node: pr.node, idx, edge: pr.edge }] }),
          );
        }
      }
    } else if (n.type === "and") {
      const inputs = preds.map((pr) => ({ pr, s: sets.get(pr.node) ?? [] }));
      if (inputs.length && inputs.every((i) => i.s.length)) {
        let acc: Pair[] = [{ p: Infinity, d: -Infinity, from: [] }];
        for (const { pr, s } of inputs) {
          const next: Pair[] = [];
          for (const a of acc)
            s.forEach((b, idx) =>
              next.push({ p: Math.min(a.p, b.p), d: Math.max(a.d, b.d), from: [...a.from, { node: pr.node, idx, edge: pr.edge }] }),
            );
          acc = pareto(next);
        }
        pairs = acc;
      }
    } else {
      // OU et objectif : union des modes entrants.
      for (const pr of preds) (sets.get(pr.node) ?? []).forEach((q, idx) => pairs.push({ p: q.p, d: q.d, from: [{ node: pr.node, idx, edge: pr.edge }] }));
    }
    pairs = pareto(pairs);
    if (method === "standard") {
      // En standard, seule la probabilité compte : on ne garde que le meilleur Pr.
      const best = pairs.reduce<Pair | null>((b, q) => (b === null || q.p > b.p ? q : b), null);
      pairs = best ? [best] : [];
    }
    sets.set(id, pairs);
    const best = bestPair(settings, method, pairs);
    res[id] = {
      pr: pairs.length ? Math.max(...pairs.map((q) => q.p)) : null,
      diff: best && method === "advanced" ? best.d : null,
      likelihood: best ? pairLikelihood(settings, method, best) : null,
    };
  }
  if (missing.size) {
    warnings.push(
      method === "advanced"
        ? `${missing.size} action(s) élémentaire(s) sans probabilité de succès ou difficulté technique.`
        : `${missing.size} action(s) élémentaire(s) sans probabilité de succès.`,
    );
  }

  // Étape finale : meilleur couple parmi les puits.
  let finalBest: { node: string; idx: number; pair: Pair } | null = null;
  for (const s of sinks) {
    (sets.get(s) ?? []).forEach((pair, idx) => {
      if (!finalBest || comparePairs(settings, method, pair, finalBest.pair) > 0) finalBest = { node: s, idx, pair };
    });
  }

  const criticalNodes = new Set<string>();
  const criticalEdges = new Set<string>();
  let pathLength = 0;
  if (finalBest) {
    const fb = finalBest as { node: string; idx: number; pair: Pair };
    const stack: { node: string; idx: number }[] = [{ node: fb.node, idx: fb.idx }];
    while (stack.length) {
      const { node, idx } = stack.pop() as { node: string; idx: number };
      if (criticalNodes.has(node)) continue;
      criticalNodes.add(node);
      const pair = sets.get(node)?.[idx];
      if (!pair) continue;
      for (const f of pair.from) {
        criticalEdges.add(f.edge);
        stack.push({ node: f.node, idx: f.idx });
      }
    }
    pathLength = [...criticalNodes].filter((id) => nodeMap.get(id)?.type === "action").length;
  }

  let likelihood: number | null = null;
  let corrected = false;
  if (finalBest) {
    const fb = finalBest as { pair: Pair };
    let pair = fb.pair;
    if (settings.longChainThreshold > 0 && pathLength >= settings.longChainThreshold) {
      corrected = true;
      pair =
        method === "advanced"
          ? { ...pair, d: clampToScale(settings.scales.difficulty, pair.d + 1) }
          : { ...pair, p: clampToScale(settings.scales.probability, pair.p - 1) };
    }
    likelihood = pairLikelihood(settings, method, pair);
    if (method === "advanced" && os.determinedSource && likelihood !== null) {
      likelihood = clampToScale(settings.scales.likelihood, likelihood + 1);
    }
  }
  if (missing.size && likelihood !== null) {
    // Des AE non cotées peuvent changer le résultat : on le signale sans l'invalider.
  }

  const criticalActions = [...criticalNodes]
    .map((id) => nodeMap.get(id) as GraphNode)
    .filter((n) => n && n.type === "action")
    .sort((a, b) => (b.probability ?? -1) - (a.probability ?? -1) || (a.difficulty ?? 99) - (b.difficulty ?? 99))
    .map((n) => n.id);

  return {
    method,
    nodes: res,
    likelihood,
    criticalNodeIds: [...criticalNodes],
    criticalEdgeIds: [...criticalEdges],
    criticalActions,
    pathLength,
    corrected,
    warnings,
  };
}

function pairLikelihood(settings: StudySettings, method: string, pair: Pair): number | null {
  if (method === "advanced") return lookup(settings.likelihoodCross, pair.p, pair.d);
  // Méthode standard : la vraisemblance correspond à l'indice global de probabilité de succès.
  return clampToScale(settings.scales.likelihood, pair.p);
}

function comparePairs(settings: StudySettings, method: string, a: Pair, b: Pair): number {
  const la = pairLikelihood(settings, method, a) ?? -1;
  const lb = pairLikelihood(settings, method, b) ?? -1;
  if (la !== lb) return la - lb;
  if (a.p !== b.p) return a.p - b.p;
  return b.d - a.d;
}

function bestPair(settings: StudySettings, method: string, pairs: Pair[]): Pair | null {
  let best: Pair | null = null;
  for (const p of pairs) if (!best || comparePairs(settings, method, p, best) > 0) best = p;
  return best;
}

export interface OpLikelihood extends Derived {
  source: "forced" | "express" | "graph" | "modes" | "pertinence" | "none";
  graph: GraphEval | null;
}

export function operationalLikelihood(data: StudyData, os: OperationalScenario): OpLikelihood {
  const s = data.settings;
  let computed: number | null = null;
  let source: OpLikelihood["source"] = "none";
  let graph: GraphEval | null = null;
  if (s.likelihoodMethod === "express") {
    if (os.expressLikelihood !== null) {
      computed = os.expressLikelihood;
      source = "express";
    } else if (os.expressProbability !== null && os.expressDifficulty !== null) {
      computed = lookup(s.likelihoodCross, os.expressProbability, os.expressDifficulty);
      source = "express";
    } else {
      const modes = os.operatingModes.map((m) => m.likelihood).filter((v): v is number => v !== null);
      if (modes.length) {
        computed = Math.max(...modes);
        source = "modes";
      }
    }
  } else {
    graph = evaluateGraph(s, os);
    computed = graph.likelihood;
    source = computed === null ? "none" : "graph";
  }
  const d = derived(computed, os.likelihoodForced);
  return { ...d, source: d.forced !== null ? "forced" : source, graph };
}

// ─────────────────────────── Atelier 5 ───────────────────────────

export function riskLevel(settings: StudySettings, g: number | null, v: number | null): number | null {
  return lookup(settings.riskMatrix, g, v);
}

export function riskLevelDef(settings: StudySettings, lvl: number | null): RiskLevelDef | undefined {
  if (lvl === null) return undefined;
  return settings.scales.riskLevels.find((l) => l.value === lvl);
}

/** Aligne les enregistrements de risque sur les chemins d'attaque et les ER non intentionnels. */
export function syncRisks(data: StudyData): RiskRecord[] {
  const out: RiskRecord[] = [];
  const existingByPath = new Map(data.risks.filter((r) => r.attackPathId).map((r) => [r.attackPathId as string, r]));
  const existingByFe = new Map(data.risks.filter((r) => !r.attackPathId && r.fearedEventId).map((r) => [r.fearedEventId as string, r]));
  const used = new Set<string>();
  const all = [...data.risks];
  const make = (partial: Partial<RiskRecord>): RiskRecord => {
    const r: RiskRecord = {
      id: uid(),
      ref: nextRef("R", all),
      attackPathId: null,
      fearedEventId: null,
      title: "",
      gravityForced: null,
      likelihoodForced: null,
      treatment: null,
      acceptabilityForced: null,
      residualGravity: null,
      residualLikelihood: null,
      residualDoc: { description: "", vulnerabilities: "", aggravatingFactors: "", management: "" },
      excluded: false,
      ...partial,
    };
    all.push(r);
    return r;
  };
  const sources = byId(data.riskSources);
  for (const ss of data.strategicScenarios) {
    const pair = data.srovPairs.find((p) => p.id === ss.srovId);
    const srName = pair ? sources.get(pair.riskSourceId)?.name ?? "" : "";
    for (const path of ss.paths) {
      const existing = existingByPath.get(path.id);
      if (existing) {
        out.push(existing);
        used.add(existing.id);
      } else if (path.retained) {
        out.push(make({ attackPathId: path.id, title: [srName, path.name].filter(Boolean).join(" — ") }));
      }
    }
  }
  for (const fe of data.fearedEvents) {
    if (fe.businessValueId !== null) continue;
    const existing = existingByFe.get(fe.id);
    if (existing) {
      out.push(existing);
      used.add(existing.id);
    } else {
      out.push(make({ fearedEventId: fe.id, title: fe.name }));
    }
  }
  return out;
}

export interface RiskRow {
  record: RiskRecord;
  kind: "intentional" | "unintentional";
  path: AttackPath | null;
  scenario: StrategicScenario | null;
  pair: SrovPair | null;
  riskSourceName: string;
  objective: string;
  operational: OperationalScenario | null;
  fearedEvents: FearedEvent[];
  businessValueIds: string[];
  stakeholderIds: string[];
  gravity: Derived;
  likelihood: Derived & { source: OpLikelihood["source"] };
  level: number | null;
  acceptability: number | null;
  residualGravity: number | null;
  residualLikelihood: number | null;
  residualLevel: number | null;
  measureIds: string[];
  active: boolean;
}

export function riskRows(data: StudyData): RiskRow[] {
  const s = data.settings;
  const pathIndex = new Map<string, { path: AttackPath; ss: StrategicScenario }>();
  for (const ss of data.strategicScenarios) for (const p of ss.paths) pathIndex.set(p.id, { path: p, ss });
  const pairs = byId(data.srovPairs);
  const sources = byId(data.riskSources);
  const fes = byId(data.fearedEvents);
  const opByPath = new Map(data.operationalScenarios.map((o) => [o.attackPathId, o]));
  const ws4 = data.framing.workshopsEnabled[4];

  return data.risks.map((record) => {
    const ix = record.attackPathId ? pathIndex.get(record.attackPathId) ?? null : null;
    const path = ix?.path ?? null;
    const scenario = ix?.ss ?? null;
    const pair = scenario ? pairs.get(scenario.srovId) ?? null : null;
    const operational = path ? opByPath.get(path.id) ?? null : null;
    let fearedEvents: FearedEvent[] = [];
    const stakeholderIds: string[] = [];
    if (path) {
      for (const st of path.steps) {
        if (st.kind === "feared" && st.fearedEventId && fes.get(st.fearedEventId)) fearedEvents.push(fes.get(st.fearedEventId) as FearedEvent);
        if (st.kind === "intermediate" && st.stakeholderId) stakeholderIds.push(st.stakeholderId);
      }
      if (!fearedEvents.length && pair) fearedEvents = pair.fearedEventIds.map((id) => fes.get(id)).filter(Boolean) as FearedEvent[];
    } else if (record.fearedEventId && fes.get(record.fearedEventId)) {
      fearedEvents = [fes.get(record.fearedEventId) as FearedEvent];
    }

    let gComputed: number | null = null;
    let vComputed: number | null = null;
    let vSource: OpLikelihood["source"] = "none";
    if (scenario) {
      gComputed = strategicGravity(data, scenario).value;
      if (operational && ws4) {
        const ol = operationalLikelihood(data, operational);
        vComputed = ol.value;
        vSource = ol.source;
      }
      if (vComputed === null && pair) {
        // EXI_M3_16 : sans atelier 4, la pertinence du couple SR/OV donne la vraisemblance.
        const p = pertinence(s, pair).value;
        if (p !== null) {
          vComputed = clampToScale(s.scales.likelihood, p);
          vSource = "pertinence";
        }
      }
    } else if (fearedEvents[0]) {
      gComputed = fearedEvents[0].gravity;
      vComputed = fearedEvents[0].expressLikelihood;
      vSource = vComputed === null ? "none" : "express";
    }
    const gravity = derived(gComputed, record.gravityForced);
    const lk = derived(vComputed, record.likelihoodForced);
    const likelihood = { ...lk, source: lk.forced !== null ? ("forced" as const) : vSource };
    const lvl = riskLevel(s, gravity.value, likelihood.value);
    const rg = record.residualGravity ?? gravity.value;
    const rv = record.residualLikelihood ?? likelihood.value;
    return {
      record,
      kind: path ? "intentional" : "unintentional",
      path,
      scenario,
      pair,
      riskSourceName: pair ? sources.get(pair.riskSourceId)?.name ?? "" : "",
      objective: pair?.objective ?? "",
      operational,
      fearedEvents,
      businessValueIds: [...new Set(fearedEvents.map((f) => f.businessValueId).filter((x): x is string => !!x))],
      stakeholderIds: [...new Set(stakeholderIds)],
      gravity,
      likelihood,
      level: lvl,
      acceptability: record.acceptabilityForced ?? lvl,
      residualGravity: rg,
      residualLikelihood: rv,
      residualLevel: riskLevel(s, rg, rv),
      measureIds: data.measures.filter((m) => m.riskIds.includes(record.id)).map((m) => m.id),
      active: !record.excluded && (path ? path.retained : true),
    };
  });
}

/** Couverture ER ↔ scénarios de risque (EXI_M5_03). */
export function coverage(data: StudyData, rows = riskRows(data)): { fearedEvent: FearedEvent; riskIds: string[] }[] {
  return data.fearedEvents.map((fe) => ({
    fearedEvent: fe,
    riskIds: rows.filter((r) => r.active && r.fearedEvents.some((f) => f.id === fe.id)).map((r) => r.record.id),
  }));
}

// ─────────────────────────── avancement ───────────────────────────

export interface Progress {
  key: string;
  workshop: number;
  label: string;
  ratio: number;
  hint: string;
}

const ratio = (ok: number, total: number) => (total === 0 ? 0 : Math.min(1, ok / total));

export function progress(data: StudyData): Progress[] {
  const f = data.framing;
  const pairs = data.srovPairs;
  const retained = pairs.filter((p) => p.retained);
  const paths = data.strategicScenarios.flatMap((s) => s.paths.filter((p) => p.retained));
  const rows = riskRows(data).filter((r) => r.active);
  const critical = data.stakeholders.filter((s) => evaluateStakeholder(data.settings, s).critical);
  const cadre = [!!f.subject.trim(), !!stripHtml(f.objectives), f.participants.length > 0, !!f.riskOwnerId];
  return [
    { key: "a1-cadre", workshop: 1, label: "Cadre de l'étude", ratio: ratio(cadre.filter(Boolean).length, 4), hint: "Objet, objectifs, participants et responsable de l'acceptation des risques." },
    {
      key: "a1-perimetre", workshop: 1, label: "Périmètre métier et technique",
      ratio: data.businessValues.length === 0 ? 0 : (Number(data.missions.length > 0) + ratio(data.businessValues.filter((b) => data.supportingAssets.some((a) => a.businessValueIds.includes(b.id))).length, data.businessValues.length) * 2) / 3,
      hint: "Missions, valeurs métier et biens supports associés.",
    },
    { key: "a1-er", workshop: 1, label: "Événements redoutés", ratio: data.businessValues.length === 0 ? 0 : (ratio(data.businessValues.filter((b) => data.fearedEvents.some((e) => e.businessValueId === b.id)).length, data.businessValues.length) + ratio(data.fearedEvents.filter((e) => e.gravity !== null).length, data.fearedEvents.length)) / 2, hint: "Au moins un ER coté par valeur métier." },
    {
      key: "a1-socle", workshop: 1, label: "Socle de sécurité",
      ratio: (() => {
        const reqs = data.baseline.referentials.flatMap((r) => r.requirements);
        return reqs.length === 0 ? 0 : ratio(reqs.filter((r) => r.status !== "unknown").length, reqs.length);
      })(),
      hint: "État d'application de chaque exigence.",
    },
    { key: "a2-couples", workshop: 2, label: "Couples SR/OV", ratio: pairs.length === 0 ? 0 : ratio(pairs.filter((p) => pertinence(data.settings, p).value !== null).length, pairs.length), hint: "Pertinence évaluée pour chaque couple." },
    { key: "a2-selection", workshop: 2, label: "Sélection et croisement ER", ratio: retained.length === 0 ? 0 : ratio(retained.filter((p) => p.fearedEventIds.length > 0).length, retained.length), hint: "Couples retenus reliés à au moins un ER." },
    { key: "a3-ecosysteme", workshop: 3, label: "Cartographie de l'écosystème", ratio: data.stakeholders.length === 0 ? 0 : ratio(data.stakeholders.filter((s) => dangerosity(data.settings, s.criteria) !== null || s.dangerForced !== null).length, data.stakeholders.length), hint: "Critères D/P/M/C cotés pour chaque partie prenante." },
    { key: "a3-scenarios", workshop: 3, label: "Scénarios stratégiques", ratio: retained.length === 0 ? 0 : ratio(retained.filter((p) => data.strategicScenarios.some((s) => s.srovId === p.id && s.paths.length > 0)).length, retained.length), hint: "Un scénario avec au moins un chemin par couple retenu." },
    { key: "a3-mesures", workshop: 3, label: "Mesures sur l'écosystème", ratio: critical.length === 0 ? (data.stakeholders.length ? 1 : 0) : ratio(critical.filter((s) => data.measures.some((m) => m.stakeholderIds.includes(s.id)) || Object.values(s.residualCriteria).some((v) => v !== null)).length, critical.length), hint: "Mesures ou niveaux cibles pour chaque partie prenante critique." },
    { key: "a4-scenarios", workshop: 4, label: "Scénarios opérationnels", ratio: paths.length === 0 ? 0 : ratio(paths.filter((p) => { const o = data.operationalScenarios.find((x) => x.attackPathId === p.id); return !!o && operationalLikelihood(data, o).value !== null; }).length, paths.length), hint: "Vraisemblance établie pour chaque chemin d'attaque retenu." },
    { key: "a5-synthese", workshop: 5, label: "Synthèse des risques", ratio: rows.length === 0 ? 0 : ratio(rows.filter((r) => r.level !== null).length, rows.length), hint: "Gravité et vraisemblance de chaque scénario de risque." },
    { key: "a5-traitement", workshop: 5, label: "Stratégie et plan de traitement", ratio: rows.length === 0 ? 0 : ratio(rows.filter((r) => r.record.treatment !== null).length, rows.length), hint: "Option de traitement décidée pour chaque risque." },
    { key: "a5-residuels", workshop: 5, label: "Risques résiduels", ratio: rows.length === 0 ? 0 : ratio(rows.filter((r) => r.record.residualGravity !== null || r.record.residualLikelihood !== null || r.record.treatment === "accept").length, rows.length), hint: "Réévaluation après mesures." },
    { key: "a5-suivi", workshop: 5, label: "Cadre de suivi", ratio: (Number(data.monitoring.indicators.length > 0) + Number(!!data.monitoring.nextCommitteeDate) + Number(data.monitoring.triggers.length > 0)) / 3, hint: "Indicateurs, comité de pilotage et déclencheurs." },
  ];
}

// ─────────────────────────── diff de versions ───────────────────────────

const COLLECTIONS: { path: (d: StudyData) => { id: string }[] | object; workshop: number; activity: string }[] = [
  { path: (d) => [{ id: "framing", ...d.framing }], workshop: 1, activity: "Cadre de l'étude" },
  { path: (d) => d.missions, workshop: 1, activity: "Missions" },
  { path: (d) => d.businessValues, workshop: 1, activity: "Valeurs métier" },
  { path: (d) => d.supportingAssets, workshop: 1, activity: "Biens supports" },
  { path: (d) => d.fearedEvents, workshop: 1, activity: "Événements redoutés" },
  { path: (d) => d.baseline.referentials, workshop: 1, activity: "Socle de sécurité" },
  { path: (d) => d.riskSources, workshop: 2, activity: "Sources de risque" },
  { path: (d) => d.srovPairs, workshop: 2, activity: "Couples SR/OV" },
  { path: (d) => d.stakeholders, workshop: 3, activity: "Parties prenantes" },
  { path: (d) => d.strategicScenarios, workshop: 3, activity: "Scénarios stratégiques" },
  { path: (d) => d.operationalScenarios, workshop: 4, activity: "Scénarios opérationnels" },
  { path: (d) => d.risks, workshop: 5, activity: "Scénarios de risque" },
  { path: (d) => d.measures, workshop: 5, activity: "Mesures de sécurité" },
  { path: (d) => [{ id: "monitoring", ...d.monitoring }], workshop: 5, activity: "Cadre de suivi" },
  { path: (d) => [{ id: "settings", ...d.settings }], workshop: 0, activity: "Paramètres et métriques" },
];

export function diffStudies(before: StudyData, after: StudyData): DiffEntry[] {
  const out: DiffEntry[] = [];
  for (const c of COLLECTIONS) {
    const a = c.path(before) as { id: string }[];
    const b = c.path(after) as { id: string }[];
    const am = new Map(a.map((x) => [x.id, JSON.stringify(x)]));
    const bm = new Map(b.map((x) => [x.id, JSON.stringify(x)]));
    let added = 0;
    let modified = 0;
    let removed = 0;
    for (const [id, v] of bm) {
      if (!am.has(id)) added++;
      else if (am.get(id) !== v) modified++;
    }
    for (const id of am.keys()) if (!bm.has(id)) removed++;
    if (added || modified || removed) out.push({ workshop: c.workshop, activity: c.activity, added, modified, removed });
  }
  return out;
}
