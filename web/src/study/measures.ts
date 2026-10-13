import type { Draft } from "immer";
import { nextRef, uid, type Measure, type StudyData } from "@beffroi/shared";

/** Ajoute une mesure au plan de traitement et renvoie son identifiant. */
export function newMeasure(d: Draft<StudyData>, partial: Partial<Measure> = {}): string {
  const id = uid();
  d.measures.push({
    id, ref: nextRef("M", d.measures), title: "", description: "", origin: "scenario", category: "protection",
    businessValueIds: [], supportingAssetIds: [], stakeholderIds: [], riskIds: [], requirementIds: [],
    owner: "", obstacles: "", cost: null, effort: "", dueDate: "", priority: null, status: "todo", progress: 0, comments: "",
    ...partial,
  });
  return id;
}
