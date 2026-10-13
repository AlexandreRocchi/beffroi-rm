<script lang="ts">
  import { download } from "../export/csv";
  import { toast } from "../lib/feedback.svelte";
  import Icon from "./Icon.svelte";

  /** Affichage unique des codes de secours, avec téléchargement et copie. */
  let { codes, username }: { codes: string[]; username: string } = $props();
  const text = $derived(
    `Beffroi RM — codes de secours du compte « ${username} »\nGénérés le ${new Date().toLocaleString("fr-FR")}. Chaque code ne sert qu'une fois.\n\n${codes.join("\n")}\n`,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast("Codes copiés : collez-les dans votre coffre-fort, puis videz le presse-papiers.");
    } catch {
      toast("Copie impossible : téléchargez le fichier.", "error");
    }
  }
</script>

<ol class="recovery-codes mono" data-testid="recovery-codes">
  {#each codes as c (c)}<li>{c}</li>{/each}
</ol>
<div class="row">
  <button class="btn sm" onclick={() => download(`beffroi-codes-de-secours-${username}.txt`, text, "text/plain")}><Icon name="download" size={13} /> Télécharger (.txt)</button>
  <button class="btn sm" onclick={copy}><Icon name="copy" size={13} /> Copier</button>
</div>
