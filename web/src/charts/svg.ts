/** Découpe un texte en lignes d'au plus `max` caractères (au mot près). */
export function wrap(text: string, max: number, maxLines = 3): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = cut[maxLines - 1].replace(/.{0,2}$/, "") + "…";
    return cut;
  }
  return lines;
}

export const FONT = "IBM Plex Sans, Segoe UI, system-ui, -apple-system, Helvetica Neue, Arial, sans-serif";
