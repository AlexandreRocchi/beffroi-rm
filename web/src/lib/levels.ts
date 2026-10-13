import type { ScaleLevel } from "@beffroi/shared";

const RAMP = ["#43a047", "#9ccc65", "#ffca28", "#fb8c00", "#e53935", "#8e0000"];

/** Couleur d'un niveau d'échelle (couleur définie, sinon rampe du vert au rouge). */
export function levelColor(scale: ScaleLevel[], value: number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const l = scale.find((x) => x.value === value);
  if (l?.color) return l.color;
  const idx = scale.findIndex((x) => x.value === value);
  if (idx < 0) return undefined;
  const pos = scale.length <= 1 ? 0 : idx / (scale.length - 1);
  return RAMP[Math.round(pos * (RAMP.length - 2))];
}

export function isLight(hex: string | undefined): boolean {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 165;
}

export function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Filtre plein texte insensible à la casse et aux accents. */
export function matches(q: string, ...fields: (string | undefined | null)[]) {
  if (!q.trim()) return true;
  const n = normalize(q);
  return fields.some((f) => f && normalize(f).includes(n));
}

export interface Option {
  value: string;
  label: string;
  group?: string;
  hint?: string;
}
