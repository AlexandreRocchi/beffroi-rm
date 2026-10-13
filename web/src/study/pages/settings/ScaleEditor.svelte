<script lang="ts">
  import type { ScaleLevel } from "@beffroi/shared";
  import { isLight, levelColor } from "../../../lib/levels";

  let { title, scale, onChange, withColor = false, disabled = false }: { title: string; scale: ScaleLevel[]; onChange: (fn: (s: ScaleLevel[]) => void) => void; withColor?: boolean; disabled?: boolean } = $props();
</script>

<div class="card">
  <h4>{title}</h4>
  <table class="table">
    <tbody>
      {#each scale as l, i (l.value)}
        {@const c = levelColor(scale, l.value)}
        <tr>
          <td class="num" style="width: 40px"><span class="level-chip" style:background={c} style:color={isLight(c) ? "#1b2333" : "#fff"}>{l.value}</span></td>
          <td style="width: 160px"><input type="text" class="inline-input" value={l.label} {disabled} aria-label="Libellé du niveau {l.value}" oninput={(e) => { const v = e.currentTarget.value; onChange((s) => void (s[i].label = v)); }} /></td>
          <td><textarea class="inline-input" rows="2" style="min-height: 34px" value={l.description} {disabled} aria-label="Description du niveau {l.value}" oninput={(e) => { const v = e.currentTarget.value; onChange((s) => void (s[i].description = v)); }}></textarea></td>
          {#if withColor}
            <td style="width: 44px"><input type="color" value={l.color ?? "#90a4ae"} {disabled} aria-label="Couleur du niveau {l.value}" oninput={(e) => { const v = e.currentTarget.value; onChange((s) => void (s[i].color = v)); }} style="width: 32px; height: 28px; border: 0; background: none" /></td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
