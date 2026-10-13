/**
 * Routeur minimal fondé sur l'API History : chemin courant réactif, navigation et liens.
 * Les routes sont résolues dans App.svelte.
 */
class Router {
  path = $state(location.pathname);
  search = $state(location.search);
  /** État associé à l'entrée d'historique (ex. page d'origine avant une redirection vers la connexion). */
  state = $state<Record<string, unknown> | null>(history.state ?? null);

  constructor() {
    window.addEventListener("popstate", () => this.sync());
  }

  private sync() {
    this.path = location.pathname;
    this.search = location.search;
    this.state = history.state ?? null;
  }

  navigate(to: string, opts: { replace?: boolean; state?: Record<string, unknown> } = {}) {
    if (to === location.pathname + location.search && !opts.state) return;
    if (opts.replace) history.replaceState(opts.state ?? null, "", to);
    else history.pushState(opts.state ?? null, "", to);
    this.sync();
    if (!opts.replace) window.scrollTo(0, 0);
  }

  back() {
    history.back();
  }

  param(name: string): string | null {
    return new URLSearchParams(this.search).get(name);
  }
}

export const router = new Router();

/** Action pour les liens internes : navigation sans rechargement (clic simple uniquement). */
export function link(node: HTMLAnchorElement) {
  const onClick = (e: MouseEvent) => {
    const href = node.getAttribute("href");
    if (!href || !href.startsWith("/") || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || node.target) return;
    e.preventDefault();
    router.navigate(href);
  };
  node.addEventListener("click", onClick);
  return { destroy: () => node.removeEventListener("click", onClick) };
}
