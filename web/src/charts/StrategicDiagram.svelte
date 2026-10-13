<script lang="ts">
  import { strategicGravity, type StrategicScenario, type StudyData } from "@beffroi/shared";
  import { levelColor } from "../lib/levels";
  import MultiText from "./MultiText.svelte";
  import { FONT, wrap } from "./svg";

  /**
   * Représentation d'un scénario stratégique en couloirs (guide p.50-51) :
   * Source de risque → Écosystème (événements intermédiaires) → Objet de l'étude (événements redoutés) → Objectif visé.
   */
  let { data, scenario, onlyRetained = false }: { data: StudyData; scenario: StrategicScenario; onlyRetained?: boolean } = $props();

  const PATH_COLORS = ["#1d3b72", "#c62828", "#00897b", "#6a1b9a", "#ef6c00", "#2e7d32"];
  const BOX_W = 176;
  const BOX_H = 62;
  const GAP = 26;
  const ROW_H = 96;

  const L = $derived.by(() => {
    const pair = data.srovPairs.find((p) => p.id === scenario.srovId);
    const sr = data.riskSources.find((s) => s.id === pair?.riskSourceId);
    const paths = scenario.paths.filter((p) => !onlyRetained || p.retained);
    const maxInter = Math.max(1, ...paths.map((p) => p.steps.filter((s) => s.kind === "intermediate").length));
    const maxFeared = Math.max(1, ...paths.map((p) => p.steps.filter((s) => s.kind === "feared").length));
    const colSR = 20;
    const colEco = colSR + BOX_W + 50;
    const ecoW = maxInter * (BOX_W + GAP) + GAP;
    const colObj = colEco + ecoW + 20;
    const objW = maxFeared * (BOX_W + GAP) + GAP;
    const colOV = colObj + objW + 30;
    const W = colOV + BOX_W + 20;
    const top = 44;
    const H = top + Math.max(1, paths.length) * ROW_H + 20;
    const midY = top + (Math.max(1, paths.length) * ROW_H) / 2;
    const fe = new Map(data.fearedEvents.map((f) => [f.id, f]));
    const sh = new Map(data.stakeholders.map((s) => [s.id, s]));
    const bv = new Map(data.businessValues.map((b) => [b.id, b]));
    const rows = paths.map((p, i) => {
      const y = top + i * ROW_H + ROW_H / 2;
      const color = PATH_COLORS[i % PATH_COLORS.length];
      const boxes: { x: number; kind: string; head: string; body: string; grav?: number | null }[] = [];
      p.steps.filter((s) => s.kind === "intermediate").forEach((s, k) =>
        boxes.push({ x: colEco + GAP / 2 + k * (BOX_W + GAP), kind: "i", head: sh.get(s.stakeholderId ?? "")?.name ?? "Partie prenante", body: s.label }),
      );
      p.steps.filter((s) => s.kind === "feared").forEach((s, k) => {
        const f = fe.get(s.fearedEventId ?? "");
        boxes.push({ x: colObj + GAP / 2 + k * (BOX_W + GAP), kind: "f", head: bv.get(f?.businessValueId ?? "")?.name ?? "Valeur métier", body: s.label || f?.name || "", grav: f?.gravity });
      });
      const points = [{ x: colSR + BOX_W, y: midY }, ...boxes.flatMap((b) => [{ x: b.x, y }, { x: b.x + BOX_W, y }]), { x: colOV, y: midY }];
      const segs: string[] = [];
      for (let k = 0; k < points.length - 1; k += 2) {
        const a = points[k], b = points[k + 1];
        const mx = (a.x + b.x) / 2;
        segs.push(`M${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 2} ${b.y}`);
      }
      return { p, y, color, marker: i % PATH_COLORS.length, boxes, segs };
    });
    return { pair, sr, colSR, colEco, ecoW, colObj, objW, colOV, W, H, midY, rows, g: strategicGravity(data, scenario).value };
  });
</script>

