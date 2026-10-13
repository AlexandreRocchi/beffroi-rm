<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";
  import type { AeNodeType } from "./types";

  let { data, selected }: NodeProps<AeNodeType> = $props();
</script>

<div class="goal-node" class:critical={data.critical} style:outline={selected ? "2px solid #2c5aa8" : undefined}>
  <Handle type="target" position={Position.Left} />
  🎯 {data.node.label || "Objectif visé"}
  {#if data.evalPr !== null}<div class="small" style="opacity: 0.8; font-weight: 500">indice global : {data.evalPr}{data.method === "advanced" ? ` / D ${data.evalDiff ?? "–"}` : ""}</div>{/if}
</div>
