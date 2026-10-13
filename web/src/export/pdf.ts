import { PROTECTION_MARKS, type StudyData, type StudyMeta } from "@beffroi/shared";
// Police IBM Plex Sans embarquée dans le document (fichiers locaux, aucun téléchargement).
import plexRegular from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?inline";
import plexItalic from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff?inline";
import plexBold from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?inline";
import plexBoldItalic from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-italic.woff?inline";
import type { Png } from "./raster";
import { buildReport, type Cell, type Cover, type ReportWriter } from "./report";

const NAVY = "#1b2a6e";
const MUTED = "#6b7285";
/** Largeur utile d'une page A4 avec des marges de 45 pt. */
const PAGE_W = 595.28 - 90;
/** Conversion des largeurs exprimées en pixels à 96 dpi (communes avec le rapport Word) en points. */
const PX = 0.75;

// Contenu pdfmake : structure libre (texte, tableaux, images) décrite par des objets.
type Node = Record<string, unknown> | string;

/** Glyphes absents du sous-ensemble latin de la police, remplacés par un équivalent. */
const clean = (t: Cell) => String(t ?? "").replace(/→/g, "»").replace(/≥/g, ">=").replace(/≤/g, "<=");

const base64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
/**
 * Largeurs de colonnes (pt) : réparties selon les poids demandés, sans descendre sous la largeur
 * du mot le plus long de la colonne (évite les mots coupés dans les colonnes étroites).
 */
export function columnWidths(headers: string[], rows: Cell[][], weights: number[] | undefined, available: number): number[] {
  const n = headers.length;
  const w = weights ?? headers.map(() => 1);
  // Largeur moyenne d'un caractère en corps 8 (en-têtes en gras) ; les marges de cellule sont déduites par l'appelant.
  const need = headers.map((hd, i) => {
    const words = [hd, ...rows.map((r) => r[i])].flatMap((c) => clean(c).split(/\s+/));
    const longest = Math.max(0, ...words.map((x) => x.length));
    return Math.min(90, longest * 4.6 + 2);
  });
  const total = w.reduce((a, b) => a + b, 0);
  let out = w.map((x) => (x / total) * available);
  if (need.reduce((a, b) => a + b, 0) > available) return out;
  for (let pass = 0; pass < n; pass++) {
    const short = out.map((x, i) => need[i] - x).map((d) => Math.max(0, d));
    const deficit = short.reduce((a, b) => a + b, 0);
    if (deficit < 0.5) break;
    const donors = out.map((x, i) => (short[i] === 0 ? Math.max(0, x - need[i]) : 0));
    const room = donors.reduce((a, b) => a + b, 0);
    if (room <= 0) break;
    const take = Math.min(1, deficit / room);
    out = out.map((x, i) => (short[i] > 0 ? need[i] : x - donors[i] * take));
  }
  return out;
}

const dataUrl = (png: Png) => `data:image/png;base64,${base64(png.data)}`;
const fontData = (inline: string) => inline.slice(inline.indexOf(",") + 1);

/** Rendu PDF du rapport (pdfmake). */
class PdfWriter implements ReportWriter {
  readonly content: Node[] = [];

  cover(c: Cover) {
    this.content.push(
      {
        columns: [
          ...(c.logo ? [{ image: dataUrl(c.logo), width: 34 }] : []),
          { text: "Beffroi RM", fontSize: 20, bold: true, color: NAVY, margin: [8, 6, 0, 0] },
        ],
        margin: [0, 20, 0, 0],
      },
      { text: "ANALYSE DE RISQUES EBIOS RISK MANAGER", bold: true, fontSize: 12, color: "#2e46ad", margin: [0, 150, 0, 8] },
      { text: clean(c.title), bold: true, fontSize: 24, margin: [0, 0, 0, 6] },
    );
    if (c.subject) this.content.push({ text: clean(c.subject), fontSize: 13, color: "#454c60" });
    this.content.push({ text: `Version ${c.version} — ${c.date}`, fontSize: 11, margin: [0, 24, 0, 2] });
    if (c.reference) this.content.push({ text: `Référence : ${clean(c.reference)}`, fontSize: 11 });
    if (c.organisation) this.content.push({ text: `Organisation : ${clean(c.organisation)}`, fontSize: 11 });
    this.content.push(
      {
        table: { widths: ["*"], body: [[{ text: `Mention de protection : ${c.protectionLabel}`, bold: true, fontSize: 13, color: c.protectionColor, margin: [0, 6, 0, 6] }]] },
        layout: { hLineWidth: () => 1.5, vLineWidth: () => 0, hLineColor: () => c.protectionColor, paddingLeft: () => 0 },
        margin: [0, 36, 0, 0],
      },
      { text: "Document établi selon la méthode EBIOS Risk Manager (guide ANSSI v1.5) avec Beffroi RM.", italics: true, fontSize: 9, color: MUTED, margin: [0, 24, 0, 0] },
    );
  }

