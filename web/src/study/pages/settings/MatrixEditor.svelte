<script lang="ts">
  import { lookup, type Matrix, type ScaleLevel } from "@beffroi/shared";
  import { isLight, levelColor } from "../../../lib/levels";

  let { rows, cols, out, matrix, onChange, rowPrefix = "", colPrefix = "", disabled = false }: {
    rows: ScaleLevel[]; cols: ScaleLevel[]; out: ScaleLevel[]; matrix: Matrix; onChange: (r: string, c: string, v: number) => void; rowPrefix?: string; colPrefix?: string; disabled?: boolean;
  } = $props();
  const rs = $derived([...rows].sort((a, b) => b.value - a.value));
  const cs = $derived([...cols].sort((a, b) => a.value - b.value));
</script>

<table class="table matrix-table" style="width: auto">
  <thead><tr><th></th>{#each cs as c (c.value)}<th class="num" title={c.label}>{colPrefix}{c.value}</th>{/each}</tr></thead>
  <tbody>
    {#each rs as r (r.value)}
      <tr>
        <td style="width: auto; padding: 0 8px; text-align: left; font-size: 12px" title={r.label}><strong>{rowPrefix}{r.value}</strong> {r.label}</td>
        {#each cs as c (c.value)}
          {@const v = lookup(matrix, r.value, c.value)}
          {@const color = levelColor(out, v)}
          <td style:background={color} style:color={isLight(color) ? "#1b2333" : "#fff"} style="width: 64px">
            <select value={v ?? ""} {disabled} aria-label="{rowPrefix}{r.value} × {colPrefix}{c.value}" title={out.find((o) => o.value === v)?.label} onchange={(e) => onChange(String(r.value), String(c.value), Number(e.currentTarget.value))}>
              {#each out as o (o.value)}<option value={o.value}>{o.value} {o.label.slice(0, 8)}</option>{/each}
            </select>
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>
