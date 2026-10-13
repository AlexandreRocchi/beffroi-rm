<script lang="ts">
  import type { RiskLevelDef } from "@beffroi/shared";

  let { levels, onChange, disabled = false }: { levels: RiskLevelDef[]; onChange: (fn: (l: RiskLevelDef[]) => void) => void; disabled?: boolean } = $props();
  const FIELDS = [["label", "Libellé"], ["acceptability", "Acceptabilité"]] as const;
</script>

<div class="card">
  <h4>Niveaux de risque et stratégie de traitement (atelier 5)</h4>
  <table class="table">
    <thead><tr><th>Niv.</th><th>Libellé</th><th>Acceptabilité</th><th>Intitulé des décisions et des actions</th><th>Couleur</th></tr></thead>
    <tbody>
      {#each levels as l, i (l.value)}
        <tr>
          <td class="num"><span class="level-chip" style:background={l.color}>{l.value}</span></td>
          {#each FIELDS as [k, label] (k)}
            <td><input type="text" class="inline-input" value={l[k]} {disabled} aria-label="{label} {l.value}" oninput={(e) => { const v = e.currentTarget.value; onChange((s) => void (s[i][k] = v)); }} /></td>
          {/each}
          <td><textarea class="inline-input" rows="2" style="min-height: 34px" value={l.decision} {disabled} aria-label="Décisions {l.value}" oninput={(e) => { const v = e.currentTarget.value; onChange((s) => void (s[i].decision = v)); }}></textarea></td>
          <td><input type="color" value={l.color ?? "#90a4ae"} {disabled} aria-label="Couleur {l.value}" oninput={(e) => { const v = e.currentTarget.value; onChange((s) => void (s[i].color = v)); }} style="width: 32px; height: 28px; border: 0; background: none" /></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
