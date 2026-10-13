import DOMPurify from "dompurify";

const ALLOWED = {
  ALLOWED_TAGS: ["p", "br", "div", "b", "strong", "i", "em", "u", "ul", "ol", "li", "span", "font", "h3", "h4", "blockquote"],
  ALLOWED_ATTR: ["style", "color"],
};

DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
  if (data.attrName === "style") {
    // Seules les couleurs de texte et de surlignage sont conservées.
    const kept = data.attrValue
      .split(";")
      .map((d) => d.trim())
      .filter((d) => /^(color|background-color)\s*:\s*(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(d));
    data.attrValue = kept.join("; ");
    if (!kept.length) data.keepAttr = false;
  }
});

/** Nettoyage du texte enrichi (liste blanche de balises, couleurs uniquement dans les styles). */
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, ALLOWED) as string;
}
