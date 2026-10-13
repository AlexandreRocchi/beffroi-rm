import { riskLevelDef, type StudySettings } from "@beffroi/shared";

/** Origine de la vraisemblance d'un scénario de risque. */
export const SRC: Record<string, string> = { forced: "forcée", express: "expresse", graph: "graphe d'attaque", modes: "modes opératoires", pertinence: "pertinence SR/OV", none: "—" };

export function riskColor(settings: StudySettings, lvl: number | null) {
  return riskLevelDef(settings, lvl)?.color ?? "#607d8b";
}
