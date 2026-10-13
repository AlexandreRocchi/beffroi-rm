<script lang="ts">
  import { FONT, wrap } from "./svg";

  /** Frise des échéances du plan de traitement par mois. */
  let { items, width = 1000, title }: { items: { id: string; label: string; date: string; color: string; done: boolean }[]; width?: number; title?: string } = $props();
  const left = 20;
  const t = $derived.by(() => {
    const dated = items.filter((i) => /^\d{4}-\d{2}/.test(i.date)).sort((a, b) => a.date.localeCompare(b.date));
    if (!dated.length) return null;
    const first = new Date(dated[0].date.slice(0, 7) + "-01");
    const lastD = new Date(dated[dated.length - 1].date.slice(0, 7) + "-01");
    const months = Math.max(1, (lastD.getFullYear() - first.getFullYear()) * 12 + lastD.getMonth() - first.getMonth() + 1);
    const colW = (width - left - 20) / months;
    const byMonth = new Map<number, typeof dated>();
    for (const it of dated) {
      const d = new Date(it.date.slice(0, 7) + "-01");
      const m = (d.getFullYear() - first.getFullYear()) * 12 + d.getMonth() - first.getMonth();
      byMonth.set(m, [...(byMonth.get(m) ?? []), it]);
    }
    const maxStack = Math.max(...[...byMonth.values()].map((v) => v.length));
    const top = title ? 30 : 10;
    const H = top + 34 + maxStack * 22 + 10;
    const today = new Date();
    const todayM = (today.getFullYear() - first.getFullYear()) * 12 + today.getMonth() - first.getMonth() + today.getDate() / 31;
    const monthLabels = Array.from({ length: months }, (_, m) => {
      const d = new Date(first.getFullYear(), first.getMonth() + m, 1);
      return d.toLocaleDateString("fr-FR", { month: "short" }) + (d.getMonth() === 0 || m === 0 ? ` ${d.getFullYear()}` : "");
    });
    return { months, colW, byMonth: [...byMonth.entries()], top, H, todayM, monthLabels };
  });
</script>

{#if !t}
  <div class="muted small">Aucune échéance renseignée.</div>
{:else}
  <svg class="viz" viewBox="0 0 {width} {t.H}" style="font-family: {FONT}" role="img" aria-label={title ?? "Échéancier"}>
    {#if title}<text x="0" y="16" font-weight="700" font-size="13" fill="#1b2333">{title}</text>{/if}
    {#each t.monthLabels as label, m (m)}
      <rect x={left + m * t.colW} y={t.top} width={t.colW} height={t.H - t.top} fill={m % 2 ? "#f8f9fc" : "#fff"} />
      <text x={left + m * t.colW + t.colW / 2} y={t.top + 14} text-anchor="middle" font-size="10" fill="#4a5468">{label}</text>
    {/each}
    {#if t.todayM >= 0 && t.todayM <= t.months}
      <line x1={left + t.todayM * t.colW} x2={left + t.todayM * t.colW} y1={t.top} y2={t.H} stroke="#c62828" stroke-dasharray="4 3" />
    {/if}
    {#each t.byMonth as [m, list] (m)}
      {#each list as it, k (it.id)}
        <rect x={left + m * t.colW + 3} y={t.top + 26 + k * 22} width={t.colW - 6} height="18" rx="4" fill={it.color} opacity={it.done ? 0.45 : 1}>
          <title>{`${it.label} — échéance ${it.date}${it.done ? " (terminé)" : ""}`}</title>
        </rect>
        <text x={left + m * t.colW + 7} y={t.top + 35 + k * 22} dominant-baseline="middle" font-size="9.5" font-weight="700" fill="#fff" pointer-events="none">{t.colW < 120 ? it.label.split(" ")[0] : wrap(it.label, Math.floor(t.colW / 6), 1)[0]}</text>
      {/each}
    {/each}
  </svg>
{/if}
