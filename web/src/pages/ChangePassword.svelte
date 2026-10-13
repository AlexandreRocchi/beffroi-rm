<script lang="ts">
  import Field from "../components/Field.svelte";
  import { Api } from "../lib/api";
  import { auth } from "../lib/auth.svelte";
  import { router } from "../lib/router.svelte";

  let current = $state("");
  let next = $state("");
  let confirmation = $state("");
  let error = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (next !== confirmation) return void (error = "La confirmation ne correspond pas au nouveau mot de passe.");
    try {
      const r = await Api.changePassword(current, next);
      auth.setUser(r.user);
      router.navigate(auth.landing(r.user, null), { replace: true });
    } catch (err) {
      error = (err as Error).message;
    }
  }
</script>

<div class="page narrow">
  <form class="card col gap-lg" style="max-width: 460px" onsubmit={submit}>
    <h2>Changer le mot de passe</h2>
    {#if auth.user?.authSource === "oidc"}
      <div class="callout">Votre compte s'authentifie auprès du fournisseur d'identité de votre organisation : le mot de passe se gère chez lui.</div>
    {:else}
      {#if auth.user?.mustChange}<div class="callout warning">Vous devez définir un nouveau mot de passe avant de continuer.</div>{/if}
      <Field label="Mot de passe actuel"><input type="password" autocomplete="current-password" bind:value={current} required /></Field>
      <Field label="Nouveau mot de passe" hint="Au moins 12 caractères et trois types (minuscules, majuscules, chiffres, caractères spéciaux) ; ni mot courant, ni votre nom, ni l'un de vos 5 derniers mots de passe. Une phrase de passe de plusieurs mots sans lien est idéale.">
        <input type="password" autocomplete="new-password" bind:value={next} required />
      </Field>
      <Field label="Confirmation"><input type="password" autocomplete="new-password" bind:value={confirmation} required /></Field>
      {#if error}<div class="callout danger">{error}</div>{/if}
      <div class="row">
        <button class="btn primary" type="submit">Enregistrer</button>
        {#if !auth.user?.mustChange}<button class="btn" type="button" onclick={() => router.back()}>Annuler</button>{/if}
      </div>
    {/if}
  </form>
</div>
