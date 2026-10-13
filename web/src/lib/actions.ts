/** Rend un élément cliquable accessible au clavier : focus, puis Entrée ou Espace déclenchent le clic. */
export function activable(node: HTMLElement) {
  if (!node.hasAttribute("tabindex")) node.tabIndex = 0;
  if (!node.hasAttribute("role") && node.tagName !== "TR") node.setAttribute("role", "button");
  const onKey = (e: KeyboardEvent) => {
    if (e.target !== node || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    node.click();
  };
  node.addEventListener("keydown", onKey);
  return { destroy: () => node.removeEventListener("keydown", onKey) };
}

/** Appelle `fn` lors d'un clic en dehors de l'élément. */
export function outside(node: HTMLElement, fn: () => void) {
  let cb = fn;
  const h = (e: MouseEvent) => {
    if (!node.contains(e.target as Node)) cb();
  };
  document.addEventListener("mousedown", h);
  return {
    update: (f: () => void) => (cb = f),
    destroy: () => document.removeEventListener("mousedown", h),
  };
}

/** Échap ferme la fenêtre (tiroirs, modales). */
export function escape(_node: HTMLElement, fn: () => void) {
  let cb = fn;
  const h = (e: KeyboardEvent) => e.key === "Escape" && cb();
  window.addEventListener("keydown", h);
  return {
    update: (f: () => void) => (cb = f),
    destroy: () => window.removeEventListener("keydown", h),
  };
}
