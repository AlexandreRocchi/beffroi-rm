import { getContext, setContext } from "svelte";
import { produce, type Draft } from "immer";
import { normalizeStudy, type StudyData } from "@beffroi/shared";
import { Api, ApiError, type StudyListItem } from "../lib/api";
import { toast } from "../lib/feedback.svelte";

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const MAX_HISTORY = 150;
const AUTOSAVE_MS = 1200;

/**
 * État d'une étude ouverte : document immuable (immer), historique annuler/rétablir,
 * sauvegarde automatique avec contrôle de révision, reprise après expiration de session.
 */
export class StudyState {
  meta = $state.raw<StudyListItem | null>(null);
  data = $state.raw<StudyData | null>(null);
  error = $state<string | null>(null);
  saveState = $state<SaveState>("saved");
  conflict = $state<string | null>(null);
  pending = $state<{ rev: number; data: StudyData; at: number } | null>(null);
  canUndo = $state(false);
  canRedo = $state(false);

  private past: StudyData[] = [];
  private future: StudyData[] = [];
  private lastCoalesce: { key: string; t: number } | null = null;
  private rev = 0;
  private dirty = false;
  private saving: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly studyId: string,
    readonly versionId: string | null,
  ) {}

  get viewingOldVersion() {
    return !!this.meta && !!this.versionId;
  }

  get readOnly() {
    return !this.meta || this.meta.access === "read" || this.meta.frozen || this.viewingOldVersion;
  }

  /** Document courant (les pages ne sont affichées qu'une fois l'étude chargée). */
  get d(): StudyData {
    return this.data as StudyData;
  }

  get m(): StudyListItem {
    return this.meta as StudyListItem;
  }

  private get pendingKey() {
    return `beffroi-pending-${this.studyId}`;
  }

  async load(versionId: string | null = this.versionId) {
    try {
      const r = await Api.studyData(this.studyId, versionId ?? undefined);
      this.meta = r.meta;
      this.data = r.data;
      this.rev = r.meta.rev;
      this.past = [];
      this.future = [];
      this.syncHistoryFlags();
      this.dirty = false;
      this.saveState = "saved";
      this.error = null;
      if (!versionId) {
        try {
          const raw = sessionStorage.getItem(this.pendingKey);
          if (raw) this.pending = JSON.parse(raw);
        } catch {
          /* stockage indisponible */
        }
      }
    } catch (e) {
      this.error = (e as Error).message;
    }
  }

  private syncHistoryFlags() {
    this.canUndo = this.past.length > 0;
    this.canRedo = this.future.length > 0;
  }

  private commit(next: StudyData) {
    this.data = next;
    this.dirty = true;
    if (this.saveState !== "conflict") this.saveState = "dirty";
    this.syncHistoryFlags();
    this.schedule();
  }

  /** Sauvegarde automatique (annexe A, point 3) après une courte période sans modification. */
  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    if (this.saveState !== "dirty") return;
    this.timer = setTimeout(() => void this.save(), AUTOSAVE_MS);
  }

  /** Modifie le document ; les frappes rapprochées d'un même champ forment une seule étape d'annulation. */
  update = (recipe: (d: Draft<StudyData>) => void, coalesceKey?: string) => {
    if (this.readOnly) {
      toast("Cette étude est en lecture seule.", "error");
      return;
    }
    const cur = this.data;
    if (!cur) return;
    const next = produce(cur, (d) => {
      recipe(d);
      normalizeStudy(d as StudyData);
    });
    if (next === cur) return;
    const now = Date.now();
    const coalesce = coalesceKey && this.lastCoalesce?.key === coalesceKey && now - this.lastCoalesce.t < 1500;
    if (!coalesce) {
      this.past.push(cur);
      if (this.past.length > MAX_HISTORY) this.past.shift();
    }
    this.lastCoalesce = coalesceKey ? { key: coalesceKey, t: now } : null;
    this.future = [];
    this.commit(next);
  };

  undo = () => {
    const prev = this.past.pop();
    if (!prev || !this.data) return;
    this.future.push(this.data);
    this.lastCoalesce = null;
    this.commit(prev);
  };

  redo = () => {
    const next = this.future.pop();
    if (!next || !this.data) return;
    this.past.push(this.data);
    this.lastCoalesce = null;
    this.commit(next);
  };

  save = async (forceOverwrite = false): Promise<void> => {
    if (!this.data || this.readOnly) return;
    if (this.saving) await this.saving;
    if (!this.dirty && !forceOverwrite) return;
    const snapshot = this.data;
    this.dirty = false;
    this.saveState = "saving";
    const p = (async () => {
      try {
        const r = await Api.saveStudy(this.studyId, this.rev, snapshot, forceOverwrite);
        this.rev = r.rev;
        this.saveState = this.dirty ? "dirty" : "saved";
        if (this.dirty) this.schedule();
      } catch (e) {
        this.dirty = true;
        if (e instanceof ApiError && e.status === 401) {
          // Session expirée : les modifications sont conservées pour être restaurées après reconnexion.
          try {
            sessionStorage.setItem(this.pendingKey, JSON.stringify({ rev: this.rev, data: this.data, at: Date.now() }));
          } catch {
            /* stockage indisponible */
          }
        } else if (e instanceof ApiError && e.status === 409 && e.body.conflict) {
          this.saveState = "conflict";
          this.conflict = e.message;
        } else {
          this.saveState = "error";
          toast(`Échec de l'enregistrement : ${(e as Error).message}`, "error");
        }
      }
    })();
    this.saving = p;
    await p;
    this.saving = null;
  };

  hasUnsavedChanges() {
    return this.dirty;
  }

  setMeta(m: StudyListItem) {
    this.meta = m;
  }

  discardPending() {
    sessionStorage.removeItem(this.pendingKey);
    this.pending = null;
  }

  restorePending() {
    const p = this.pending;
    this.discardPending();
    if (!p || !this.data) return;
    this.past.push(this.data);
    this.commit(p.data);
  }

  async resolveConflict(overwrite: boolean) {
    this.conflict = null;
    if (overwrite) await this.save(true);
    else {
      await this.load();
      toast("Étude rechargée depuis le serveur.");
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
  }
}

const KEY = Symbol("etude");

export function provideStudy(s: StudyState) {
  setContext(KEY, s);
}

export function useStudy(): StudyState {
  return getContext<StudyState>(KEY);
}
