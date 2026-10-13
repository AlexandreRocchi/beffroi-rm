import { produce, type Draft } from "immer";
import { cascadeImpact, normalizeStudy, type StudyData } from "@beffroi/shared";
import { confirm } from "../lib/feedback.svelte";
import type { StudyState } from "./study.svelte";

/** Suppression avec confirmation et annonce des suppressions en cascade. */
export async function confirmDelete(study: StudyState, label: string, recipe: (d: Draft<StudyData>) => void): Promise<boolean> {
  const after = produce(study.d, (d) => {
    recipe(d);
    normalizeStudy(d as StudyData);
  });
  const impact = cascadeImpact(study.d, after);
  const ok = await confirm({
    title: "Confirmer la suppression",
    message: `Supprimer ${label} ?`,
    warning: impact.length ? `Seront également supprimés : ${impact.join(", ")}.` : undefined,
    note: "Vous pourrez annuler avec Ctrl+Z.",
    confirmLabel: "Supprimer",
    danger: true,
  });
  if (ok) study.update(recipe);
  return ok;
}
