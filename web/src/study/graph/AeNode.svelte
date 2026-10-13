<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";
  import type { AeNodeType } from "./types";

  let { data, selected }: NodeProps<AeNodeType> = $props();
  const n = $derived(data.node);
</script>

<div class="ae-node" class:critical={data.critical} class:selected style:--c={data.color}>
  <Handle type="target" position={Position.Left} />
  <div class="ae-label">{#if n.label}{n.label}{:else}<em class="muted">Action élémentaire</em>{/if}</div>
  {#if data.assetName}<div class="ae-asset">⛁ {data.assetName}</div>{/if}
  <div class="ae-meta">
    <span class="badge blue" title="Probabilité de succès">Pr {n.probability ?? "?"}</span>
    {#if data.method === "advanced"}<span class="badge orange" title="Difficulté technique">D {n.difficulty ?? "?"}</span>{/if}
    <span style="flex: 1"></span>
    <span class="small" style="font-style: italic" style:color={data.critical ? "#d32f2f" : "#4a5468"} title="Indices cumulés intermédiaires">
      ({data.evalPr ?? "–"}{data.method === "advanced" ? ` / ${data.evalDiff ?? "–"}` : ""})
    </span>
  </div>
  <Handle type="source" position={Position.Right} />
</div>
