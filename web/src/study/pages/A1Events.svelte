<script lang="ts">
  import { CRITERIA_LABELS, nextRef, uid, type FearedEvent } from "@beffroi/shared";
  import Icon from "../../components/Icon.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import LevelSelect from "../../components/LevelSelect.svelte";
  import Ref from "../../components/Ref.svelte";
  import { activable } from "../../lib/actions";
  import { isLight, levelColor } from "../../lib/levels";
  import { shortText } from "../helpers";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import FeDrawer from "./a1/FeDrawer.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  let edit = $state<string | null>(null);

  function add(bvId: string | null) {
    const id = uid();
    update((x) => void x.fearedEvents.push({ id, ref: nextRef("ER", x.fearedEvents), businessValueId: bvId, name: "", criteria: [], impactCategoryIds: [], impacts: "", gravity: null, justification: "", expressLikelihood: null }));
    edit = id;
  }
  const groups = $derived([
    ...d.businessValues.map((b) => ({ id: b.id as string | null, title: `${b.ref} · ${b.name}`, items: d.fearedEvents.filter((e) => e.businessValueId === b.id) })),
    { id: null as string | null, title: "Événements redoutés non liés à une valeur métier (risques non intentionnels)", items: d.fearedEvents.filter((e) => e.businessValueId === null) },
  ]);
  const gravities = $derived([...s.scales.gravity].sort((a, b) => a.value - b.value));
  const rows = $derived(
    d.businessValues.map((b) => {
      const fes = d.fearedEvents.filter((e) => e.businessValueId === b.id);
      const max = fes.reduce<number | null>((m, e) => (e.gravity !== null && (m === null || e.gravity > m) ? e.gravity : m), null);
      return { b, max, counts: gravities.map((g) => fes.filter((e) => e.gravity === g.value).length) };
    }),
  );
</script>

{#snippet feGroup(title: string, items: FearedEvent[], groupId: string | null)}
  <tr class="group-row">
    <td colspan="6">
      <div class="row between">
        <span>{title}</span>
        {#if !ro}<button class="btn sm ghost" onclick={() => add(groupId)}><Icon name="plus" size={12} /> Ajouter</button>{/if}
      </div>
    </td>
  </tr>
  {#each items as e (e.id)}
    {@const i = d.fearedEvents.indexOf(e)}
    <tr class="clickable" use:activable onclick={() => (edit = e.id)}>
      <td><Ref>{e.ref}</Ref></td>
      <td style="max-width: 420px">{#if e.name}{e.name}{:else}<span class="muted">Sans libellé</span>{/if}</td>
      <td class="nowrap">{#each e.criteria as c (c)}<span class="badge" title={CRITERIA_LABELS[c]} style="margin-right: 2px">{c}</span>{/each}</td>
      <td class="small">{e.impactCategoryIds.map((id) => s.catalogs.impactCategories.find((c) => c.id === id)?.label).filter(Boolean).join(", ")}</td>
      <td class="num" onclick={(ev) => ev.stopPropagation()} onkeydown={(ev) => ev.stopPropagation()} style="width: 170px">
        <LevelSelect scale={s.scales.gravity} value={e.gravity} prefix="G" disabled={ro} ariaLabel="Gravité {e.ref}" onChange={(v) => update((x) => void (x.fearedEvents[i].gravity = v))} />
      </td>
      <td class="small muted" style="max-width: 320px">{shortText(e.justification, 120)}</td>
    </tr>
  {/each}
  {#if items.length === 0}<tr><td colspan="6" class="muted small" style="padding-left: 24px">Aucun événement redouté.</td></tr>{/if}
{/snippet}

<PageTitle ws={1} title="Événements redoutés" subtitle="Atteintes préjudiciables aux valeurs métier (disponibilité, intégrité, confidentialité, traçabilité) et gravité de leurs impacts.">
  {#snippet actions()}
    {#if !ro}<button class="btn primary" onclick={() => add(d.businessValues[0]?.id ?? null)}><Icon name="plus" size={14} /> Événement redouté</button>{/if}
  {/snippet}
</PageTitle>

<div class="grid-2 mb-lg">
  <div class="card">
    <div class="card-title"><h3>Gravité par valeur métier</h3></div>
    <div class="table-wrap auto">
      <table class="table matrix-table" style="width: auto">
        <thead>
          <tr><th>Valeur métier</th>{#each gravities as g (g.value)}<th class="num" title={g.description}>G{g.value}</th>{/each}<th class="num">Max</th></tr>
        </thead>
        <tbody>
          {#each rows as r (r.b.id)}
            <tr>
              <td style="width: auto; text-align: left; padding: 4px 10px; white-space: nowrap"><Ref>{r.b.ref}</Ref> {r.b.name}</td>
              {#each gravities as g, gi (g.value)}
                {@const n = r.counts[gi]}
                {@const c = levelColor(s.scales.gravity, g.value)}
                <td style:background={n ? c : "#f4f6fa"} style:color={n ? (isLight(c) ? "#1b2333" : "#fff") : "#b0bec5"} style="font-weight: 700">{n || ""}</td>
              {/each}
              <td><LevelChip scale={s.scales.gravity} value={r.max} prefix="G" /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <div class="card">
    <div class="card-title"><h3>Échelle de gravité</h3></div>
    {#each [...s.scales.gravity].reverse() as g (g.value)}
      <div class="row top mb">
        <LevelChip scale={s.scales.gravity} value={g.value} prefix="G" />
        <div class="small"><strong>{g.label}</strong> — {g.description}</div>
      </div>
    {/each}
  </div>
</div>

<div class="table-wrap">
  <table class="table">
    <thead><tr><th>Réf.</th><th>Événement redouté</th><th>Critères</th><th>Impacts</th><th class="num">Gravité</th><th>Justification</th></tr></thead>
    <tbody>
      {#each groups as g (g.id ?? "none")}
        {@render feGroup(g.title, g.items, g.id)}
      {/each}
    </tbody>
  </table>
</div>
{#if edit}<FeDrawer id={edit} onClose={() => (edit = null)} />{/if}
