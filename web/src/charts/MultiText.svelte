<script lang="ts">
  let { x, y, lines, lineHeight = 13, anchor = "middle", fontSize, fontWeight, fill }: {
    x: number; y: number; lines: string[]; lineHeight?: number; anchor?: "start" | "middle" | "end"; fontSize?: number; fontWeight?: number; fill?: string;
  } = $props();
  const start = $derived(y - ((lines.length - 1) * lineHeight) / 2);
</script>

<text {x} text-anchor={anchor} font-size={fontSize} font-weight={fontWeight} {fill}>
  {#each lines as l, i (i)}<tspan {x} y={start + i * lineHeight} dominant-baseline="middle">{l}</tspan>{/each}
</text>
