<script lang="ts">
  import { produce, type Draft } from "immer";
  import { studyDataSchema, uid, type Catalogs } from "@beffroi/shared";
  import Checkbox from "../../../components/Checkbox.svelte";
  import Icon from "../../../components/Icon.svelte";
  import { download, pickFile } from "../../../export/csv";
  import { toast } from "../../../lib/feedback.svelte";
  import { useStudy } from "../../study.svelte";

  type SimpleCatalogKey = "riskSourceCategories" | "targetObjectiveCategories" | "impactCategories";
  const SIMPLE: [SimpleCatalogKey, string][] = [
    ["riskSourceCategories", "Catégories de sources de risque"],
    ["targetObjectiveCategories", "Catégories d'objectifs visés"],
    ["impactCategories", "Catégories d'impacts"],
  ];

  const study = useStudy();
  const d = $derived(study.d);
  const ro = $derived(study.readOnly);
  const c = $derived(d.settings.catalogs);
  const setC = (fn: (x: Draft<Catalogs>) => void, key?: string) => study.update((x) => fn(x.settings.catalogs), key);
  const categories = $derived([...new Set(c.elementaryActions.map((a) => a.category))]);

  const exportKb = () => download("base-de-connaissances-beffroi.json", JSON.stringify({ format: "beffroi-base-de-connaissances", version: 1, catalogs: c }, null, 2), "application/json");
  async function importKb() {
    const f = await pickFile(".json,application/json");
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      const incoming: Partial<Catalogs> = json.catalogs ?? json;
      let added = 0;
      const merge = (cat: Draft<Catalogs>) => {
        for (const key of Object.keys(cat) as (keyof Catalogs)[]) {
          const list = incoming[key] as { id: string; label?: string; category?: string }[] | undefined;
          if (!Array.isArray(list)) continue;
          const target = cat[key] as { id: string; label?: string; category?: string }[];
          for (const item of list) {
            if (!item || typeof item.id !== "string") continue;
            const dup = target.some((x) => x.id === item.id || (!!x.label && x.label === item.label));
            if (!dup) {
              target.push(item as never);
              added++;
            }
          }
        }
      };
      if (!studyDataSchema.safeParse(produce(study.d, (x) => merge(x.settings.catalogs))).success) throw new Error("schema");
      added = 0;
      setC(merge);
      toast(`${added} élément(s) fusionné(s) dans les bases de connaissances.`, "success");
    } catch {
      toast("Fichier de base de connaissances illisible.", "error");
    }
  }
  function removePhase(pi: number, id: string) {
    setC((x) => {
      x.attackPhases.splice(pi, 1);
      x.elementaryActions = x.elementaryActions.filter((a) => a.phaseId !== id);
    });
  }
</script>

