<script lang="ts">
  import { evaluateStakeholder, nextRef, uid, type AttackPath, type PathStep } from "@beffroi/shared";
  import Checkbox from "../../../components/Checkbox.svelte";
  import Combo from "../../../components/Combo.svelte";
  import Field from "../../../components/Field.svelte";
  import Icon from "../../../components/Icon.svelte";
  import LevelChip from "../../../components/LevelChip.svelte";
  import Ref from "../../../components/Ref.svelte";
  import RichText from "../../../components/RichText.svelte";
  import { buildOptions } from "../../helpers";
  import { useStudy } from "../../study.svelte";
  import { confirmDelete } from "../../useDelete";

  const DND = "application/x-beffroi-step";

  let { scenarioIndex: si }: { scenarioIndex: number } = $props();
  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  const sc = $derived(d.strategicScenarios[si]);
  const pair = $derived(d.srovPairs.find((p) => p.id === sc?.srovId));
  const critical = $derived(d.stakeholders.filter((x) => evaluateStakeholder(s, x).critical));
  const others = $derived(d.stakeholders.filter((x) => !critical.includes(x)));
  const pairFes = $derived(d.fearedEvents.filter((f) => pair?.fearedEventIds.includes(f.id)));
  const otherFes = $derived(d.fearedEvents.filter((f) => f.businessValueId && !pair?.fearedEventIds.includes(f.id)));
  const feOptions = $derived(opts.fe.filter((o) => o.group !== "Non liés à une valeur métier"));

  const setP = (pi: number, fn: (x: AttackPath) => void, key?: string) => update((x) => fn(x.strategicScenarios[si].paths[pi]), key && `ca-${sc.paths[pi].id}-${key}`);

  function addStep(pi: number, step: Omit<PathStep, "id">, at?: number) {
    update((x) => {
      const steps = x.strategicScenarios[si].paths[pi].steps;
      steps.splice(at ?? steps.length, 0, { id: uid(), ...step });
    });
  }
  function dropStep(pi: number, e: DragEvent, at?: number) {
    e.preventDefault();
    const raw = e.dataTransfer?.getData(DND);
    if (!raw) return;
    const x = JSON.parse(raw) as { kind: "intermediate" | "feared"; id: string };
    if (x.kind === "intermediate") {
      const sh = d.stakeholders.find((y) => y.id === x.id);
      addStep(pi, { kind: "intermediate", stakeholderId: x.id, fearedEventId: null, label: `Compromission de ${sh?.name ?? "la partie prenante"}` }, at);
    } else {
      const fe = d.fearedEvents.find((y) => y.id === x.id);
      addStep(pi, { kind: "feared", stakeholderId: null, fearedEventId: x.id, label: fe?.name ?? "" }, at);
    }
  }
  const drag = (kind: string, id: string) => (e: DragEvent) => e.dataTransfer?.setData(DND, JSON.stringify({ kind, id }));
  function move(pi: number, k: number, delta: number) {
    setP(pi, (x) => {
      const [m] = x.steps.splice(k, 1);
      x.steps.splice(k + delta, 0, m);
    });
  }
  const addPath = () => update((x) => void x.strategicScenarios[si].paths.push({ id: uid(), ref: nextRef("CA", x.strategicScenarios[si].paths), name: "", description: "", steps: [], retained: true }));
</script>

