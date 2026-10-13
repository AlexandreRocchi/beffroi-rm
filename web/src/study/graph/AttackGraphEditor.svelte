<script lang="ts">
  import { SvelteFlowProvider } from "@xyflow/svelte";
  import type { GraphEval } from "@beffroi/shared";
  import GraphEditor from "./GraphEditor.svelte";

  /** Éditeur de graphe d'attaque (Svelte Flow) : le fournisseur donne accès au viewport pour le glisser-déposer. */
  let props: { scenarioIndex: number; evaluation: GraphEval | null; highlight: string[] | null } = $props();
</script>

<SvelteFlowProvider>
  <GraphEditor {...props} />
</SvelteFlowProvider>
