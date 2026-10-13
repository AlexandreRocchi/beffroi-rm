<script lang="ts">
  import Modal from "../../components/Modal.svelte";

  let { username, password, onClose }: { username: string; password: string; onClose: () => void } = $props();
</script>

<Modal title="Mot de passe temporaire" {onClose}>
  <p>Transmettez ce mot de passe à <strong>{username}</strong> par un canal sûr. Il ne sera plus affiché et devra être changé à la première connexion.</p>
  <div class="card mono" style="font-size: 16px; text-align: center; user-select: all">{password}</div>
  {#snippet footer()}<button class="btn primary" onclick={onClose}>J'ai transmis le mot de passe</button>{/snippet}
</Modal>