<div class="col gap-lg">
  <div class="row">
    <button class="btn" onclick={exportKb}><Icon name="download" size={14} /> Exporter les bases (JSON)</button>
    {#if !ro}<button class="btn" onclick={importKb}><Icon name="upload" size={14} /> Importer et fusionner</button>{/if}
    <span class="muted small">La fusion ajoute les éléments absents sans modifier les existants.</span>
  </div>
  <div class="grid-3">
    {#each SIMPLE as [key, title] (key)}
      <div class="card">
        <div class="card-title"><h4 style="margin: 0">{title}</h4>{#if !ro}<button class="btn sm" aria-label="Ajouter" onclick={() => setC((x) => void x[key].push({ id: uid(), label: "Nouvelle catégorie", description: "" }))}><Icon name="plus" size={12} /></button>{/if}</div>
        {#each c[key] as it, i (it.id)}
          <div class="row top mb">
            <div class="col grow">
              <input type="text" value={it.label} disabled={ro} aria-label="Libellé" oninput={(e) => setC((x) => void (x[key][i].label = e.currentTarget.value), `kb-${it.id}`)} />
              <textarea rows="2" style="min-height: 34px" value={it.description ?? ""} disabled={ro} placeholder="Description" oninput={(e) => setC((x) => void (x[key][i].description = e.currentTarget.value), `kbd-${it.id}`)}></textarea>
            </div>
            {#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer" onclick={() => setC((x) => void x[key].splice(i, 1))}><Icon name="trash" size={13} /></button>{/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-title"><h4 style="margin: 0">Catégories de parties prenantes</h4>{#if !ro}<button class="btn sm" aria-label="Ajouter" onclick={() => setC((x) => void x.stakeholderCategories.push({ id: uid(), label: "Nouvelle catégorie", internal: false }))}><Icon name="plus" size={12} /></button>{/if}</div>
      {#each c.stakeholderCategories as it, i (it.id)}
        <div class="row mb">
          <input type="text" class="grow" value={it.label} disabled={ro} aria-label="Catégorie" oninput={(e) => setC((x) => void (x.stakeholderCategories[i].label = e.currentTarget.value), `pp-${it.id}`)} />
          <Checkbox checked={it.internal} disabled={ro} label="Interne" onChange={(v) => setC((x) => void (x.stakeholderCategories[i].internal = v))} />
          {#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer" onclick={() => setC((x) => void x.stakeholderCategories.splice(i, 1))}><Icon name="trash" size={13} /></button>{/if}
        </div>
      {/each}
    </div>
    <div class="card">
      <div class="card-title"><h4 style="margin: 0">Types de biens supports</h4>{#if !ro}<button class="btn sm" aria-label="Ajouter" onclick={() => setC((x) => void x.supportingAssetTypes.push({ id: uid(), label: "Nouveau type", group: "Autres" }))}><Icon name="plus" size={12} /></button>{/if}</div>
      <div style="max-height: 360px; overflow-y: auto">
        {#each c.supportingAssetTypes as it, i (it.id)}
          <div class="row mb">
            <input type="text" style="width: 150px" value={it.group} disabled={ro} aria-label="Groupe" oninput={(e) => setC((x) => void (x.supportingAssetTypes[i].group = e.currentTarget.value), `bg-${it.id}`)} />
            <input type="text" class="grow" value={it.label} disabled={ro} aria-label="Type" oninput={(e) => setC((x) => void (x.supportingAssetTypes[i].label = e.currentTarget.value), `bl-${it.id}`)} />
            {#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer" onclick={() => setC((x) => void x.supportingAssetTypes.splice(i, 1))}><Icon name="trash" size={13} /></button>{/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-title"><h4 style="margin: 0">Séquence d'attaque type et catalogue d'actions élémentaires</h4>
      {#if !ro}<button class="btn sm" onclick={() => setC((x) => void x.attackPhases.push({ id: uid(), label: "Nouvelle phase", description: "", color: "#78909c" }))}><Icon name="plus" size={12} /> Phase</button>{/if}</div>
    <div class="grid-4">
      <datalist id="ae-categories">{#each categories as cat (cat)}<option value={cat}></option>{/each}</datalist>
      {#each c.attackPhases as p, pi (p.id)}
        <div class="col" style:border-top="4px solid {p.color}" style="padding-top: 8px">
          <div class="row">
            <input type="color" value={p.color} disabled={ro} aria-label="Couleur de la phase" oninput={(e) => { const v = e.currentTarget.value; setC((x) => void (x.attackPhases[pi].color = v)); }} style="width: 30px; height: 28px; border: 0; background: none" />
            <input type="text" class="grow" style="font-weight: 700" value={p.label} disabled={ro} aria-label="Phase" oninput={(e) => setC((x) => void (x.attackPhases[pi].label = e.currentTarget.value), `ph-${p.id}`)} />
            {#if !ro && c.attackPhases.length > 1}<button class="btn ghost sm icon" title="Supprimer la phase" onclick={() => removePhase(pi, p.id)}><Icon name="trash" size={13} /></button>{/if}
          </div>
          <textarea rows="3" class="small" value={p.description} disabled={ro} aria-label="Description de la phase" oninput={(e) => setC((x) => void (x.attackPhases[pi].description = e.currentTarget.value), `phd-${p.id}`)}></textarea>
          {#each c.elementaryActions as a, ai (a.id)}
            {#if a.phaseId === p.id}
              <div class="row top">
                <div class="col grow" style="gap: 2px">
                  <input type="text" class="small" style="height: 24px; font-size: 11px" value={a.category} list="ae-categories" disabled={ro} title="Catégorie d'actions élémentaires" oninput={(e) => setC((x) => void (x.elementaryActions[ai].category = e.currentTarget.value), `aec-${a.id}`)} />
                  <textarea rows="2" class="small" style="min-height: 34px" value={a.label} disabled={ro} aria-label="Action élémentaire" oninput={(e) => setC((x) => void (x.elementaryActions[ai].label = e.currentTarget.value), `ae-${a.id}`)}></textarea>
                </div>
                {#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer" onclick={() => setC((x) => void x.elementaryActions.splice(ai, 1))}><Icon name="close" size={12} /></button>{/if}
              </div>
            {/if}
          {/each}
          {#if !ro}<button class="btn sm ghost" onclick={() => setC((x) => void x.elementaryActions.push({ id: uid(), phaseId: p.id, category: "Personnalisée", label: "Nouvelle action élémentaire" }))}><Icon name="plus" size={12} /> Action</button>{/if}
        </div>
      {/each}
    </div>
  </div>
  <div class="card">
    <div class="card-title"><h4 style="margin: 0">Aide à la cotation des actions élémentaires (fiche méthode 8)</h4>
      {#if !ro}<button class="btn sm" aria-label="Ajouter" onclick={() => setC((x) => void x.cotationHints.push({ id: uid(), category: "Nouvelle catégorie", criteria: [""] }))}><Icon name="plus" size={12} /></button>{/if}</div>
    <div class="grid-2">
      {#each c.cotationHints as h, hi (h.id)}
        <div class="col">
          <div class="row">
            <input type="text" class="grow" style="font-weight: 650" value={h.category} disabled={ro} aria-label="Catégorie" oninput={(e) => setC((x) => void (x.cotationHints[hi].category = e.currentTarget.value), `ch-${h.id}`)} />
            {#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer" onclick={() => setC((x) => void x.cotationHints.splice(hi, 1))}><Icon name="trash" size={13} /></button>{/if}
          </div>
          <textarea rows="4" class="small" value={h.criteria.join("\n")} disabled={ro} aria-label="Critères" oninput={(e) => setC((x) => void (x.cotationHints[hi].criteria = e.currentTarget.value.split("\n")), `chc-${h.id}`)}></textarea>
        </div>
      {/each}
    </div>
  </div>
</div>
