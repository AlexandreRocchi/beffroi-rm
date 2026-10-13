import { flushSync, mount, unmount, type Component } from "svelte";

export interface Png {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Rend un composant Svelte produisant un SVG en PNG (rapports Word et PDF). */
export async function renderPng<P extends Record<string, unknown>>(component: Component<P>, props: P, targetWidth = 1400): Promise<Png | null> {
  const host = document.createElement("div");
  const instance = mount(component, { target: host, props });
  flushSync();
  const el = host.querySelector("svg");
  const markup = el ? new XMLSerializer().serializeToString(el) : null;
  void unmount(instance);
  if (!markup) return null;
  let svg = markup;
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const vb = /viewBox="([\d.\s-]+)"/.exec(svg);
  const [, , vw, vh] = vb ? vb[1].trim().split(/\s+/).map(Number) : [0, 0, 800, 600];
  const scale = targetWidth / vw;
  const width = Math.round(vw * scale);
  const height = Math.round(vh * scale);
  svg = svg.replace(/^<svg([^>]*?)\s(width|height)="[^"]*"/, "<svg$1").replace(/^<svg([^>]*?)\s(width|height)="[^"]*"/, "<svg$1");
  svg = svg.replace("<svg", `<svg width="${width}" height="${height}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("rendu SVG impossible"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