{#snippet palItem(kind: string, id: string, label: string, color: string)}
  <div class="graph-palette" style="padding: 0; background: none">
    <div class="pal-item" draggable="true" role="listitem" ondragstart={drag(kind, id)} style:--c={color}>{label}</div>
  </div>
{/snippet}

{#if sc}
  <div class="grid-2" style="grid-template-columns: minmax(0, 1fr) 260px">
    <div class="col gap-lg">
      {#each sc.paths as p, pi (p.id)}
        <div class="card" style:opacity={p.retained ? 1 : 0.7}>
          <div class="row between mb">
            <div class="row grow">
              <Ref>{p.ref}</Ref>
              <input type="text" class="inline-input grow" style="font-weight: 650" value={p.name} disabled={ro} placeholder="Nom du chemin d'attaque" aria-label="Nom du chemin d'attaque" oninput={(e) => setP(pi, (x) => void (x.name = e.currentTarget.value), "name")} />
            </div>
            <Checkbox checked={p.retained} disabled={ro} label="Retenu" onChange={(v) => setP(pi, (x) => void (x.retained = v))} />
            {#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer le chemin" onclick={() => confirmDelete(study, `le chemin ${p.ref}`, (x) => void x.strategicScenarios[si].paths.splice(pi, 1))}><Icon name="trash" size={13} /></button>{/if}
          </div>
          <Field label="Description du chemin"><RichText value={p.description} disabled={ro} minHeight={36} onChange={(v) => setP(pi, (x) => void (x.description = v), "desc")} /></Field>
          <div class="mt" role="list" ondragover={(e) => e.preventDefault()} ondrop={(e) => dropStep(pi, e)}
            style="border: 1.5px dashed var(--border-strong); border-radius: 8px; padding: 8px; background: var(--surface-2)">
            <div class="row small" style="margin-bottom: 6px">
              <span class="badge">{d.riskSources.find((r) => r.id === pair?.riskSourceId)?.name ?? "Source de risque"}</span>
              <Icon name="right" size={12} />
              <span class="muted">séquence d'événements (glissez des éléments depuis la palette)</span>
            </div>
            {#each p.steps as st, k (st.id)}
              {@const inter = st.kind === "intermediate"}
              <div class="row" role="listitem" style="margin-bottom: 6px; background: #fff; border-radius: 7px; padding: 6px 8px" style:border="1.5px solid {inter ? '#ef6c00' : '#c62828'}"
                ondragover={(e) => e.preventDefault()} ondrop={(e) => { e.stopPropagation(); dropStep(pi, e, k); }}>
                <span class="badge" style:background={inter ? "#fff3e0" : "#fdecec"} style:color={inter ? "#b35c00" : "#c62828"}>
                  {inter ? "Événement intermédiaire" : "Événement redouté"}
                </span>
                <div style="width: 220px">
                  {#if inter}
                    <Combo options={opts.sh} value={st.stakeholderId} disabled={ro} placeholder="Partie prenante…" onChange={(v) => setP(pi, (x) => void (x.steps[k].stakeholderId = v))} />
                  {:else}
                    <Combo options={feOptions} value={st.fearedEventId} disabled={ro} placeholder="Événement redouté…" onChange={(v) => setP(pi, (x) => void (x.steps[k].fearedEventId = v))} />
                  {/if}
                </div>
                <input type="text" class="grow" value={st.label} disabled={ro} placeholder="Libellé de l'événement" aria-label="Libellé de l'événement" oninput={(e) => setP(pi, (x) => void (x.steps[k].label = e.currentTarget.value), `st-${st.id}`)} />
                {#if !inter}<LevelChip scale={s.scales.gravity} value={d.fearedEvents.find((f) => f.id === st.fearedEventId)?.gravity} prefix="G" />{/if}
                {#if !ro}
                  <button class="btn ghost sm icon" disabled={k === 0} onclick={() => move(pi, k, -1)} title="Monter"><Icon name="up" size={13} /></button>
                  <button class="btn ghost sm icon" disabled={k === p.steps.length - 1} onclick={() => move(pi, k, 1)} title="Descendre"><Icon name="down" size={13} /></button>
                  <button class="btn ghost sm icon" onclick={() => setP(pi, (x) => void x.steps.splice(k, 1))} title="Retirer"><Icon name="close" size={13} /></button>
                {/if}
              </div>
            {/each}
            {#if !ro}
              <div class="row">
                <button class="btn sm" onclick={() => addStep(pi, { kind: "intermediate", stakeholderId: null, fearedEventId: null, label: "" })}><Icon name="plus" size={12} /> Événement intermédiaire</button>
                <button class="btn sm" onclick={() => addStep(pi, { kind: "feared", stakeholderId: null, fearedEventId: pairFes[0]?.id ?? null, label: pairFes[0]?.name ?? "" })}><Icon name="plus" size={12} /> Événement redouté</button>
              </div>
            {/if}
            {#if p.steps.length > 0 && !p.steps.some((x) => x.kind === "feared")}<div class="small" style="color: var(--warning); margin-top: 6px">Le chemin doit aboutir à au moins un événement redouté sur une valeur métier.</div>{/if}
          </div>
        </div>
      {/each}
      {#if !ro}
        <button class="btn" style="align-self: flex-start" onclick={addPath}><Icon name="plus" size={14} /> Chemin d'attaque</button>
      {/if}
      {#if sc.paths.length > 3}<div class="callout small">1 à 3 chemins d'attaque par couple SR/OV suffisent généralement (attaque directe, par rebond, sur parties prenantes).</div>{/if}
    </div>
    {#if !ro}
      <div class="card" style="position: sticky; top: 0; align-self: flex-start; max-height: 80vh; overflow-y: auto; padding: 12px">
        <h4>Palette</h4>
        <div class="small muted mb">Glissez un élément dans un chemin d'attaque.</div>
        <div class="eyebrow" style="color: #b35c00">Parties prenantes critiques</div>
        {#each critical as x (x.id)}{@render palItem("intermediate", x.id, `${x.ref} · ${x.name}`, "#ef6c00")}{/each}
        {#if critical.length === 0}<div class="small muted">Aucune partie prenante critique.</div>{/if}
        <details class="small mb">
          <summary>Autres parties prenantes</summary>
          {#each others as x (x.id)}{@render palItem("intermediate", x.id, `${x.ref} · ${x.name}`, "#ffcc80")}{/each}
        </details>
        <div class="eyebrow mt" style="color: #c62828">ER du couple SR/OV</div>
        {#each pairFes as f (f.id)}{@render palItem("feared", f.id, `${f.ref} · ${f.name}`, "#c62828")}{/each}
        {#if pairFes.length === 0}<div class="small muted">Aucun ER relié au couple (atelier 2).</div>{/if}
        <details class="small">
          <summary>Autres événements redoutés</summary>
          {#each otherFes as f (f.id)}{@render palItem("feared", f.id, `${f.ref} · ${f.name}`, "#ef9a9a")}{/each}
        </details>
      </div>
    {/if}
  </div>
{/if}
