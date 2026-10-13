import { describe, expect, it } from "vitest";
import {
  dangerosity,
  defaultSettings,
  diffStudies,
  emptyStudy,
  evaluateGraph,
  evaluateStakeholder,
  exampleStudy,
  integrityIssues,
  operationalLikelihood,
  pertinence,
  progress,
  riskRows,
  studyDataSchema,
  suggestThresholds,
  syncRisks,
  zone,
  coverage,
  referentialStatus,
  uid,
  type GraphNode,
  type OperationalScenario,
} from "../src/index.js";

describe("atelier 2 — pertinence (fiche 4)", () => {
  const s = defaultSettings(4);
  const pair = (motivation: number, resources: number) =>
    ({ motivation, resources, activity: null, pertinenceForced: null }) as never;
  it("reproduit la grille motivation × ressources", () => {
    expect(pertinence(s, pair(1, 4)).value).toBe(2); // Maximales / Faible → Moyen
    expect(pertinence(s, pair(3, 3)).value).toBe(3); // Importantes / Importante → Élevé
    expect(pertinence(s, pair(2, 2)).value).toBe(1); // Significatives / Significative → Faible
    expect(pertinence(s, pair(4, 1)).value).toBe(2); // Faibles / Maximale → Moyen
  });
  it("respecte la valeur forcée", () => {
    const p = pertinence(s, { motivation: 1, resources: 1, activity: null, pertinenceForced: 3 } as never);
    expect(p.computed).toBe(1);
    expect(p.value).toBe(3);
  });
});

describe("atelier 3 — dangerosité (fiche 5)", () => {
  const s = defaultSettings(4);
  const c = (dependency: number, penetration: number, maturity: number, trust: number) => ({ dependency, penetration, maturity, trust });
  it("calcule (D × P) / (M × C) comme l'exemple du guide", () => {
    expect(dangerosity(s, c(3, 3, 2, 2))).toBe(2.25); // P3 Laboratoires
    expect(dangerosity(s, c(3, 4, 2, 2))).toBe(3); // F3 Prestataire informatique
    expect(dangerosity(s, c(4, 3, 2, 3))).toBe(2); // F2
    expect(dangerosity(s, c(4, 2, 2, 3))).toBe(1.33); // F1
    expect(dangerosity(s, c(1, 1, 2, 3))).toBe(0.17); // C2
  });
  it("classe dans les zones de l'exemple (0,2 / 0,9 / 2,5)", () => {
    expect(zone(s, 3)).toBe("danger");
    expect(zone(s, 2.25)).toBe("control");
    expect(zone(s, 0.33)).toBe("watch");
    expect(zone(s, 0.17)).toBe("out");
  });
  it("applique la pondération (exposant 0 = critère retiré)", () => {
    const w = { ...s, dangerosity: { ...s.dangerosity, weights: { dependency: 1, penetration: 1, maturity: 1, trust: 0 } } };
    expect(dangerosity(w, c(3, 4, 2, 1))).toBe(6);
  });
  it("renvoie null si un critère manque", () => {
    expect(dangerosity(s, { dependency: 3, penetration: null, maturity: 2, trust: 2 })).toBeNull();
  });
  it("calcule la dangerosité résiduelle à partir des niveaux cibles", () => {
    const d = exampleStudy();
    const f2 = d.stakeholders.find((x) => x.ref === "F2")!;
    const f3 = d.stakeholders.find((x) => x.ref === "F3")!;
    const p3 = d.stakeholders.find((x) => x.ref === "P3")!;
    expect(evaluateStakeholder(d.settings, f2).residual.value).toBe(1.33);
    expect(evaluateStakeholder(d.settings, f3).residual.value).toBe(2);
    expect(evaluateStakeholder(d.settings, p3).residual.value).toBe(1.5);
    expect(evaluateStakeholder(d.settings, f3).critical).toBe(true);
    expect(evaluateStakeholder(d.settings, d.stakeholders.find((x) => x.ref === "P1")!).critical).toBe(false);
  });
  it("propose des seuils 10/40/40/10 %", () => {
    const t = suggestThresholds([3, 2.25, 2, 1.33, 1, 0.33, 0.33, 0.25, 0.17, 0.1])!;
    expect(t.danger).toBe(3);
    expect(t.control).toBe(1);
    expect(t.watch).toBe(0.17);
  });
});

