<script lang="ts">
  import Field from "../components/Field.svelte";
  import Icon from "../components/Icon.svelte";
  import Modal from "../components/Modal.svelte";
  import RecoveryCodes from "../components/RecoveryCodes.svelte";
  import { Api, type SessionInfo } from "../lib/api";
  import { auth } from "../lib/auth.svelte";
  import { confirm, toast } from "../lib/feedback.svelte";
  import { link } from "../lib/router.svelte";

  const user = auth.user!;
  let displayName = $state(user.displayName);
  let email = $state(user.email);
  let fn = $state(user.function);
  let sessions = $state.raw<SessionInfo[]>([]);
  /** Opération sensible en cours (ré-authentification : mot de passe et code). */
  let sensitive = $state<"codes" | "disable" | null>(null);
  let password = $state("");
  let code = $state("");
  let newCodes = $state<string[]>([]);
  let error = $state<string | null>(null);
  const me = $derived(auth.user ?? user);
  const mfaMandatory = $derived(me.authSource === "local" && (auth.mfaPolicy === "required" || (auth.mfaPolicy === "admin" && me.role === "admin")));
  const fmt = (t: number | string | null) => (t ? new Date(t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

  async function loadSessions() {
    sessions = await Api.sessions().catch(() => []);
  }
  void loadSessions();

  async function save() {
    try {
      const r = await Api.updateProfile({ displayName, email, function: fn });
      auth.setUser({ ...me, ...r.user });
      toast("Profil enregistré.", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function revoke(s: SessionInfo) {
    await Api.revokeSession(s.id);
    toast("Session fermée.", "success");
    await loadSessions();
  }

  async function revokeOthers() {
    if (!(await confirm({ title: "Fermer les autres sessions", message: "Toutes vos sessions ouvertes sur d'autres navigateurs ou appareils seront fermées.", confirmLabel: "Fermer" }))) return;
    await Api.revokeOtherSessions();
    toast("Autres sessions fermées.", "success");
    await loadSessions();
  }

  async function submitSensitive(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    try {
      if (sensitive === "codes") {
        newCodes = (await Api.mfaRecoveryCodes(password, code.replace(/\s/g, ""))).recoveryCodes;
      } else if (sensitive === "disable") {
        auth.setUser((await Api.mfaDisable(password, code.replace(/\s/g, ""))).user);
        toast("Authentification multifacteur désactivée.");
        closeSensitive();
      }
      password = "";
      code = "";
    } catch (err) {
      error = (err as Error).message;
    }
  }

  function closeSensitive() {
    sensitive = null;
    newCodes = [];
    password = "";
    code = "";
    error = null;
  }

  /** Navigateur et système d'exploitation, résumés à partir de l'agent utilisateur. */
  function device(ua: string): string {
    const browser = /Firefox\//.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
    const osName = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
    return osName ? `${browser} · ${osName}` : browser;
  }
</script>

<div class="page narrow">
  <div class="section-title"><div><div class="eyebrow">Mon compte</div><h1>{me.displayName}</h1><div class="subtitle">Identifiant : {user.username}{user.authSource === "oidc" ? " · authentification de l'organisation" : ""}</div></div></div>
  <div class="grid-2">
    <div class="card col gap-lg">
      <h3 style="margin: 0">Profil</h3>
      <Field label="Nom affiché" required><input type="text" bind:value={displayName} maxlength="200" /></Field>
      <Field label="Courriel"><input type="email" bind:value={email} maxlength="200" /></Field>
      <Field label="Fonction" hint="Ex. RSSI, DSI, responsable métier, direction, spécialiste de la menace."><input type="text" bind:value={fn} maxlength="200" /></Field>
      <div class="row">
        <button class="btn primary" onclick={save}>Enregistrer</button>
        {#if user.authSource !== "oidc"}<a class="btn" href="/mot-de-passe" use:link>Changer mon mot de passe</a>{/if}
      </div>
    </div>

    <div class="card col gap-lg">
      <h3 style="margin: 0"><Icon name="shield" size={16} /> Sécurité</h3>
      <div class="small">Connexion précédente : <strong>{fmt(me.previousLogin)}</strong></div>
      {#if me.authSource === "oidc"}
        <p class="small muted" style="margin: 0">Le second facteur est géré par le fournisseur d'identité de votre organisation.</p>
      {:else}
        <div class="row wrap">
          <span>Authentification multifacteur :</span>
          {#if me.mfaEnabled}<span class="badge green">active</span>{:else}<span class="badge orange">inactive</span>{/if}
          {#if mfaMandatory}<span class="muted small">(exigée par la politique de sécurité)</span>{/if}
        </div>
        <div class="row wrap">
          {#if me.mfaEnabled}
            <button class="btn sm" onclick={() => (sensitive = "codes")}>Nouveaux codes de secours</button>
            {#if !mfaMandatory}<button class="btn sm danger" onclick={() => (sensitive = "disable")}>Désactiver</button>{/if}
          {:else}
            <a class="btn sm primary" href="/securite/mfa" use:link>Activer</a>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="card mt-lg">
    <div class="card-title">
      <h3>Sessions ouvertes</h3>
      {#if sessions.length > 1}<button class="btn sm" onclick={revokeOthers}>Fermer toutes les autres sessions</button>{/if}
    </div>
    <p class="small muted">Une session inconnue ? Fermez-la, changez votre mot de passe et prévenez l'administrateur.</p>
    <div class="table-wrap auto">
      <table class="table">
        <thead><tr><th>Appareil</th><th>Adresse IP</th><th>Ouverte le</th><th>Dernière activité</th><th>Second facteur</th><th></th></tr></thead>
        <tbody>
          {#each sessions as s (s.id)}
            <tr>
              <td title={s.userAgent}>{device(s.userAgent)} {#if s.current}<span class="badge blue">cette session</span>{/if}</td>
              <td class="mono small">{s.ip}</td>
              <td class="small">{fmt(s.createdAt)}</td>
              <td class="small">{fmt(s.lastSeen)}</td>
              <td>{#if s.mfa}<span class="badge green">oui</span>{:else}<span class="muted small">non</span>{/if}</td>
              <td>{#if !s.current}<button class="btn sm ghost" onclick={() => revoke(s)}>Fermer</button>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

{#if sensitive}
  <Modal title={sensitive === "codes" ? "Nouveaux codes de secours" : "Désactiver l'authentification multifacteur"} onClose={closeSensitive}>
    {#if newCodes.length}
      <p class="small">Les anciens codes ne sont plus valables. Conservez ceux-ci en lieu sûr : ils ne seront plus affichés.</p>
      <RecoveryCodes codes={newCodes} username={me.username} />
    {:else}
      <form id="sensitive" class="col gap-lg" onsubmit={submitSensitive}>
        <p class="small muted" style="margin: 0">Opération sensible : confirmez avec votre mot de passe et un code de votre application.</p>
        <Field label="Mot de passe"><input type="password" autocomplete="current-password" bind:value={password} required maxlength="300" /></Field>
        <Field label="Code à usage unique"><input type="text" class="mono" inputmode="numeric" autocomplete="one-time-code" bind:value={code} required maxlength="7" /></Field>
        {#if error}<div class="callout danger" role="alert">{error}</div>{/if}
      </form>
    {/if}
    {#snippet footer()}
      {#if newCodes.length}
        <button class="btn primary" onclick={closeSensitive}>J'ai conservé ces codes</button>
      {:else}
        <button class="btn" onclick={closeSensitive}>Annuler</button>
        <button class="btn {sensitive === 'disable' ? 'danger' : 'primary'}" type="submit" form="sensitive" disabled={!password || !code}>Confirmer</button>
      {/if}
    {/snippet}
  </Modal>
{/if}
