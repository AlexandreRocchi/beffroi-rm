<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";
  import type { AeNodeType } from "./types";

  let { data, selected }: NodeProps<AeNodeType> = $props();
  const and = $derived(data.node.type === "and");
</script>

<div class="gate-node {and ? 'and' : 'or'}" style:outline={selected ? "2px solid #2c5aa8" : undefined} style:box-shadow={data.critical ? "0 0 0 3px rgba(211,47,47,.45)" : undefined}
  title={and ? "ET : toutes les actions en entrée sont nécessaires" : "OU : l'une des actions en entrée suffit"}>
  <Handle type="target" position={Position.Left} />
  {and ? "ET" : "OU"}
  <Handle type="source" position={Position.Right} />
</div>
