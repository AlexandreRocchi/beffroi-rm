/** Notifications éphémères et boîte de confirmation, affichées par App.svelte. */

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

export const toasts = $state<Toast[]>([]);

export function toast(text: string, kind: Toast["kind"] = "info") {
  const id = Date.now() + Math.random();
  toasts.push({ id, text, kind });
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  }, kind === "error" ? 7000 : 3500);
}

export interface ConfirmOpts {
  title: string;
  message: string;
  /** Encadré d'avertissement (ex. suppressions en cascade). */
  warning?: string;
  /** Note complémentaire discrète. */
  note?: string;
  confirmLabel?: string;
  danger?: boolean;
}

export const confirmState = $state<{ current: (ConfirmOpts & { resolve: (v: boolean) => void }) | null }>({ current: null });

export function confirm(o: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => (confirmState.current = { ...o, resolve }));
}

export function closeConfirm(v: boolean) {
  confirmState.current?.resolve(v);
  confirmState.current = null;
}
