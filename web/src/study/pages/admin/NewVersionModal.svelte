<script lang="ts">
  import Checkbox from "../../../components/Checkbox.svelte";
  import Field from "../../../components/Field.svelte";
  import Modal from "../../../components/Modal.svelte";
  import { WORKSHOPS } from "../../nav";

  type Body = { changeType: "operational" | "strategic"; summary: string; workshops: number[] };
  let { current, onClose, onCreate }: { current: string; onClose: () => void; onCreate: (b: Body) => void } = $props();
  let changeType = $state<"operational" | "strategic">("operational");
  let summary = $state("");
  let workshops = $state<number[]>([4]);
  const [maj, min] = $derived(current.split(".").map(Number));
  const next = $derived(changeType === "strategic" ? `${maj + 1}.0` : `${maj}.${min + 1}`);
</script>

<Modal title="Nouvelle version de l'analyse" {onClose}>
  <Field label="Type de mise à jour">
    <label class="checkbox"><input type="radio" checked={changeType === "operational"} onchange={() => { changeType = "operational"; workshops = [4]; }} /> Cycle opérationnel (incidents, nouvelles vulnérabilités, évolution des modes opératoires) → v{maj}.{min + 1}</label>
    <label class="checkbox"><input type="radio" checked={changeType === "strategic"} onchange={() => { changeType = "strategic"; workshops = [1, 2, 3, 4, 5]; }} /> Cycle stratégique (revue de l'ensemble de l'étude) → v{maj + 1}.0</label>
  </Field>
  <Field label="Ateliers concernés" required>
    <div class="row wrap">
      {#each WORKSHOPS as w (w.n)}
        <Checkbox checked={workshops.includes(w.n)} onChange={(v) => (workshops = v ? [...workshops, w.n].sort() : workshops.filter((x) => x !== w.n))} label="A{w.n} · {w.short}" />
      {/each}
    </div>
  </Field>
  <Field label="Modifications majeures apportées" required>
    <textarea rows="4" bind:value={summary} placeholder="Ex. prise en compte de l'incident du 12/03, nouveau prestataire d'infogérance, réévaluation des scénarios opérationnels…"></textarea>
  </Field>
  <p class="small muted">La version courante sera figée (consultable en lecture seule) et une nouvelle version modifiable sera créée à partir de son contenu.</p>
  {#snippet footer()}
    <button class="btn" onclick={onClose}>Annuler</button>
    <button class="btn primary" disabled={!summary.trim() || !workshops.length} onclick={() => onCreate({ changeType, summary, workshops })}>Figer v{current} et ouvrir v{next}</button>
  {/snippet}
</Modal>
