<script lang="ts">
  import { pertinence, srovGravity } from "@beffroi/shared";
  import SrovRadar from "../../charts/SrovRadar.svelte";
  import Checkbox from "../../components/Checkbox.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import Ref from "../../components/Ref.svelte";
  import Tabs from "../../components/Tabs.svelte";
  import { activable } from "../../lib/actions";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  let mode = $state<"source" | "objective">("source");
  let onlyRetained = $state(false);
  let sel = $state<string | null>(null);
  const pairs = $derived(d.srovPairs);
  const selected = $derived(pairs.find((p) => p.id === sel));
  const fes = $derived(d.fearedEvents.filter((f) => f.businessValueId !== null));
  const orphanFe = $derived(fes.filter((f) => !pairs.some((p) => p.retained && p.fearedEventIds.includes(f.id))));
  const orphanPairs = $derived(pairs.filter((p) => p.retained && p.fearedEventIds.length === 0));
  const sorted = $derived([...pairs].sort((a, b) => (pertinence(s, b).value ?? 0) - (pertinence(s, a).value ?? 0)));
  const srName = (id: string) => d.riskSources.find((x) => x.id === id)?.name;

  function toggle(pi: number, feId: string, on: boolean) {
    update((x) => {
      const l = x.srovPairs[pi].fearedEventIds;
      if (on) l.push(feId);
      else x.srovPairs[pi].fearedEventIds = l.filter((y) => y !== feId);
    });
  }
</script>

<PageTitle ws={2} title="Cartographie des sources de risque" subtitle="Sélection des couples SR/OV (distance au centre = pertinence) et croisement des objectifs visés avec les événements redoutés." />
<div class="grid-2 mb-lg" style="grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr)">
  <div class="card">
    <div class="row between wrap">
      <Tabs value={mode} onChange={(v) => (mode = v)} tabs={[{ id: "source", label: "Par source de risque" }, { id: "objective", label: "Par objectif visé" }]} />
      <Checkbox checked={onlyRetained} onChange={(v) => (onlyRetained = v)} label="Couples retenus uniquement" />
    </div>
    {#if pairs.length}
      <SrovRadar data={d} {mode} {onlyRetained} onPointClick={(id) => (sel = id)} selectedId={sel} />
    {:else}
      <div class="empty">Aucun couple SR/OV.</div>
    {/if}
    <div class="legend">
      <span><span class="sw" style="background: #3949ab"></span>Couple retenu (plein)</span>
      <span><span class="sw" style="background: #fff; border: 2px solid #3949ab"></span>Couple non retenu</span>
      <span>Plus proche du centre = plus pertinent · taille accrue = P1</span>
    </div>
  </div>
  <div class="col gap-lg">
    <div class="card">
      <h3>Sélection des couples</h3>
      <p class="small muted">Privilégier des couples proches du centre et suffisamment distincts, impactant différentes valeurs métier.</p>
      <div class="table-wrap auto">
        <table class="table">
          <thead><tr><th>Réf.</th><th>Couple</th><th class="num">Pertinence</th><th class="num">Retenu</th></tr></thead>
          <tbody>
            {#each sorted as p (p.id)}
              {@const pi = pairs.indexOf(p)}
              <tr class="clickable" class:selected={sel === p.id} use:activable onclick={() => (sel = p.id)}>
                <td><Ref>{p.ref}</Ref></td>
                <td class="small" style="min-width: 220px"><strong>{srName(p.riskSourceId)}</strong><div class="rich clamp" title={p.objective}>{p.objective}</div></td>
                <td class="num"><LevelChip scale={s.scales.pertinence} value={pertinence(s, p).value} showLabel /></td>
                <td class="num"><Checkbox checked={p.retained} disabled={ro} onChange={(v) => update((x) => { x.srovPairs[pi].retained = v; if (v && !x.srovPairs[pi].priority) x.srovPairs[pi].priority = "P1"; })} /></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    {#if selected}
      <div class="card">
        <h3><Ref>{selected.ref}</Ref> {srName(selected.riskSourceId)}</h3>
        <p>{selected.objective}</p>
        <div class="row wrap small">
          Motivation <LevelChip scale={s.scales.motivation} value={selected.motivation} showLabel />
          Ressources <LevelChip scale={s.scales.resources} value={selected.resources} showLabel />
          Activité <LevelChip scale={s.scales.activity} value={selected.activity} showLabel />
        </div>
      </div>
    {/if}
  </div>
</div>

<div class="card">
  <div class="card-title"><h3>Croisement objectifs visés / événements redoutés</h3><span class="muted small">Chaque ER doit être relié à un couple SR/OV et réciproquement ; les OV héritent de la gravité des ER.</span></div>
  {#if orphanFe.length > 0 || orphanPairs.length > 0}
    <div class="callout warning mb">
      {#if orphanFe.length > 0}<div>ER non reliés à un couple retenu : {orphanFe.map((f) => f.ref).join(", ")}.</div>{/if}
      {#if orphanPairs.length > 0}<div>Couples retenus sans ER : {orphanPairs.map((p) => p.ref).join(", ")}.</div>{/if}
    </div>
  {/if}
  <div class="table-wrap auto">
    <table class="table">
      <thead>
        <tr>
          <th class="sticky-col">Événement redouté</th>
          {#each pairs as p (p.id)}<th class="num" title={p.objective} style:opacity={p.retained ? 1 : 0.5}>{p.ref}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each fes as f (f.id)}
          <tr>
            <td class="sticky-col" style="min-width: 320px"><Ref>{f.ref}</Ref> <span class="small">{f.name}</span> <LevelChip scale={s.scales.gravity} value={f.gravity} prefix="G" /></td>
            {#each pairs as p, pi (p.id)}
              {@const on = p.fearedEventIds.includes(f.id)}
              <td class="num" style:background={on ? "#e8eefb" : undefined}>
                <input type="checkbox" checked={on} disabled={ro} title="{p.ref} ↔ {f.ref}" aria-label="{p.ref} ↔ {f.ref}" onchange={(e) => toggle(pi, f.id, e.currentTarget.checked)} />
              </td>
            {/each}
          </tr>
        {/each}
        <tr class="group-row">
          <td class="sticky-col">Gravité héritée par l'objectif visé</td>
          {#each pairs as p (p.id)}<td class="num"><LevelChip scale={s.scales.gravity} value={srovGravity(d, p)} prefix="G" /></td>{/each}
        </tr>
      </tbody>
    </table>
  </div>
</div>
