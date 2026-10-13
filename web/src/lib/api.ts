import type { StudyData, StudyMeta, VersionInfo } from "@beffroi/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-Beffroi-CSRF": "1" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/api/auth/")) onUnauthorized?.();
    throw new ApiError(res.status, String(json.error ?? `Erreur ${res.status}`), json);
  }
  return json as T;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  function: string;
  role: "admin" | "user";
  canCreate: boolean;
  mustChange: boolean;
  authSource: "local" | "oidc";
  mfaEnabled: boolean;
  /** Second facteur exigé par la politique mais pas encore activé. */
  mustEnrollMfa: boolean;
  previousLogin: string | null;
}

/** Information de sécurité affichée après la connexion. */
export interface LoginNotice {
  previousLogin: string | null;
  failuresSinceLastLogin: number;
  recoveryCodesLeft?: number;
}

export type MfaPolicy = "required" | "admin" | "optional";

export interface SessionInfo {
  id: string;
  createdAt: number;
  lastSeen: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
  mfa: boolean;
  current: boolean;
}

/** Modes de connexion proposés par le serveur. */
export interface AuthInfo {
  localLogin: boolean;
  oidc: { label: string } | null;
}

export interface StudyStats {
  risks: Record<string, number>;
  residual: Record<string, number>;
  progress: Record<string, number>;
  measures: { total: number; done: number };
}

export type StudyListItem = StudyMeta & { stats: StudyStats };

export const Api = {
  me: () => api<{ user: SessionUser | null; version?: string; mode?: "poste"; sessionIdleMinutes?: number; mfaPolicy?: MfaPolicy; auth: AuthInfo }>("GET", "/api/auth/me"),
  login: (username: string, password: string) => api<{ user?: SessionUser; mfaRequired?: boolean; notice?: LoginNotice }>("POST", "/api/auth/login", { username, password }),
  loginMfa: (b: { code?: string; recoveryCode?: string }) => api<{ user: SessionUser; notice: LoginNotice }>("POST", "/api/auth/login/mfa", b),
  mfaSetup: (password: string) => api<{ uri: string; secret: string; qr: string }>("POST", "/api/auth/mfa/setup", { password }),
  mfaActivate: (code: string) => api<{ user: SessionUser; recoveryCodes: string[] }>("POST", "/api/auth/mfa/activate", { code }),
  mfaRecoveryCodes: (password: string, code: string) => api<{ recoveryCodes: string[] }>("POST", "/api/auth/mfa/recovery-codes", { password, code }),
  mfaDisable: (password: string, code: string) => api<{ user: SessionUser }>("POST", "/api/auth/mfa/disable", { password, code }),
  sessions: () => api<SessionInfo[]>("GET", "/api/auth/sessions"),
  revokeSession: (id: string) => api("DELETE", `/api/auth/sessions/${id}`),
  revokeOtherSessions: () => api("POST", "/api/auth/sessions/revoke-others", {}),
  logout: () => api("POST", "/api/auth/logout"),
  changePassword: (current: string, next: string) => api<{ user: SessionUser }>("POST", "/api/auth/password", { current, next }),
  updateProfile: (p: { displayName: string; email: string; function: string }) => api<{ user: SessionUser }>("PATCH", "/api/auth/profile", p),
  studies: () => api<StudyListItem[]>("GET", "/api/studies"),
  createStudy: (b: { name: string; reference: string; organisation: string; protection: string; scaleSize: 4 | 5; template: "empty" | "example" }) =>
    api<StudyListItem>("POST", "/api/studies", b),
  importStudy: (b: { name: string; reference: string; organisation: string; protection: string; data: unknown }) => api<StudyListItem>("POST", "/api/studies/import", b),
  duplicateStudy: (id: string) => api<StudyListItem>("POST", `/api/studies/${id}/duplicate`, {}),
  deleteStudy: (id: string) => api("DELETE", `/api/studies/${id}`),
  updateStudyMeta: (id: string, b: Partial<{ name: string; reference: string; organisation: string; protection: string }>) =>
    api<StudyListItem>("PATCH", `/api/studies/${id}`, b),
  studyData: (id: string, version?: string) =>
    api<{ meta: StudyListItem; data: StudyData }>("GET", `/api/studies/${id}/data${version ? `?version=${encodeURIComponent(version)}` : ""}`),
  saveStudy: (id: string, rev: number, data: StudyData, force = false) =>
    api<{ rev: number; updatedAt: string }>("PUT", `/api/studies/${id}/data`, { rev, data, force }),
  versions: (id: string) => api<VersionInfo[]>("GET", `/api/studies/${id}/versions`),
  newVersion: (id: string, b: { changeType: "operational" | "strategic"; summary: string; workshops: number[] }) =>
    api<{ id: string; major: number; minor: number }>("POST", `/api/studies/${id}/versions`, b),
  acl: (id: string) => api<AclEntry[]>("GET", `/api/studies/${id}/acl`),
  setAcl: (id: string, entries: Omit<AclEntry, "name" | "username">[]) => api<AclEntry[]>("PUT", `/api/studies/${id}/acl`, entries),
  directory: () => api<{ users: { id: string; username: string; displayName: string; function: string }[]; groups: { id: string; name: string; description: string }[] }>("GET", "/api/directory"),
  logExport: (id: string, format: string, scope = "") => api("POST", `/api/studies/${id}/export-log`, { format, scope }).catch(() => undefined),
};

export interface AclEntry {
  principalType: "user" | "group";
  principalId: string;
  access: "read" | "write" | "owner";
  name: string;
  username: string;
}
