import { PROTECTION_MARKS, type StudyData, type StudyMeta } from "@beffroi/shared";
import type { Png } from "./raster";
import { buildReport, type Cell, type Cover, type ReportWriter } from "./report";

type Docx = typeof import("docx");

/** Rendu Word (.docx) du rapport. */
class DocxWriter implements ReportWriter {
  readonly children: (InstanceType<Docx["Paragraph"]> | InstanceType<Docx["Table"]>)[] = [];
  constructor(private readonly x: Docx) {}

  cover(c: Cover) {
    const { Paragraph, TextRun, ImageRun, AlignmentType, BorderStyle } = this.x;
    const color = c.protectionColor.slice(1);
    this.children.push(
      new Paragraph({ spacing: { before: 600 }, children: [
        ...(c.logo ? [new ImageRun({ type: "png", data: c.logo.data, transformation: { width: 44, height: 44 } })] : []),
        new TextRun({ text: "  Beffroi RM", bold: true, size: 32, color: "1B2A6E" }),
      ] }),
      new Paragraph({ spacing: { before: 1600 }, children: [new TextRun({ text: "ANALYSE DE RISQUES EBIOS RISK MANAGER", bold: true, size: 26, color: "2E46AD" })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: c.title, bold: true, size: 48 })] }),
    );
    if (c.subject) this.children.push(new Paragraph({ children: [new TextRun({ text: c.subject, size: 26 })] }));
    this.children.push(new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: `Version ${c.version} — ${c.date}`, size: 22 })] }));
    if (c.reference) this.children.push(new Paragraph({ children: [new TextRun({ text: `Référence : ${c.reference}`, size: 22 })] }));
    if (c.organisation) this.children.push(new Paragraph({ children: [new TextRun({ text: `Organisation : ${c.organisation}`, size: 22 })] }));
    this.children.push(
      new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.LEFT, border: { top: { style: BorderStyle.SINGLE, size: 12, color }, bottom: { style: BorderStyle.SINGLE, size: 12, color } },
        children: [new TextRun({ text: `Mention de protection : ${c.protectionLabel}`, bold: true, size: 26, color })] }),
      new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: "Document établi selon la méthode EBIOS Risk Manager (guide ANSSI v1.5) avec Beffroi RM.", italics: true, size: 18, color: "4A5468" })] }),
    );
  }

  h(text: string, level: 1 | 2 | 3 = 1) {
    const { Paragraph, HeadingLevel } = this.x;
    this.children.push(new Paragraph({ text, heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, spacing: { before: level === 1 ? 240 : 160, after: 100 }, ...(level === 1 ? { pageBreakBefore: true } : {}) }));
  }

  p(text: string, opts: { italics?: boolean; bold?: boolean } = {}) {
    const { Paragraph, TextRun } = this.x;
    for (const line of (text || "").split("\n")) this.children.push(new Paragraph({ children: [new TextRun({ text: line, ...opts })], spacing: { after: 80 } }));
  }

  kv(k: string, v: string) {
    const { Paragraph, TextRun } = this.x;
    this.children.push(new Paragraph({ children: [new TextRun({ text: `${k} : `, bold: true }), new TextRun(v || "—")], spacing: { after: 60 } }));
  }

  table(headers: string[], rows: Cell[][], widths?: number[]) {
    const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType } = this.x;
    const total = widths?.reduce((a, b) => a + b, 0) ?? headers.length;
    const cell = (t: Cell, header = false, zebra = false) =>
      new TableCell({
        children: String(t ?? "").split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, bold: header, color: header ? "FFFFFF" : undefined, size: 17 })] })),
        shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "1B2A6E" } : zebra ? { type: ShadingType.CLEAR, color: "auto", fill: "F5F6F8" } : undefined,
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
      });
    this.children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: widths?.map((w) => Math.round((w / total) * 9600)),
      rows: [
        new TableRow({ children: headers.map((x) => cell(x, true)), tableHeader: true }),
        ...rows.map((r, i) => new TableRow({ children: r.map((x) => cell(x, false, i % 2 === 1)) })),
      ],
    }));
    this.children.push(new Paragraph({ text: "" }));
  }

  image(png: Png, maxW: number, caption?: string) {
    const { Paragraph, TextRun, ImageRun, AlignmentType } = this.x;
    const w = Math.min(maxW, png.width);
    const hgt = Math.round((png.height / png.width) * w);
    const maxH = 820;
    const [fw, fh] = hgt > maxH ? [Math.round((w * maxH) / hgt), maxH] : [w, hgt];
    this.children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: png.data, transformation: { width: fw, height: fh } })] }));
    if (caption) this.children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: caption, italics: true, size: 18, color: "4A5468" })], spacing: { after: 160 } }));
  }
}

export async function exportWord(meta: StudyMeta, d: StudyData, workshops: number[], onProgress?: (msg: string) => void): Promise<Blob> {
  const x = await import("docx");
  const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType, PageNumber } = x;
  const w = new DocxWriter(x);
  await buildReport(w, meta, d, workshops, onProgress);

  const mark = PROTECTION_MARKS.find((m) => m.id === meta.protection);
  const markColor = (mark?.color ?? "#555555").slice(1);
  const banner = () => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (mark?.label ?? meta.protection).toUpperCase(), bold: true, color: markColor, size: 18 })] });
  const doc = new Document({
    creator: "Beffroi RM",
    title: meta.name,
    description: `Analyse de risques EBIOS RM — ${mark?.label}`,
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      headers: { default: new Header({ children: [banner()] }) },
      footers: { default: new Footer({ children: [banner(), new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [`${meta.name} — v${meta.major}.${meta.minor} — page `, PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 16, color: "7A8497" })] })] }) },
      children: w.children,
    }],
  });
  onProgress?.("Génération du fichier…");
  return Packer.toBlob(doc);
}
