import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { fileURLToPath } from "node:url";
import { importAnssiTemplate, riskRows, studyDataSchema, workbookToGrid, type Grid } from "../src/index.js";

const TEMPLATE = fileURLToPath(new URL("../../docs/sources/EBIOS_RM_Ateliers_modele.xlsx", import.meta.url));

describe("import du modèle Excel ANSSI", () => {
  it("reprend l'exemple du modèle officiel", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    const grid = workbookToGrid(wb as never);
    // Les formules sans valeur en cache ne doivent pas produire de texte parasite.
    expect(JSON.stringify(grid)).not.toContain("[object Object]");
    const { data, report } = importAnssiTemplate(grid);
    expect(studyDataSchema.safeParse(data).success).toBe(true);
    expect(data.strategicScenarios).toHaveLength(1);
    const ss = data.strategicScenarios[0];
    expect(ss.gravityForced).toBe(3);
    expect(ss.paths.map((p) => p.name)).toEqual([
      "portant directement sur le SI de la R&D",
      "sur le SI du laboratoire (P3), qui détient une partie des travaux",
      "passant par le prestataire informatique F3.",
    ]);
    expect(ss.name.endsWith("données")).toBe(true);
    expect(data.operationalScenarios).toHaveLength(1);
    expect(data.operationalScenarios[0].expressLikelihood).toBe(3);
    const rows = riskRows(data);
    expect(rows.map((r) => r.record.ref)).toEqual(["R1", "R2", "R3"]);
    expect(rows.map((r) => r.likelihood.value)).toEqual([3, 2, 4]);
    expect(rows.every((r) => r.gravity.value === 3 && r.record.treatment === "reduce")).toBe(true);
    expect(report.counts["chemins d'attaque"]).toBe(3);
    expect(report.warnings.some((w) => w.includes("R4"))).toBe(true);
  });

  it("importe les ateliers 1 à 3 d'un modèle rempli", () => {
    const grid: Grid = {
      "Atelier 1 - Missions": [
        ["Missions", "Soigner", "Soigner", "Facturer"],
        ["Dénomination de la valeur métier", "Dossier patient", "Prise en charge", "Facturation"],
        ["Nature de la valeur métier(processus ou information)", "information", "processus", "processus"],
        ["Description", "DPI", "Accueil et soins", "Émission des factures"],
        ["Entité ou personne responsable(INTERNE/EXTERNE)", "DIM (interne)", "Direction des soins", "Éditeur (externe)"],
        ["Dénomination du/des biens supports associés", "Serveur DPI", "Serveur DPI", "ERP"],
        ["Description", "VM", "VM", "SaaS"],
        ["Entité ou personne responsable(INTERNE/EXTERNE)", "DSI", "DSI", "Éditeur (externe)"],
      ],
      "Atelier 1 - ER": [
        ["Identification", "Identification", "Cotation", "Cotation"],
        ["Valeur métier", "Evenement redouté", "Impact", "Gravité"],
        ["Dossier patient", "Fuite de données de santé", "Atteinte à la vie privée", "4. critique"],
        ["Laboratoire", "Arrêt des analyses", "", "G2"],
      ],
      "Atelier 1 - GAP": [
        ["Type de référentiel", "Nom du referentiel", "Etat d'application", "Ecarts", "Justification des écarts"],
        ["Guide d'hygiène", "Guide d'hygiène ANSSI", "Appliqué avec restrictions", "Pas de MFA sur le VPN", "Projet en cours"],
        ["Guide d'hygiène", "Guide d'hygiène ANSSI", "Appliqué avec restrictions", "Sauvegardes non testées", ""],
      ],
      "Atelier 2 - SROV": [
        ["Sources de risque", "Objectifs visés", "Motivation", "Ressources", "Pertinence du couple SR/OV", "Priorité", "Retenu", "Justification de l'exclusion du couple SR/OV"],
        ["Cybercriminel", "Rançonner l'hôpital", "+++", "++", "Elevée", 1, "OUI", ""],
        ["Hacktiviste", "Défigurer le site", "+", "+", "Faible", 0, "NON", "Faible impact"],
      ],
      "Atelier 3 - PP": [
        ["Catégories", "Parties prenantes", "Dépendance", "Pénétration", "Maturité", "Confiance"],
        ["Prestataires", "Infogérant", 3, 4, 2, 2],
      ],
    };
    const { data, report } = importAnssiTemplate(grid);
    expect(data.missions.map((m) => m.name)).toEqual(["Soigner", "Facturer"]);
    expect(data.businessValues.map((b) => b.name)).toEqual(["Dossier patient", "Prise en charge", "Facturation", "Laboratoire"]);
    expect(data.businessValues[0].nature).toBe("information");
    expect(data.businessValues[2].ownerType).toBe("external");
    expect(data.supportingAssets).toHaveLength(2);
    expect(data.supportingAssets[0].businessValueIds).toHaveLength(2);
    expect(data.fearedEvents.map((f) => f.gravity)).toEqual([4, 2]);
    expect(report.warnings.some((w) => w.includes("Laboratoire"))).toBe(true);
    const ref = data.baseline.referentials[0];
    expect(ref.type).toBe("hygiene");
    expect(ref.requirements).toHaveLength(2);
    expect(ref.statusForced).toBe("partial");
    expect(data.riskSources.map((s) => s.categoryId)).toEqual(["sr-crime", "sr-activiste"]);
    expect(data.srovPairs.map((p) => [p.retained, p.motivation, p.resources])).toEqual([[true, 3, 2], [false, 1, 1]]);
    expect(data.srovPairs[1].exclusionJustification).toBe("Faible impact");
    expect(data.stakeholders[0].criteria).toEqual({ dependency: 3, penetration: 4, maturity: 2, trust: 2 });
    expect(data.stakeholders[0].categoryId).toBe("pp-prestataires");
    expect(studyDataSchema.safeParse(data).success).toBe(true);
  });

  it("signale un fichier sans rapport avec le modèle", () => {
    const { report } = importAnssiTemplate({ Feuil1: [["a", "b"]] });
    expect(report.warnings[0]).toMatch(/Aucune donnée/);
  });
});
