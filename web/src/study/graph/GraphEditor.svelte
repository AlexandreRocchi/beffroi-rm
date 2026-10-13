<script lang="ts">
  import { untrack } from "svelte";
  import {
    Background,
    Controls,
    MarkerType,
    MiniMap,
    SvelteFlow,
    useSvelteFlow,
    ViewportPortal,
    type Connection,
    type Edge,
    type NodeTypes,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { evaluateGraph, uid, type GraphEval, type GraphNode, type OperationalScenario } from "@beffroi/shared";
  import { ACTION_W, LANE_W } from "../../charts/attackGraph";
  import Combo from "../../components/Combo.svelte";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import LevelSelect from "../../components/LevelSelect.svelte";
  import { matches } from "../../lib/levels";
  import { buildOptions } from "../helpers";
  import { useStudy } from "../study.svelte";
  import AeNode from "./AeNode.svelte";
  import GateNode from "./GateNode.svelte";
  import GoalNode from "./GoalNode.svelte";
  import { DND, type AeNodeType } from "./types";

  let { scenarioIndex: oi, evaluation, highlight }: { scenarioIndex: number; evaluation: GraphEval | null; highlight: string[] | null } = $props();

  const nodeTypes = { action: AeNode, and: GateNode, or: GateNode, goal: GoalNode } as unknown as NodeTypes;
  const flow = useSvelteFlow();
  const study = useStudy();
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  const os = $derived(d.operationalScenarios[oi]);
  const phases = $derived(s.catalogs.attackPhases);
  const method = $derived(s.likelihoodMethod === "express" ? "standard" : s.likelihoodMethod);
  let selNode = $state<string | null>(null);
  let selEdge = $state<string | null>(null);
  let q = $state("");
  let full = $state(false);

  const ev = $derived(evaluation ?? evaluateGraph(s, os, method));
  const crit = $derived(new Set(highlight ?? ev.criticalNodeIds));
  const critEdges = $derived(new Set(highlight ? os.edges.filter((e) => highlight.includes(e.source) && highlight.includes(e.target)).map((e) => e.id) : ev.criticalEdgeIds));

  // Nœuds et liens affichés : reconstruits depuis l'étude, en conservant la sélection courante de Svelte Flow.
  let nodes = $state.raw<AeNodeType[]>([]);
  let edges = $state.raw<Edge[]>([]);
  $effect.pre(() => {
    const selected = new Set(untrack(() => nodes.filter((n) => n.selected).map((n) => n.id)));
    const pending = selNode;
    nodes = os.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: n.x, y: n.y },
      selected: selected.has(n.id) || n.id === pending,
      draggable: !ro,
      data: {
        node: n,
        color: phases.find((p) => p.id === n.phaseId)?.color ?? "#90a4ae",
        critical: crit.has(n.id),
        evalPr: ev.nodes[n.id]?.pr ?? null,
        evalDiff: ev.nodes[n.id]?.diff ?? null,
        method,
        assetName: n.supportingAssetId ? (d.supportingAssets.find((a) => a.id === n.supportingAssetId)?.name ?? null) : n.stakeholderId ? (d.stakeholders.find((x) => x.id === n.stakeholderId)?.name ?? null) : null,
      },
    }));
  });
  $effect.pre(() => {
    const selected = new Set(untrack(() => edges.filter((e) => e.selected).map((e) => e.id)));
    edges = os.edges.map((e) => {
      const c = critEdges.has(e.id);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        selected: selected.has(e.id),
        animated: c,
        style: `stroke: ${c ? "#d32f2f" : "#90a4ae"}; stroke-width: ${c ? 2.6 : 1.6}${e.dashed ? "; stroke-dasharray: 6 4" : ""}`,
        markerEnd: { type: MarkerType.ArrowClosed, color: c ? "#d32f2f" : "#90a4ae" },
      };
    });
  });

  $effect(() => {
    void full;
    const t = setTimeout(() => void flow.fitView({ padding: 0.12 }), 60);
    return () => clearTimeout(t);
  });

  const setOs = (fn: (x: OperationalScenario) => void, key?: string) => study.update((x) => fn(x.operationalScenarios[oi]), key);

  function phaseOfX(x: number) {
    const idx = Math.floor((x + ACTION_W / 2) / LANE_W);
    return idx >= 0 && idx < phases.length ? phases[idx].id : null;
  }

  function onDragStop({ nodes: moved }: { nodes: AeNodeType[] }) {
    if (ro || !moved.length) return;
    setOs((x) => {
      for (const m of moved) {
        const n = x.nodes.find((y) => y.id === m.id);
        if (!n) continue;
        n.x = Math.round(m.position.x);
        n.y = Math.round(m.position.y);
        if (n.type === "action") n.phaseId = phaseOfX(n.x) ?? n.phaseId;
      }
    });
  }

  function onDelete({ nodes: ns, edges: es }: { nodes: AeNodeType[]; edges: Edge[] }) {
    if (ro) return;
    const nIds = new Set(ns.map((n) => n.id));
    const eIds = new Set(es.map((e) => e.id));
    setOs((x) => {
      x.nodes = x.nodes.filter((n) => !nIds.has(n.id));
      x.edges = x.edges.filter((e) => !eIds.has(e.id) && !nIds.has(e.source) && !nIds.has(e.target));
    });
    if (selNode && nIds.has(selNode)) selNode = null;
    if (selEdge && eIds.has(selEdge)) selEdge = null;
  }

  // Le lien est ajouté à l'étude (et non par Svelte Flow) pour passer par l'historique d'annulation.
  function onBeforeConnect(c: Connection): false {
    if (ro || !c.source || !c.target || c.source === c.target) return false;
    if (!os.edges.some((e) => e.source === c.source && e.target === c.target)) setOs((x) => void x.edges.push({ id: uid(), source: c.source, target: c.target }));
    return false;
  }

  function onSelectionChange({ nodes: ns, edges: es }: { nodes: AeNodeType[]; edges: Edge[] }) {
    if (ns.length) {
      selNode = ns[0].id;
      selEdge = null;
    } else if (es.length) {
      selEdge = es[0].id;
      selNode = null;
    } else {
      selNode = null;
      selEdge = null;
    }
  }

  function addNode(partial: Partial<GraphNode>, pos: { x: number; y: number }) {
    const id = uid();
    nodes = nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
    selEdge = null;
    selNode = id;
    setOs((x) => void x.nodes.push({
      id, type: "action", x: Math.round(pos.x), y: Math.round(pos.y), phaseId: null, label: "", supportingAssetId: null, stakeholderId: null,
      catalogActionId: null, probability: null, difficulty: null, notes: "", ...partial,
      ...(partial.type === undefined || partial.type === "action" ? { phaseId: partial.phaseId ?? phaseOfX(pos.x) } : {}),
    }));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer?.getData(DND);
    if (!raw || ro) return;
    const item = JSON.parse(raw) as Partial<GraphNode>;
    const pos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const w = item.type === "action" || !item.type ? ACTION_W : item.type === "goal" ? 190 : 46;
    addNode(item, { x: pos.x - w / 2, y: pos.y - 25 });
  }
  const drag = (item: Partial<GraphNode>) => (e: DragEvent) => e.dataTransfer?.setData(DND, JSON.stringify(item));

  function removeSelected() {
    const id = selNode;
    if (!id) return;
    setOs((x) => {
      x.nodes = x.nodes.filter((n) => n.id !== id);
      x.edges = x.edges.filter((e) => e.source !== id && e.target !== id);
    });
    selNode = null;
  }
  function removeEdge(id: string) {
    setOs((x) => void (x.edges = x.edges.filter((y) => y.id !== id)));
    selEdge = null;
  }

  const sel = $derived(os.nodes.find((n) => n.id === selNode) ?? null);
  const selIndex = $derived(sel ? os.nodes.indexOf(sel) : -1);
  const setSel = (fn: (n: GraphNode) => void, key?: string) => setOs((x) => fn(x.nodes[selIndex]), key && `node-${sel?.id}-${key}`);
  const edge = $derived(os.edges.find((e) => e.id === selEdge) ?? null);
  const catalog = $derived(s.catalogs.elementaryActions.filter((a) => matches(q, a.label, a.category)));
  const catalogItem = $derived(sel?.catalogActionId ? s.catalogs.elementaryActions.find((a) => a.id === sel.catalogActionId) : null);
  const hints = $derived(
    s.catalogs.cotationHints.filter((h) => catalogItem && (catalogItem.category.toLowerCase().includes(h.category.toLowerCase().split(" — ")[0].slice(0, 12)) || h.category.toLowerCase().includes(catalogItem.category.toLowerCase().slice(0, 12)))),
  );
  const maxY = $derived(Math.max(900, ...os.nodes.map((n) => n.y + 200)));
  const lanes = $derived([...phases, { id: "goal", label: "Objectif visé", color: "#1b2333", description: "" }]);
  function nextFreeY(phaseIdx: number) {
    const inLane = os.nodes.filter((n) => Math.floor((n.x + ACTION_W / 2) / LANE_W) === phaseIdx);
    return inLane.length ? Math.max(...inLane.map((n) => n.y)) + 110 : 60;
  }
  const nodeTitle = (t: GraphNode["type"]) => (t === "action" ? "Action élémentaire" : t === "goal" ? "Objectif visé" : t === "and" ? "Opérateur ET" : "Opérateur OU");
