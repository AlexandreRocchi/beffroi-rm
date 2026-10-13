<script lang="ts">
  import { diffStudies, type DiffEntry, type VersionInfo } from "@beffroi/shared";
  import Icon from "../../components/Icon.svelte";
  import { Api } from "../../lib/api";
  import { toast } from "../../lib/feedback.svelte";
  import { router } from "../../lib/router.svelte";
  import { fmtDateTime } from "../helpers";
  import { WS_COLORS } from "../nav";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import DiffList from "./admin/DiffList.svelte";
  import NewVersionModal from "./admin/NewVersionModal.svelte";

  const study = useStudy();
  const id = study.studyId;
  const d = $derived(study.d);
  const meta = $derived(study.m);
  let versions = $state.raw<VersionInfo[]>([]);
  let creating = $state(false);
  const load = () => Api.versions(id).then((v) => (versions = v)).catch((e: Error) => toast(e.message, "error"));
  void load();

  // Modifications de la version courante par rapport à la dernière version figée.
  let frozenData = $state.raw<typeof d | null>(null);
  $effect(() => {
    const prev = versions.find((v) => v.frozen);
    frozenData = null;
    if (!prev || study.viewingOldVersion) return;
    let alive = true;
    Api.studyData(id, prev.id).then((r) => alive && (frozenData = r.data)).catch(() => undefined);
    return () => void (alive = false);
  });
  const baseline = $derived<DiffEntry[] | null>(frozenData ? diffStudies(frozenData, d) : null);

  async function create(b: { changeType: "operational" | "strategic"; summary: string; workshops: number[] }) {
    await study.save();
    try {
      const r = await Api.newVersion(id, b);
      toast(`Version ${r.major}.${r.minor} créée ; la version ${meta.major}.${meta.minor} est figée.`, "success");
      creating = false;
      await study.load();
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
</script>

<PageTitle title="Versions de l'analyse" subtitle="Chaque mise à jour se fait dans le cadre d'un cycle opérationnel (x.y+1) ou stratégique (x+1.0) ; les versions antérieures sont figées et consultables.">
  {#snippet actions()}
    {#if !study.readOnly && !study.viewingOldVersion}<button class="btn primary" onclick={() => (creating = true)}><Icon name="history" size={14} /> Nouvelle version</button>{/if}
  {/snippet}
</PageTitle>
{#if baseline && baseline.length > 0}
  <div class="card mb-lg">
    <h3>Modifications en cours (depuis la version figée précédente)</h3>
    <DiffList diff={baseline} />
  </div>
{/if}
<div class="col gap-lg">
  {#each versions as v (v.id)}
    <div class="card">
      <div class="row between wrap">
        <div class="row">
          <span class="badge blue" style="font-size: 14px; height: 26px">v{v.major}.{v.minor}</span>
          <span class="badge {v.changeType === 'strategic' ? 'orange' : v.changeType === 'operational' ? '' : 'green'}">
            {v.changeType === "strategic" ? "Cycle stratégique" : v.changeType === "operational" ? "Cycle opérationnel" : "Version initiale"}
          </span>
          {#if v.frozen}<span class="badge"><Icon name="lock" size={11} /> figée</span>{:else}<span class="badge green">version courante</span>{/if}
          <span class="muted small">{fmtDateTime(v.createdAt)} · {v.createdBy}</span>
        </div>
        {#if v.frozen}<button class="btn sm" onclick={() => router.navigate(`/etudes/${id}/vue-ensemble?version=${v.id}`)}><Icon name="eye" size={13} /> Consulter</button>{/if}
      </div>
      <p class="mt">{v.summary}</p>
      <div class="row wrap small mb">
        Ateliers concernés : {#each v.workshops as w (w)}<span class="badge" style:background={WS_COLORS[w]} style="color: #fff">A{w}</span>{/each}
      </div>
      {#if v.diff}
        <details>
          <summary class="small" style="cursor: pointer">Synthèse des modifications par rapport à la version précédente</summary>
          <div class="mt"><DiffList diff={v.diff} /></div>
        </details>
      {/if}
    </div>
  {/each}
</div>
{#if creating}<NewVersionModal current="{meta.major}.{meta.minor}" onClose={() => (creating = false)} onCreate={create} />{/if}
