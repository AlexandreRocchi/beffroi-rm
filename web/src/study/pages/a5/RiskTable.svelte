<script lang="ts">
  import type { RiskRow } from "@beffroi/shared";
  import LevelChip from "../../../components/LevelChip.svelte";
  import Ref from "../../../components/Ref.svelte";
  import { activable } from "../../../lib/actions";
  import { useStudy } from "../../study.svelte";
  import { SRC } from "./risk";

  let { rows, onOpen, compact = false }: { rows: RiskRow[]; onOpen: (id: string) => void; compact?: boolean } = $props();
  const study = useStudy();
  const s = $derived(study.d.settings);
</script>

<div class="table-wrap auto">
  <table class="table">
    <thead>
      <tr>
        <th>Réf.</th><th>Scénario de risque</th>
        {#if !compact}<th>Source de risque</th><th>Objectif visé</th>{/if}
        <th>Événements redoutés</th><th>Chemin / scénario opérationnel</th>
        <th class="num">Gravité</th><th class="num">Vraisemblance</th><th class="num">Niveau</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.record.id)}
        <tr class="clickable" class:dim={!r.active} use:activable onclick={() => onOpen(r.record.id)}>
          <td><Ref>{r.record.ref}</Ref></td>
          <td style="max-width: 320px">{r.record.title}</td>
          {#if !compact}
            <td>{#if r.riskSourceName}{r.riskSourceName}{:else}<span class="muted">Non intentionnel</span>{/if}</td>
            <td class="small" style="max-width: 240px">{r.objective}</td>
          {/if}
          <td class="small">{r.fearedEvents.map((f) => f.ref).join(", ")}</td>
          <td class="small">{r.scenario && r.path ? `${r.scenario.ref}.${r.path.ref}` : "—"}{r.operational ? ` · ${r.operational.ref}` : ""}</td>
          <td class="num"><LevelChip scale={s.scales.gravity} value={r.gravity.value} prefix="G" forced={r.gravity.forced !== null} /></td>
          <td class="num" title="Origine : {SRC[r.likelihood.source]}"><LevelChip scale={s.scales.likelihood} value={r.likelihood.value} prefix="V" forced={r.likelihood.forced !== null} /></td>
          <td class="num"><LevelChip scale={s.scales.riskLevels} value={r.level} showLabel /></td>
        </tr>
      {/each}
      {#if rows.length === 0}<tr><td colspan="9" class="muted center">Aucun scénario de risque.</td></tr>{/if}
    </tbody>
  </table>
</div>
