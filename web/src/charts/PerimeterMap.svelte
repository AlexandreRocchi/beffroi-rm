<script lang="ts">
  import type { StudyData } from "@beffroi/shared";
  import { FONT, wrap } from "./svg";

  /** Carte du périmètre : missions → valeurs métier → biens supports (atelier 1). */
  let { data, focusBv, onSelect }: { data: StudyData; focusBv?: string | null; onSelect?: (kind: "bv" | "asset", id: string) => void } = $props();
  let hover = $state<string | null>(null);
  const rowH = 46;
  const W = 980;
  const colX = [20, 360, 700];
  const boxW = 260;

  const L = $derived.by(() => {
    const missions = data.missions;
    const bvs = data.businessValues;
    const assets = data.supportingAssets;
    const n = Math.max(missions.length, bvs.length, assets.length, 1);
    const yOf = (i: number, count: number) => 44 + ((n - count) * rowH) / 2 + i * rowH + rowH / 2;
    return {
      missions, bvs, assets,
      H: 44 + n * rowH,
      mY: new Map(missions.map((m, i) => [m.id, yOf(i, missions.length)])),
      bY: new Map(bvs.map((b, i) => [b.id, yOf(i, bvs.length)])),
      aY: new Map(assets.map((a, i) => [a.id, yOf(i, assets.length)])),
    };
  });
  const active = $derived(hover ?? focusBv ?? null);
  const linkedBv = (bvId: string) =>
    active === null || active === bvId || L.assets.some((a) => a.id === active && a.businessValueIds.includes(bvId)) || L.missions.some((m) => m.id === active && L.bvs.find((b) => b.id === bvId)?.missionIds.includes(m.id));
  const linkedAsset = (assetId: string) => {
    if (active === null || active === assetId) return true;
    const a = L.assets.find((x) => x.id === assetId);
    return !!a && a.businessValueIds.some((b) => b === active || L.bvs.find((x) => x.id === b)?.missionIds.includes(active as string));
  };
  const linkedMission = (mid: string) =>
    active === null || active === mid || L.bvs.some((b) => b.missionIds.includes(mid) && linkedBv(b.id) && (b.id === active || L.assets.some((a) => a.id === active && a.businessValueIds.includes(b.id))));
  const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
</script>

{#snippet box(x: number, y: number, ref: string, label: string, fill: string, on: boolean, id: string, kind?: "bv" | "asset")}
  <g opacity={on ? 1 : 0.25} onmouseenter={() => (hover = id)} onmouseleave={() => (hover = null)} onclick={() => kind && onSelect?.(kind, id)} style:cursor={kind ? "pointer" : "default"}>
    <rect {x} y={y - 17} width={boxW} height="34" rx="6" {fill} stroke="rgba(0,0,0,.08)" />
    <text x={x + 8} {y} dominant-baseline="middle" font-size="10.5" font-weight="800" fill="#fff">{ref}</text>
    <text x={x + 44} {y} dominant-baseline="middle" font-size="11.5" fill="#fff">{wrap(label, 34, 1)[0]}</text>
    <title>{`${ref} · ${label}`}</title>
  </g>
{/snippet}

<svg class="viz" viewBox="0 0 {W} {L.H}" style="font-family: {FONT}; max-width: {W}px" role="img" aria-label="Carte du périmètre métier et technique">
  {#each ["MISSIONS", "VALEURS MÉTIER", "BIENS SUPPORTS"] as t, i (t)}
    <text x={colX[i] + boxW / 2} y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#4a5468" letter-spacing="1">{t}</text>
  {/each}
  {#each L.bvs as b (b.id)}
    {#each b.missionIds.filter((m) => L.mY.has(m)) as m (m)}
      <path d={curve(colX[0] + boxW, L.mY.get(m) as number, colX[1], L.bY.get(b.id) as number)} fill="none" stroke="#9fa8da" stroke-width="1.6" opacity={linkedBv(b.id) && linkedMission(m) ? 0.9 : 0.12} />
    {/each}
  {/each}
  {#each L.assets as a (a.id)}
    {#each a.businessValueIds.filter((b) => L.bY.has(b)) as b (b)}
      <path d={curve(colX[1] + boxW, L.bY.get(b) as number, colX[2], L.aY.get(a.id) as number)} fill="none" stroke="#80cbc4" stroke-width="1.6" opacity={linkedBv(b) && linkedAsset(a.id) ? 0.9 : 0.12} />
    {/each}
  {/each}
  {#each L.missions as m (m.id)}{@render box(colX[0], L.mY.get(m.id) as number, m.ref, m.name, "#37474f", linkedMission(m.id), m.id)}{/each}
  {#each L.bvs as b (b.id)}{@render box(colX[1], L.bY.get(b.id) as number, b.ref, b.name, b.nature === "process" ? "#3949ab" : "#5c6bc0", linkedBv(b.id), b.id, "bv")}{/each}
  {#each L.assets as a (a.id)}{@render box(colX[2], L.aY.get(a.id) as number, a.ref, a.name, a.ownerType === "external" ? "#00796b" : "#00897b", linkedAsset(a.id), a.id, "asset")}{/each}
</svg>
