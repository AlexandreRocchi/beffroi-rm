import { integrityIssues, progress, riskRows, studyDataSchema, type StudyData } from "@beffroi/shared";
import { HttpError } from "./auth.js";

export interface StudyStats {
  risks: Record<string, number>;
  residual: Record<string, number>;
  progress: Record<number, number>;
  measures: { total: number; done: number };
}

export function computeStats(data: StudyData): StudyStats {
  const rows = riskRows(data).filter((r) => r.active);
  const count = (key: "level" | "residualLevel") =>
    rows.reduce<Record<string, number>>((acc, r) => {
      const k = String(r[key] ?? "?");
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const p = progress(data);
  const byWs: Record<number, number> = {};
  for (const w of [1, 2, 3, 4, 5]) {
    const items = p.filter((x) => x.workshop === w);
    byWs[w] = items.length ? Math.round((items.reduce((s, x) => s + x.ratio, 0) / items.length) * 100) : 0;
  }
  return {
    risks: count("level"),
    residual: count("residualLevel"),
    progress: byWs,
    measures: { total: data.measures.length, done: data.measures.filter((m) => m.status === "done").length },
  };
}

export function parseStudyData(input: unknown): StudyData {
  const r = studyDataSchema.safeParse(input);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, `Document d'étude invalide : ${first?.path.join(".")} — ${first?.message}`);
  }
  const data = r.data as StudyData;
  const issues = integrityIssues(data);
  if (issues.length) throw new HttpError(400, `Document d'étude incohérent : ${issues.slice(0, 3).join(" ; ")}`);
  return data;
}