function scenario(nodes: Partial<GraphNode>[], edges: [number, number][]): OperationalScenario {
  const full = nodes.map((n, i) => ({
    id: `n${i}`, type: "action", x: 0, y: 0, phaseId: null, label: `n${i}`, supportingAssetId: null, stakeholderId: null,
    catalogActionId: null, probability: null, difficulty: null, notes: "", ...n,
  })) as GraphNode[];
  return {
    id: "so", ref: "SO", attackPathId: "p", name: "", description: "", nodes: full,
    edges: edges.map(([a, b], i) => ({ id: `e${i}`, source: `n${a}`, target: `n${b}` })),
    operatingModes: [], expressLikelihood: null, expressProbability: null, expressDifficulty: null,
    determinedSource: false, likelihoodForced: null, justification: "",
  };
}

describe("atelier 4 — vraisemblance (fiche 8)", () => {
  it("méthode standard : exemple de la fiche 8 → 3 (très vraisemblable)", () => {
    const d = exampleStudy();
    const so1 = d.operationalScenarios[0];
    const g = evaluateGraph(d.settings, so1, "standard");
    expect(g.likelihood).toBe(3);
    const byLabel = (l: string) => g.nodes[so1.nodes.find((n) => n.label.startsWith(l))!.id];
    expect(byLabel("Corruption d'un prestataire").pr).toBe(2); // Pr 3 (2)
    expect(byLabel("Corruption d'un personnel").pr).toBe(1); // Pr 1 (1)
    expect(byLabel("Intrusion via un canal").pr).toBe(2); // Pr 2 (2)
    expect(byLabel("Reconnaissance interne").pr).toBe(3); // Pr 3 (3)
    expect(byLabel("Exploitation maliciel").pr).toBe(3); // Pr 4 (3)
    expect(g.criticalNodeIds.length).toBeGreaterThan(3);
  });

  it("vraisemblances globales de l'exemple (guide p.67) : V3, V2, V4, V2, V1", () => {
    const d = exampleStudy();
    const values = d.operationalScenarios.map((o) => operationalLikelihood(d, o).value);
    expect(values).toEqual([3, 2, 4, 2, 1]);
  });

  it("ET = min, OU = max", () => {
    const s = defaultSettings(4);
    const and = scenario(
      [{ probability: 4 }, { probability: 2 }, { type: "and" }, { probability: 4 }, { type: "goal" }],
      [[0, 2], [1, 2], [2, 3], [3, 4]],
    );
    expect(evaluateGraph(s, and, "standard").likelihood).toBe(2);
    const or = scenario(
      [{ probability: 4 }, { probability: 2 }, { type: "or" }, { probability: 4 }, { type: "goal" }],
      [[0, 2], [1, 2], [2, 3], [3, 4]],
    );
    expect(evaluateGraph(s, or, "standard").likelihood).toBe(4);
  });

  it("méthode avancée : ne croise pas Pr et D de modes différents", () => {
    const s = defaultSettings(5);
    // Mode A : Pr 4, D 4 → V1 ; mode B : Pr 1, D 0 → V2. Un croisement naïf (Pr max 4, D min 0) donnerait V4.
    const so = scenario(
      [{ probability: 4, difficulty: 4 }, { probability: 1, difficulty: 0 }, { type: "goal" }],
      [[0, 2], [1, 2]],
    );
    const g = evaluateGraph(s, so, "advanced");
    expect(g.likelihood).toBe(2);
    expect(g.criticalNodeIds).toContain("n1");
    expect(g.criticalNodeIds).not.toContain("n0");
  });

  it("méthode avancée : propagation Diff = max(D, min(préd.))", () => {
    const s = defaultSettings(5);
    const so = scenario(
      [{ probability: 3, difficulty: 1 }, { probability: 4, difficulty: 3 }, { probability: 3, difficulty: 0 }, { type: "goal" }],
      [[0, 2], [1, 2], [2, 3]],
    );
    const g = evaluateGraph(s, so, "advanced");
    // Chemin n0→n2 : (Pr 3, D 1) → V3 ; chemin n1→n2 : (Pr 3, D 3) → V2.
    expect(g.nodes.n2.diff).toBe(1);
    expect(g.likelihood).toBe(3);
  });

  it("bonus source déterminée et correction des chaînes longues", () => {
    const s = defaultSettings(5);
    const so = scenario([{ probability: 2, difficulty: 2 }, { type: "goal" }], [[0, 1]]);
    expect(evaluateGraph(s, so, "advanced").likelihood).toBe(2);
    expect(evaluateGraph(s, { ...so, determinedSource: true }, "advanced").likelihood).toBe(3);
    const chain = scenario(
      [...Array.from({ length: 10 }, () => ({ probability: 3 })), { type: "goal" as const }],
      Array.from({ length: 10 }, (_, i) => [i, i + 1] as [number, number]),
    );
    expect(evaluateGraph(s, chain, "standard").likelihood).toBe(3);
    expect(evaluateGraph({ ...s, longChainThreshold: 10 }, chain, "standard").likelihood).toBe(2);
  });

  it("ignore les cycles avec un avertissement", () => {
    const s = defaultSettings(4);
    const so = scenario([{ probability: 3 }, { probability: 3 }, { type: "goal" }], [[0, 1], [1, 0], [1, 2]]);
    const g = evaluateGraph(s, so, "standard");
    expect(g.warnings.join()).toMatch(/cycle/);
  });

  it("méthode expresse : directe, croisement ou max des modes", () => {
    const d = exampleStudy();
    d.settings.likelihoodMethod = "express";
    const so = d.operationalScenarios[0];
    expect(operationalLikelihood(d, so).value).toBe(3); // max des modes (3, 1, 2)
    expect(operationalLikelihood(d, { ...so, expressLikelihood: 1 }).value).toBe(1);
    expect(operationalLikelihood(d, { ...so, expressProbability: 4, expressDifficulty: 1 }).value).toBe(4);
  });
});

