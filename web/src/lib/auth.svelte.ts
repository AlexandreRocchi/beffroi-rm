import { Api, setUnauthorizedHandler, type AuthInfo, type LoginNotice, type MfaPolicy, type SessionUser } from "./api";
import { toast } from "./feedback.svelte";

/** Efface les données d'étude conservées dans le navigateur (modifications en attente après expiration). */
function clearLocalData() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("beffroi-pending-")) sessionStorage.removeItem(k);
  } catch {
    /* stockage indisponible */
  }
}

/** Session de l'utilisateur connecté et modes de connexion proposés par le serveur. */
class Auth {
  user = $state<SessionUser | null>(null);
  loading = $state(true);
  appVersion = $state("");
  mfaPolicy = $state<MfaPolicy>("required");
  info = $state<AuthInfo>({ localLogin: true, oidc: null });
  /** Mode poste seul : un utilisateur sur son poste, sans compte ni partage. */
  poste = $state(false);

  async init() {
    setUnauthorizedHandler(() => (this.user = null));
    await this.refresh();
  }

  async refresh() {
    try {
      const r = await Api.me();
      this.user = r.user;
      this.appVersion = r.version ?? "";
      if (r.mfaPolicy) this.mfaPolicy = r.mfaPolicy;
      this.info = r.auth;
      this.poste = r.mode === "poste";
    } catch {
      this.user = null;
    } finally {
      this.loading = false;
    }
  }

  setUser(u: SessionUser | null) {
    this.user = u;
    if (u) void this.refresh();
  }

  /** Page d'arrivée après authentification : étapes imposées d'abord. */
  landing(u: SessionUser, from: string | null): string {
    if (u.mustChange) return "/mot-de-passe";
    if (u.mustEnrollMfa) return "/securite/mfa";
    return from ?? "/";
  }

  /** Information de l'utilisateur : connexion précédente et tentatives échouées depuis. */
  notify(n: LoginNotice | undefined) {
    if (!n) return;
    const when = n.previousLogin ? new Date(n.previousLogin).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : null;
    if (n.failuresSinceLastLogin > 0) {
      toast(
        `${n.failuresSinceLastLogin} tentative(s) de connexion échouée(s) sur votre compte depuis votre dernière connexion${when ? ` (${when})` : ""}. Si ce n'était pas vous, changez votre mot de passe et prévenez l'administrateur.`,
        "error",
      );
    } else if (when) toast(`Dernière connexion : ${when}.`);
    if (n.recoveryCodesLeft !== undefined) {
      toast(`Code de secours utilisé : il vous en reste ${n.recoveryCodesLeft}.${n.recoveryCodesLeft <= 3 ? " Régénérez-en depuis votre profil." : ""}`, n.recoveryCodesLeft <= 3 ? "error" : "info");
    }
  }

  async logout() {
    await Api.logout().catch(() => toast("La session n'a pas pu être fermée sur le serveur : elle expirera d'elle-même. Fermez le navigateur sur un poste partagé.", "error"));
    clearLocalData();
    this.user = null;
  }
}

export const auth = new Auth();