<svg class="viz" viewBox="0 0 {L.W} {L.H}" style="font-family: {FONT}; max-width: {L.W}px; min-width: {Math.min(L.W, 980)}px" role="img" aria-label="Scénario stratégique {scenario.ref}">
  <defs>
    {#each PATH_COLORS as c, i (c)}
      <marker id="ss-arrow-{scenario.id}-{i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill={c} /></marker>
    {/each}
  </defs>
  <rect x={L.colEco - 10} y="8" width={L.ecoW + 10} height={L.H - 16} rx="10" fill="#fff4e5" stroke="#ffcc80" />
  <rect x={L.colObj - 6} y="8" width={L.objW + 6} height={L.H - 16} rx="10" fill="#e8eefb" stroke="#9fb5e3" />
  <text x={L.colSR + BOX_W / 2} y="28" text-anchor="middle" font-size="11" font-weight="800" fill="#4a5468" letter-spacing="1">SOURCE DE RISQUE</text>
  <text x={L.colEco + L.ecoW / 2 - 5} y="28" text-anchor="middle" font-size="11" font-weight="800" fill="#b35c00" letter-spacing="1">ÉCOSYSTÈME</text>
  <text x={L.colObj + L.objW / 2} y="28" text-anchor="middle" font-size="11" font-weight="800" fill="#1d3b72" letter-spacing="1">OBJET DE L'ÉTUDE</text>
  <text x={L.colOV + BOX_W / 2} y="28" text-anchor="middle" font-size="11" font-weight="800" fill="#4a5468" letter-spacing="1">OBJECTIF VISÉ</text>

  <rect x={L.colSR} y={L.midY - 34} width={BOX_W} height="68" rx="8" fill="#1b2333" />
  <MultiText x={L.colSR + BOX_W / 2} y={L.midY} lines={wrap(L.sr?.name ?? "Source de risque", 24, 3)} fontSize={12.5} fontWeight={700} fill="#fff" />

  <rect x={L.colOV} y={L.midY - 48} width={BOX_W} height="96" rx="8" fill="#fff" stroke="#1b2333" stroke-width="1.5" />
  <MultiText x={L.colOV + BOX_W / 2} y={L.midY - 6} lines={wrap(L.pair?.objective ?? "", 28, 4)} fontSize={10.5} fill="#1b2333" />
  {#if L.g !== null}
    <rect x={L.colOV + BOX_W / 2 - 42} y={L.midY + 30} width="84" height="16" rx="4" fill={levelColor(data.settings.scales.gravity, L.g)} />
    <text x={L.colOV + BOX_W / 2} y={L.midY + 38} text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="700" fill="#fff">Gravité G{L.g}</text>
  {/if}

  {#if L.rows.length === 0}<text x={L.W / 2} y={L.midY} text-anchor="middle" fill="#7a8497" font-size="12">Aucun chemin d'attaque</text>{/if}
  {#each L.rows as row (row.p.id)}
    <g>
      {#each row.segs as d, k (k)}
        <path {d} fill="none" stroke={row.color} stroke-width="2" marker-end="url(#ss-arrow-{scenario.id}-{row.marker})" opacity={row.p.retained ? 1 : 0.35} stroke-dasharray={row.p.retained ? undefined : "5 4"} />
      {/each}
      <text x={L.colEco - 4} y={row.y - BOX_H / 2 - 6} font-size="10.5" font-weight="700" fill={row.color}>{row.p.ref} · {wrap(row.p.name, 60, 1)[0]}{row.p.retained ? "" : " (non retenu)"}</text>
      {#each row.boxes as b, k (k)}
        <g opacity={row.p.retained ? 1 : 0.5}>
          <rect x={b.x} y={row.y - BOX_H / 2} width={BOX_W} height={BOX_H} rx="7" fill="#fff" stroke={b.kind === "i" ? "#ef6c00" : "#c62828"} stroke-width="1.8" />
          <text x={b.x + 8} y={row.y - BOX_H / 2 + 13} font-size="10" font-weight="800" fill={b.kind === "i" ? "#b35c00" : "#1d3b72"}>{wrap(b.head, 30, 1)[0]}</text>
          <MultiText x={b.x + BOX_W / 2} y={row.y + 8} lines={wrap(b.body, 32, 3)} fontSize={9.8} fill="#1b2333" />
          {#if b.grav !== undefined && b.grav !== null}
            <rect x={b.x + BOX_W - 28} y={row.y - BOX_H / 2 + 4} width="24" height="14" rx="3" fill={levelColor(data.settings.scales.gravity, b.grav)} />
            <text x={b.x + BOX_W - 16} y={row.y - BOX_H / 2 + 11} text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="800" fill="#fff">G{b.grav}</text>
          {/if}
        </g>
      {/each}
    </g>
  {/each}
</svg>