describe("atelier 5 — risques", () => {
  it("reproduit les niveaux de l'exemple (R1 élevé, R2 moyen, R3 élevé, R4 moyen, R5 moyen)", () => {
    const d = exampleStudy();
    const rows = riskRows(d);
    expect(rows.map((r) => [r.record.ref, r.gravity.value, r.likelihood.value, r.level])).toEqual([
      ["R1", 3, 3, 3],
      ["R2", 3, 2, 2],
      ["R3", 3, 4, 3],
      ["R4", 4, 2, 2],
      ["R5", 4, 1, 2],
    ]);
  });

  it("utilise la pertinence SR/OV sans atelier 4 (EXI_M3_16)", () => {
    const d = exampleStudy();
    d.framing.workshopsEnabled[4] = false;
    const r1 = riskRows(d)[0];
    expect(r1.likelihood.source).toBe("pertinence");
    expect(r1.likelihood.value).toBe(3);
  });

  it("synchronise les risques avec les chemins d'attaque et les ER non intentionnels", () => {
    const d = exampleStudy();
    d.fearedEvents.push({ id: uid(), ref: "ER8", businessValueId: null, name: "Incendie de la salle serveur", criteria: ["D"], impactCategoryIds: [], impacts: "", gravity: 3, justification: "", expressLikelihood: 1 });
    d.strategicScenarios[0].paths.push({ id: uid(), ref: "CA4", name: "Nouveau chemin", description: "", steps: [], retained: true });
    const risks = syncRisks(d);
    expect(risks).toHaveLength(7);
    expect(risks.map((r) => r.ref)).toContain("R7");
    d.risks = risks;
    const unintentional = riskRows(d).find((r) => r.kind === "unintentional")!;
    expect(unintentional.level).toBe(1);
  });

  it("détecte les ER non couverts", () => {
    const d = exampleStudy();
    const cov = coverage(d);
    const uncovered = cov.filter((c) => c.riskIds.length === 0).map((c) => c.fearedEvent.ref);
    expect(uncovered).toEqual(["ER1", "ER2", "ER4", "ER5", "ER7"]);
  });
});

