<script lang="ts">
  import Field from "../components/Field.svelte";
  import Logo from "../components/Logo.svelte";
  import { Api, ApiError } from "../lib/api";
  import { auth } from "../lib/auth.svelte";
  import { router } from "../lib/router.svelte";
  import { WS_COLORS } from "../study/nav";

  const STEPS = [
    ["Cadrage et socle de sécurité", "Périmètre, valeurs métier, événements redoutés, référentiels"],
    ["Sources de risque", "Couples source de risque / objectif visé et leur pertinence"],
    ["Scénarios stratégiques", "Écosystème, parties prenantes critiques, chemins d'attaque"],
    ["Scénarios opérationnels", "Graphes d'attaque et vraisemblance"],
    ["Traitement du risque", "Stratégie, plan de mesures, risques résiduels, suivi"],
  ];
  let username = $state("");
  let password = $state("");
  /** Étape « second facteur » après un mot de passe correct. */
  let mfa = $state(false);
  let useRecovery = $state(false);
  let code = $state("");
  let error = $state<string | null>(router.param("erreur"));
  let busy = $state(false);
  const from = $derived((router.state?.from as string | undefined) ?? null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      const r = await Api.login(username, password);
      password = "";
      if (r.mfaRequired) {
        mfa = true;
        return;
      }
      if (r.user) {
        auth.setUser(r.user);
        auth.notify(r.notice);
        router.navigate(auth.landing(r.user, from), { replace: true });
      }
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  async function submitCode(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      const r = await Api.loginMfa(useRecovery ? { recoveryCode: code } : { code });
      auth.setUser(r.user);
      auth.notify(r.notice);
      router.navigate(auth.landing(r.user, from), { replace: true });
    } catch (err) {
      code = "";
      if (err instanceof ApiError && err.body.restart) restart();
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  function restart() {
    mfa = false;
    useRecovery = false;
    code = "";
  }
</script>

<div class="login-page">
  <div class="login-hero">
    <Logo size={44} inverted tagline />
    <div class="hero-body">
      <h1>Appréciez et traitez vos risques numériques avec la méthode EBIOS Risk Manager.</h1>
      <p>Un atelier après l'autre, du périmètre jusqu'au plan de traitement, avec des cartographies de la menace, des graphes d'attaque cotés et des matrices de risque produits au fil de l'analyse.</p>
      <ol class="ws-steps">
        {#each STEPS as [t, d], i (t)}
          <li>
            <span class="n" style:border-color={WS_COLORS[i + 1]}>{i + 1}</span>
            <div><strong>{t}</strong><span>{d}</span></div>
          </li>
        {/each}
      </ol>
    </div>
    <div class="hero-foot">Conforme au guide EBIOS Risk Manager v1.5 et à ses fiches méthodes · auto-hébergé, données chiffrées au repos.</div>
    <svg class="deco" viewBox="0 0 200 200" aria-hidden="true">
      {#each [96, 76, 56, 36] as r (r)}
        <circle cx="100" cy="100" {r} fill="none" stroke="#fff" stroke-width="10" stroke-dasharray="{(2 * Math.PI * r) / 5 - 8} 8" />
      {/each}
      <circle cx="100" cy="100" r="14" fill="#fff" />
    </svg>
  </div>
  <div class="login-form">
    <div class="mobile-logo"><Logo size={40} tagline /></div>
    {#if !mfa}
      <form class="card col gap-lg" onsubmit={submit}>
        <div>
          <h2>Connexion</h2>
          <p class="muted">Accès réservé aux utilisateurs habilités.</p>
        </div>
        {#if auth.info.oidc}
          <a class="btn primary" href="/api/auth/oidc/login" style="height: 38px">{auth.info.oidc.label}</a>
          <div class="row small muted" style="gap: 8px"><span style="flex: 1; border-top: 1px solid var(--border)"></span>ou avec un compte local<span style="flex: 1; border-top: 1px solid var(--border)"></span></div>
        {/if}
        <Field label="Identifiant">
          <!-- svelte-ignore a11y_autofocus -->
          <input type="text" autocomplete="username" bind:value={username} autofocus required maxlength="200" />
        </Field>
        <Field label="Mot de passe">
          <input type="password" autocomplete="current-password" bind:value={password} required maxlength="300" />
        </Field>
        {#if !error && from?.startsWith("/etudes/")}
          <div class="callout warning small">Votre session a expiré. Reconnectez-vous pour reprendre votre travail : les modifications non enregistrées vous seront proposées.</div>
        {/if}
        {#if error}<div class="callout danger" role="alert">{error}</div>{/if}
        <button class={auth.info.oidc ? "btn" : "btn primary"} disabled={busy || !username || !password} type="submit" style="height: 38px">{busy ? "Connexion…" : "Se connecter"}</button>
        <p class="muted small">Toute connexion est journalisée. Le compte est verrouillé temporairement après plusieurs échecs.</p>
      </form>
    {:else}
      <form class="card col gap-lg" onsubmit={submitCode}>
        <div>
          <h2>Second facteur</h2>
          <p class="muted">{useRecovery ? "Saisissez l'un de vos codes de secours (chaque code n'est utilisable qu'une fois)." : "Saisissez le code à 6 chiffres affiché par votre application d'authentification."}</p>
        </div>
        {#if useRecovery}
          <Field label="Code de secours">
            <!-- svelte-ignore a11y_autofocus -->
            <input type="text" class="mono" autocomplete="off" spellcheck="false" bind:value={code} autofocus required maxlength="20" placeholder="xxxx-xxxx-xxxx" />
          </Field>
        {:else}
          <Field label="Code à usage unique">
            <!-- svelte-ignore a11y_autofocus -->
            <input type="text" class="mono" inputmode="numeric" autocomplete="one-time-code" bind:value={code} autofocus required maxlength="7" placeholder="123456" style="font-size: 20px; letter-spacing: 4px" />
          </Field>
        {/if}
        {#if error}<div class="callout danger" role="alert">{error}</div>{/if}
        <button class="btn primary" disabled={busy || !code.trim()} type="submit" style="height: 38px">{busy ? "Vérification…" : "Valider"}</button>
        <div class="row between small">
          <button type="button" class="btn ghost sm" onclick={() => { useRecovery = !useRecovery; code = ""; error = null; }}>{useRecovery ? "Utiliser l'application d'authentification" : "Utiliser un code de secours"}</button>
          <button type="button" class="btn ghost sm" onclick={restart}>Changer de compte</button>
        </div>
      </form>
    {/if}
  </div>
</div>
