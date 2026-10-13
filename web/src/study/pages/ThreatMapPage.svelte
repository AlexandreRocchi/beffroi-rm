<script lang="ts">
  import SrovRadar from "../../charts/SrovRadar.svelte";
  import StakeholderLegend from "../../charts/StakeholderLegend.svelte";
  import StakeholderRadar from "../../charts/StakeholderRadar.svelte";
  import ThreatMap from "../../charts/ThreatMap.svelte";
  import Checkbox from "../../components/Checkbox.svelte";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  const study = useStudy();
  let residual = $state(false);
</script>

<PageTitle title="Carte de la menace" subtitle="Vue de synthèse : qui menace l'objet de l'étude, dans quel but, quelles valeurs métier sont atteintes, avec quel niveau de risque, et par quels maillons de l'écosystème.">
  {#snippet actions()}<Checkbox checked={residual} onChange={(v) => (residual = v)} label="Niveaux résiduels" />{/snippet}
</PageTitle>
<div class="card mb-lg">
  <div class="card-title"><h3>Flux de la menace : sources de risque → objectifs visés → valeurs métier → niveau de risque</h3></div>
  <ThreatMap data={study.d} {residual} width={1200} />
</div>
<div class="grid-2">
  <div class="card">
    <h3>Sources de risque et objectifs visés</h3>
    <SrovRadar data={study.d} mode="source" size={520} />
  </div>
  <div class="card">
    <h3>Dangerosité de l'écosystème {residual ? "(résiduelle)" : "(initiale)"}</h3>
    <StakeholderRadar data={study.d} {residual} size={520} />
    <StakeholderLegend />
  </div>
</div>