describe("document", () => {
  it("l'exemple est valide et cohérent", () => {
    const d = exampleStudy();
    expect(studyDataSchema.safeParse(d).success).toBe(true);
    expect(integrityIssues(d)).toEqual([]);
    expect(studyDataSchema.safeParse(emptyStudy(5)).success).toBe(true);
  });
  it("calcule l'avancement", () => {
    const p = progress(exampleStudy());
    expect(p.find((x) => x.key === "a3-scenarios")!.ratio).toBe(1);
    expect(p.find((x) => x.key === "a4-scenarios")!.ratio).toBe(1);
    expect(progress(emptyStudy()).every((x) => x.ratio <= 1)).toBe(true);
  });
  it("calcule le diff entre versions", () => {
    const a = exampleStudy();
    const b = structuredClone(a);
    b.fearedEvents[0].gravity = 4;
    b.riskSources.pop();
    b.missions.push({ id: uid(), ref: "MI2", name: "x", description: "" });
    const diff = diffStudies(a, b);
    expect(diff).toContainEqual({ workshop: 1, activity: "Événements redoutés", added: 0, modified: 1, removed: 0 });
    expect(diff).toContainEqual({ workshop: 2, activity: "Sources de risque", added: 0, modified: 0, removed: 1 });
    expect(diff).toContainEqual({ workshop: 1, activity: "Missions", added: 1, modified: 0, removed: 0 });
  });
  it("statut d'un référentiel du socle", () => {
    const d = exampleStudy();
    expect(referentialStatus(d.baseline.referentials[0]).value).toBe("partial");
  });
});

import { normalizeStudy, cascadeImpact } from "../src/index.js";

describe("normalisation", () => {
  it("supprime en cascade les objets orphelins", () => {
    const before = exampleStudy();
    const d = structuredClone(before);
    // Suppression de la source « Concurrent » : couple OV2, SS1, 3 chemins, 3 SO, 3 risques.
    d.riskSources = d.riskSources.filter((s) => s.name !== "Concurrent");
    normalizeStudy(d);
    expect(d.srovPairs).toHaveLength(3);
    expect(d.strategicScenarios).toHaveLength(1);
    expect(d.operationalScenarios).toHaveLength(2);
    expect(d.risks).toHaveLength(2);
    expect(d.measures.every((m) => m.riskIds.every((id) => d.risks.some((r) => r.id === id)))).toBe(true);
    expect(integrityIssues(d)).toEqual([]);
    expect(cascadeImpact(before, d)).toContain("3 scénario(s) opérationnel(s)");
  });
  it("retire les étapes liées à une partie prenante supprimée", () => {
    const d = exampleStudy();
    d.stakeholders = d.stakeholders.filter((s) => s.ref !== "F3");
    normalizeStudy(d);
    const ca3 = d.strategicScenarios[0].paths[2];
    expect(ca3.steps).toHaveLength(1);
    expect(d.operationalScenarios[2].nodes.every((n) => n.stakeholderId === null)).toBe(true);
    expect(studyDataSchema.safeParse(d).success).toBe(true);
  });
});