  h(text: string, level: 1 | 2 | 3 = 1) {
    this.content.push({
      text: clean(text),
      style: `h${level}`,
      // Titre de niveau 1 : nouvelle page ; les autres ne restent pas seuls en bas de page.
      ...(level === 1 ? { pageBreak: "before" } : { headlineLevel: level }),
    });
  }

  p(text: string, opts: { italics?: boolean; bold?: boolean } = {}) {
    if (text) this.content.push({ text: clean(text), ...opts, margin: [0, 0, 0, 4] });
  }

  kv(k: string, v: string) {
    this.content.push({ text: [{ text: `${clean(k)} : `, bold: true }, clean(v) || "—"], margin: [0, 0, 0, 3] });
  }

  table(headers: string[], rows: Cell[][], widths?: number[]) {
    const cols = columnWidths(headers, rows, widths, PAGE_W - headers.length * 8.5);
    this.content.push({
      table: {
        headerRows: 1,
        keepWithHeaderRows: 1,
        dontBreakRows: true,
        widths: cols,
        body: [
          headers.map((x) => ({ text: clean(x), bold: true, color: "#ffffff" })),
          ...(rows.length ? rows.map((r) => r.map((x) => ({ text: clean(x) }))) : [[{ text: "—", colSpan: headers.length, color: MUTED }, ...headers.slice(1).map(() => "")]]),
        ],
      },
      layout: {
        fillColor: (i: number) => (i === 0 ? NAVY : i % 2 === 0 ? "#f5f6f8" : null),
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => "#dfe3ea",
        vLineColor: () => "#dfe3ea",
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      fontSize: 8,
      margin: [0, 2, 0, 10],
    });
  }

  image(png: Png, maxW: number, caption?: string) {
    let w = Math.min(maxW * PX, PAGE_W, png.width);
    const maxH = 620;
    if ((png.height / png.width) * w > maxH) w = (maxH * png.width) / png.height;
    this.content.push({ image: dataUrl(png), width: w, alignment: "center", margin: [0, 4, 0, caption ? 2 : 10] });
    if (caption) this.content.push({ text: clean(caption), italics: true, fontSize: 8.5, color: MUTED, alignment: "center", margin: [0, 0, 0, 10] });
  }
}

interface PdfMake {
  addVirtualFileSystem(vfs: Record<string, string>): void;
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(policy: (url: string) => boolean): void;
  createPdf(doc: Record<string, unknown>): { getBlob(): Promise<Blob> };
}

export async function exportPdf(meta: StudyMeta, d: StudyData, workshops: number[], onProgress?: (msg: string) => void): Promise<Blob> {
  const pdfMake = (await import("pdfmake/build/pdfmake")).default as unknown as PdfMake;
  // Aucune ressource distante : tout est embarqué dans le document.
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.addVirtualFileSystem({
    "plex-400.woff": fontData(plexRegular),
    "plex-400i.woff": fontData(plexItalic),
    "plex-600.woff": fontData(plexBold),
    "plex-600i.woff": fontData(plexBoldItalic),
  });
  pdfMake.setFonts({ Plex: { normal: "plex-400.woff", italics: "plex-400i.woff", bold: "plex-600.woff", bolditalics: "plex-600i.woff" } });

  const w = new PdfWriter();
  await buildReport(w, meta, d, workshops, onProgress);

  const mark = PROTECTION_MARKS.find((m) => m.id === meta.protection);
  const markColor = mark?.color ?? "#555555";
  const banner = (margin: number[]) => ({ text: (mark?.label ?? meta.protection).toUpperCase(), bold: true, fontSize: 8, color: markColor, alignment: "center", margin });
  onProgress?.("Génération du fichier…");
  return pdfMake
    .createPdf({
      pageSize: "A4",
      pageMargins: [45, 50, 45, 55],
      info: { title: meta.name, author: meta.organisation || undefined, subject: `Analyse de risques EBIOS RM — ${mark?.label ?? meta.protection}`, creator: "Beffroi RM", producer: "Beffroi RM" },
      header: () => banner([0, 22, 0, 0]),
      footer: (page: number, pages: number) => ({
        stack: [banner([0, 0, 0, 2]), { text: `${clean(meta.name)} — v${meta.major}.${meta.minor} — page ${page} / ${pages}`, fontSize: 7.5, color: MUTED, alignment: "center" }],
        margin: [0, 16, 0, 0],
      }),
      content: w.content,
      defaultStyle: { font: "Plex", fontSize: 9.5, lineHeight: 1.2, color: "#161b2e" },
      styles: {
        h1: { fontSize: 17, bold: true, color: NAVY, margin: [0, 0, 0, 10] },
        h2: { fontSize: 13, bold: true, color: NAVY, margin: [0, 12, 0, 6] },
        h3: { fontSize: 10.5, bold: true, color: "#161b2e", margin: [0, 10, 0, 4] },
      },
      // Évite un titre isolé en bas de page.
      pageBreakBefore: (node: { headlineLevel?: number }, q: { getFollowingNodesOnPage: () => unknown[] }) =>
        !!node.headlineLevel && q.getFollowingNodesOnPage().length === 0,
    })
    .getBlob();
}