</script>

<svelte:window onkeydown={(e) => full && e.key === "Escape" && (full = false)} />

<div class="graph-editor" class:readonly={ro} class:fullscreen={full}>
  {#if !ro}
    <div class="graph-palette">
      <div class="eyebrow mb">Opérateurs</div>
      <div class="row mb">
        {#each ["and", "or"] as const as t (t)}
          <div class="gate-node {t}" draggable="true" role="button" tabindex="-1" style="cursor: grab; width: 40px; height: 40px" ondragstart={drag({ type: t })} title={t === "and" ? "Opérateur ET" : "Opérateur OU"}>{t === "and" ? "ET" : "OU"}</div>
        {/each}
        <div class="goal-node" draggable="true" role="button" tabindex="-1" style="cursor: grab; width: 110px; padding: 6px; font-size: 11px" ondragstart={drag({ type: "goal", label: "Objectif visé" })}>🎯 Objectif</div>
      </div>
      <div class="pal-item" draggable="true" role="button" tabindex="-1" ondragstart={drag({ type: "action", label: "" })}>+ Action personnalisée</div>
      <div class="eyebrow mt mb">Catalogue d'actions élémentaires</div>
      <input type="search" placeholder="Rechercher…" aria-label="Rechercher une action" value={q} oninput={(e) => (q = e.currentTarget.value)} style="margin-bottom: 8px" />
      {#each phases as p, pi (p.id)}
        {@const items = catalog.filter((a) => a.phaseId === p.id)}
        {#if items.length}
          <details open={!!q || pi === 0}>
            <summary style="font-weight: 700; font-size: 12px; margin-bottom: 4px; cursor: pointer" style:color={p.color}>{p.label} ({items.length})</summary>
            {#each items as a (a.id)}
              <div class="pal-item" style:--c={p.color} draggable="true" role="button" tabindex="0" title="{a.category} — glisser dans le graphe ou double-cliquer"
                ondragstart={drag({ type: "action", label: a.label, phaseId: a.phaseId, catalogActionId: a.id })}
                ondblclick={() => addNode({ type: "action", label: a.label, phaseId: a.phaseId, catalogActionId: a.id }, { x: pi * LANE_W + 40, y: nextFreeY(pi) })}
                onkeydown={(e) => e.key === "Enter" && addNode({ type: "action", label: a.label, phaseId: a.phaseId, catalogActionId: a.id }, { x: pi * LANE_W + 40, y: nextFreeY(pi) })}>
                {a.label}
              </div>
            {/each}
          </details>
        {/if}
      {/each}
    </div>
  {/if}
  <div class="graph-canvas" role="application" ondragover={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; }} ondrop={onDrop}>
    <SvelteFlow
      bind:nodes
      bind:edges
      {nodeTypes}
      onnodedragstop={onDragStop}
      ondelete={onDelete}
      onbeforeconnect={onBeforeConnect}
      onselectionchange={onSelectionChange}
      nodesConnectable={!ro}
      nodesDraggable={!ro}
      elementsSelectable
      deleteKey={ro ? null : ["Delete", "Backspace"]}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.2}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
    >
      <ViewportPortal target="back">
        {#each lanes as p, i (p.id)}
          <div style="position: absolute; z-index: -1; pointer-events: none" style:transform="translate({i * LANE_W}px, -40px)" style:width="{LANE_W}px" style:height="{maxY + 40}px"
            style:background={i % 2 ? "rgba(236,239,244,.55)" : "rgba(248,249,252,.55)"} style:border-top="4px solid {p.color}">
            <div style="text-align: center; font-weight: 800; letter-spacing: 1px; font-size: 13px; padding-top: 6px" style:color={p.color}>{p.label.toUpperCase()}</div>
          </div>
        {/each}
      </ViewportPortal>
      <Background gap={20} size={1} patternColor="#e3e7ef" />
      <div style="position: absolute; top: 10px; right: 10px; z-index: 5">
        <button class="btn sm" onclick={() => (full = !full)} title={full ? "Quitter le plein écran (Échap)" : "Plein écran"}><Icon name="fit" size={13} /> {full ? "Quitter le plein écran" : "Plein écran"}</button>
      </div>
      <Controls showLock={false} />
      <MiniMap pannable zoomable nodeColor={(n) => ((n.data as AeNodeType["data"]).critical ? "#d32f2f" : (n.data as AeNodeType["data"]).color)} />
    </SvelteFlow>
  </div>
  <div class="graph-inspector">
    {#if sel}
      <div class="row between"><strong>{nodeTitle(sel.type)}</strong>
        {#if !ro}<button class="btn ghost sm icon danger" title="Supprimer (Suppr)" onclick={removeSelected}><Icon name="trash" size={13} /></button>{/if}
      </div>
      {#if sel.type !== "and" && sel.type !== "or"}
        <Field label="Libellé"><textarea rows="2" value={sel.label} disabled={ro} oninput={(e) => setSel((n) => void (n.label = e.currentTarget.value), "label")}></textarea></Field>
      {/if}
      {#if sel.type === "action"}
        <Field label="Phase de la séquence d'attaque">
          <select value={sel.phaseId ?? ""} disabled={ro} onchange={(e) => { const v = e.currentTarget.value || null; setSel((n) => { n.phaseId = v; const idx = phases.findIndex((p) => p.id === v); if (idx >= 0) n.x = idx * LANE_W + 40; }); }}>
            <option value="">—</option>
            {#each phases as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
          </select>
        </Field>
        <Field label="Bien support ciblé" hint="Chaque action élémentaire porte sur un bien support (EXI_M4_05).">
          <Combo options={opts.asset} value={sel.supportingAssetId} disabled={ro} onChange={(v) => setSel((n) => void (n.supportingAssetId = v))} />
        </Field>
        <Field label="Partie prenante (action dans l'écosystème)">
          <Combo options={opts.sh} value={sel.stakeholderId} disabled={ro} onChange={(v) => setSel((n) => void (n.stakeholderId = v))} />
        </Field>
        {#if s.likelihoodMethod !== "express"}
          <Field label="Probabilité de succès">
            <LevelSelect scale={s.scales.probability} value={sel.probability} disabled={ro} prefix="Pr " onChange={(v) => setSel((n) => void (n.probability = v))} />
          </Field>
          {#if s.likelihoodMethod === "advanced"}
            <Field label="Difficulté technique">
              <LevelSelect scale={s.scales.difficulty} value={sel.difficulty} disabled={ro} prefix="D " onChange={(v) => setSel((n) => void (n.difficulty = v))} />
            </Field>
          {/if}
          <div class="small">Indice cumulé intermédiaire : <strong>{ev.nodes[sel.id]?.pr ?? "—"}</strong>{#if method === "advanced"} · difficulté cumulée <strong>{ev.nodes[sel.id]?.diff ?? "—"}</strong>{/if}</div>
        {/if}
        {#if catalogItem}<div class="small muted">Catalogue : {catalogItem.category}</div>{/if}
        {#if s.likelihoodMethod !== "express"}
          <details open={hints.length > 0}>
            <summary class="small" style="font-weight: 650; cursor: pointer">Aide à la cotation (fiche méthode 8)</summary>
            {#each hints.length ? hints : s.catalogs.cotationHints as h (h.id)}
              <div class="small mt">
                <strong>{h.category}</strong>
                <ul style="margin: 2px 0; padding-left: 16px">{#each h.criteria as c (c)}<li>{c}</li>{/each}</ul>
              </div>
            {/each}
          </details>
        {/if}
        <Field label="Notes"><textarea rows="2" value={sel.notes} disabled={ro} oninput={(e) => setSel((n) => void (n.notes = e.currentTarget.value), "notes")}></textarea></Field>
      {/if}
      {#if sel.type === "and" || sel.type === "or"}
        <p class="small muted">{sel.type === "and" ? "ET : toutes les actions en entrée sont nécessaires pour réaliser l'étape suivante (indice = minimum des entrées)." : "OU : l'une ou l'autre des actions en entrée permet de réaliser l'étape suivante (indice = maximum des entrées)."}</p>
      {/if}
    {:else if edge}
      <strong>Lien</strong>
      <div class="small">{os.nodes.find((n) => n.id === edge.source)?.label || "?"} → {os.nodes.find((n) => n.id === edge.target)?.label || "?"}</div>
      <label class="checkbox"><input type="checkbox" checked={!!edge.dashed} disabled={ro} onchange={(e) => { const v = e.currentTarget.checked; setOs((x) => { const ed = x.edges.find((y) => y.id === edge.id); if (ed) ed.dashed = v; }); }} /> Lien hypothétique (pointillé)</label>
      {#if !ro}<button class="btn danger sm" onclick={() => removeEdge(edge.id)}>Supprimer le lien</button>{/if}
    {:else}
      <div class="small muted">
        <p><strong>Construire le graphe</strong></p>
        <ul style="padding-left: 16px">
          <li>Glissez des actions du catalogue dans le couloir de leur phase (ou double-cliquez).</li>
          <li>Reliez les nœuds en tirant depuis la poignée droite vers la poignée gauche.</li>
          <li>Ajoutez des opérateurs ET / OU et un nœud « objectif visé ».</li>
          <li>Sélectionnez un élément pour le coter ; <kbd>Suppr</kbd> pour l'effacer.</li>
        </ul>
        <p>Le départ doit être accessible à la source de risque ; l'arrivée doit avoir un lien clair avec l'objectif visé.</p>
        {#if s.likelihoodMethod !== "express"}<p>Les indices cumulés (entre parenthèses) sont recalculés à chaque modification ; le mode opératoire le plus vraisemblable est surligné en rouge.</p>{/if}
      </div>
    {/if}
    <hr />
    <div class="small">
      <strong>Légende</strong>
      <div class="legend mt">{#each phases as p (p.id)}<span><span class="sw" style:background={p.color}></span>{p.label}</span>{/each}</div>
      <div class="mt"><LevelChip scale={s.scales.likelihood} value={ev.likelihood} prefix="V" showLabel /> vraisemblance calculée du graphe</div>
    </div>
  </div>
</div>
