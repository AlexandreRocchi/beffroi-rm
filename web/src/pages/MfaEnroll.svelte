<script lang="ts">
  import Checkbox from "../components/Checkbox.svelte";
  import Field from "../components/Field.svelte";
  import RecoveryCodes from "../components/RecoveryCodes.svelte";
  import { Api } from "../lib/api";
  import { auth } from "../lib/auth.svelte";
  import { toast } from "../lib/feedback.svelte";
  import { link, router } from "../lib/router.svelte";

  /** Enrôlement du second facteur (TOTP) : ré-authentification, QR code et vérification, codes de secours. */
  let step = $state<"password" | "scan" | "codes">("password");
  let password = $state("");
  let setup = $state<{ secret: string; qr: string } | null>(null);
  let code = $state("");
  let codes = $state<string[]>([]);
  let saved = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
  const forced = $derived(!!auth.user?.mustEnrollMfa);
  /** Déjà actif à l'ouverture de la page (évalué une fois : l'activation ne doit pas masquer les codes). */
  const alreadyEnabled = !!auth.user?.mfaEnabled;

  async function start(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      setup = await Api.mfaSetup(password);
      password = "";
      step = "scan";
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }

  async function activate(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = null;
    try {
      const r = await Api.mfaActivate(code.replace(/\s/g, ""));
      codes = r.recoveryCodes;
      setup = null;
      auth.setUser(r.user);
      step = "codes";
    } catch (err) {
      error = (err as Error).message;
      code = "";
    } finally {
      busy = false;
    }
  }

  function finish() {
    toast("Authentification multifacteur activée.", "success");
    router.navigate("/", { replace: true });
  }
</script>

<div class="page narrow">
  <div class="section-title">
    <div>
      <div class="eyebrow">Sécurité du compte</div>
      <h1>Authentification multifacteur</h1>
      <div class="subtitle">Un code à usage unique, généré par une application sur votre téléphone, s'ajoute à votre mot de passe : un mot de passe dérobé ne suffit plus à accéder à vos analyses.</div>
    </div>
  </div>
  {#if forced && step === "password"}<div class="callout warning mb-lg">La politique de sécurité de votre organisation exige un second facteur avant d'accéder à l'application.</div>{/if}

  <div class="card col gap-lg" style="max-width: 620px">
    {#if alreadyEnabled}
      <p style="margin: 0">L'authentification multifacteur est déjà active sur votre compte.</p>
      <div class="row"><a class="btn primary" href="/profil" use:link>Gérer depuis mon profil</a></div>
    {:else if step === "password"}
      <form class="col gap-lg" onsubmit={start}>
        <h3 style="margin: 0">1. Confirmez votre identité</h3>
        <p class="muted small" style="margin: 0">Installez au préalable une application d'authentification (par exemple FreeOTP, Aegis ou celle de votre coffre-fort de mots de passe).</p>
        <Field label="Mot de passe actuel">
          <!-- svelte-ignore a11y_autofocus -->
          <input type="password" autocomplete="current-password" bind:value={password} required autofocus maxlength="300" />
        </Field>
        {#if error}<div class="callout danger" role="alert">{error}</div>{/if}
        <div class="row"><button class="btn primary" type="submit" disabled={busy || !password}>Continuer</button></div>
      </form>
    {:else if step === "scan" && setup}
      <form class="col gap-lg" onsubmit={activate}>
        <h3 style="margin: 0">2. Ajoutez le compte dans votre application</h3>
        <div class="row top wrap gap-lg">
          <img src={setup.qr} alt="QR code d'enrôlement du second facteur" width="200" height="200" style="border: 1px solid var(--border); border-radius: 8px; image-rendering: pixelated" />
          <div class="col grow" style="min-width: 220px">
            <p class="small" style="margin: 0">Scannez le QR code, ou saisissez la clé manuellement (type « basé sur le temps », 6 chiffres, 30 secondes) :</p>
            <code class="mono" style="font-size: 15px; word-break: break-all; padding: 8px; background: var(--surface-2); border-radius: 6px">{setup.secret}</code>
            <p class="muted small" style="margin: 0">Cette clé n'est affichée qu'une fois ; elle est ensuite conservée chiffrée sur le serveur.</p>
          </div>
        </div>
        <Field label="3. Saisissez le code affiché par l'application">
          <!-- svelte-ignore a11y_autofocus -->
          <input type="text" class="mono" inputmode="numeric" autocomplete="one-time-code" bind:value={code} required maxlength="7" autofocus placeholder="123456" style="font-size: 20px; letter-spacing: 4px; max-width: 200px" />
        </Field>
        {#if error}<div class="callout danger" role="alert">{error}</div>{/if}
        <div class="row"><button class="btn primary" type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6}>Activer</button></div>
      </form>
    {:else if step === "codes"}
      <h3 style="margin: 0">Codes de secours</h3>
      <p class="small" style="margin: 0">Si vous perdez votre téléphone, chacun de ces codes permet <strong>une</strong> connexion. Conservez-les hors ligne (coffre-fort de mots de passe, document imprimé rangé en lieu sûr) : ils ne seront plus jamais affichés.</p>
      <RecoveryCodes {codes} username={auth.user?.username ?? ""} />
      <Checkbox checked={saved} onChange={(v) => (saved = v)} label="J'ai conservé ces codes en lieu sûr" />
      <div class="row"><button class="btn primary" disabled={!saved} onclick={finish}>Terminer</button></div>
    {/if}
  </div>
</div>
