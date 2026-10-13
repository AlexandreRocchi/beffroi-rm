<script lang="ts">
  import { CRITERIA_LABELS, nextRef, uid } from "@beffroi/shared";
  import PerimeterMap from "../../charts/PerimeterMap.svelte";
  import Combo from "../../components/Combo.svelte";
  import Icon from "../../components/Icon.svelte";
  import LevelChip from "../../components/LevelChip.svelte";
  import Ref from "../../components/Ref.svelte";
  import SearchBox from "../../components/SearchBox.svelte";
  import Tabs from "../../components/Tabs.svelte";
  import { download, parseCsv, pickFile, toCsv } from "../../export/csv";
  import { activable } from "../../lib/actions";
  import { toast } from "../../lib/feedback.svelte";
  import { matches } from "../../lib/levels";
  import { buildOptions, nameOf, shortText } from "../helpers";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";
  import { confirmDelete } from "../useDelete";
  import AssetDrawer from "./a1/AssetDrawer.svelte";
  import BvDrawer from "./a1/BvDrawer.svelte";

  const study = useStudy();
  const update = study.update;
  const d = $derived(study.d);
  const s = $derived(d.settings);
  const ro = $derived(study.readOnly);
  const opts = $derived(buildOptions(d));
  let tab = $state<"vm" | "bs" | "carte">("vm");
  let editBv = $state<string | null>(null);
  let editAsset = $state<string | null>(null);
  let q = $state("");
  let bvFilter = $state<string | null>(null);
  const CRIT = ["D", "I", "C", "T"] as const;

  const addMission = () => update((x) => void x.missions.push({ id: uid(), ref: nextRef("MI", x.missions), name: "Nouvelle mission", description: "" }));
  function addBv() {
    const id = uid();
    update((x) => void x.businessValues.push({ id, ref: nextRef("VM", x.businessValues), name: "", nature: "process", description: "", owner: "", ownerType: "internal", missionIds: x.missions.length === 1 ? [x.missions[0].id] : [], needs: { D: null, I: null, C: null, T: null } }));
    editBv = id;
  }
  function addAsset() {
    const id = uid();
    const filter = bvFilter;
    update((x) => void x.supportingAssets.push({ id, ref: nextRef("BS", x.supportingAssets), name: "", typeId: null, description: "", owner: "", ownerType: "internal", businessValueIds: filter ? [filter] : [] }));
    editAsset = id;
  }

  async function importCsv() {
    const f = await pickFile(".csv,text/csv");
    if (!f) return;
    const rows = parseCsv(await f.text());
    const header = rows.shift()?.map((h) => h.toLowerCase()) ?? [];
    const col = (name: string) => header.findIndex((h) => h.startsWith(name));
    const iKind = col("type d'élément"), iName = col("nom"), iNature = col("nature"), iDesc = col("description"), iOwner = col("responsable"), iExt = col("interne"), iLinks = col("valeurs métier"), iType = col("type de bien");
    if (iKind < 0 || iName < 0) return toast("Colonnes attendues : Type d'élément (VM ou BS) ; Nom ; Nature ; Description ; Responsable ; Interne/externe ; Type de bien ; Valeurs métier", "error");
    let nbv = 0, nbs = 0;
    update((x) => {
      for (const r of rows) {
        const kind = r[iKind]?.toUpperCase();
        const name = r[iName];
        if (!name) continue;
        const ownerType = /ext/i.test(r[iExt] ?? "") ? "external" : "internal";
        if (kind === "VM") {
          x.businessValues.push({ id: uid(), ref: nextRef("VM", x.businessValues), name, nature: /info/i.test(r[iNature] ?? "") ? "information" : "process", description: r[iDesc] ? `<p>${r[iDesc]}</p>` : "", owner: r[iOwner] ?? "", ownerType, missionIds: x.missions.length === 1 ? [x.missions[0].id] : [], needs: { D: null, I: null, C: null, T: null } });
          nbv++;
        } else if (kind === "BS") {
          const links = (r[iLinks] ?? "").split(/[,|]/).map((y) => y.trim()).filter(Boolean);
          const bvIds = x.businessValues.filter((b) => links.includes(b.ref) || links.includes(b.name)).map((b) => b.id);
          const t = x.settings.catalogs.supportingAssetTypes.find((y) => y.label.toLowerCase() === (r[iType] ?? "").toLowerCase());
          x.supportingAssets.push({ id: uid(), ref: nextRef("BS", x.supportingAssets), name, typeId: t?.id ?? null, description: r[iDesc] ? `<p>${r[iDesc]}</p>` : "", owner: r[iOwner] ?? "", ownerType, businessValueIds: bvIds });
          nbs++;
        }
      }
    });
    toast(`${nbv} valeur(s) métier et ${nbs} bien(s) support(s) importés.`, "success");
  }

  const template = () =>
    download("modele-perimetre.csv", toCsv([
      ["Type d'élément (VM ou BS)", "Nom", "Nature (processus/information)", "Description", "Responsable", "Interne/externe", "Type de bien", "Valeurs métier (réf. ou noms séparés par des virgules)"],
      ["VM", "Gestion des commandes", "processus", "Prise et suivi des commandes clients", "Directeur commercial", "interne", "", ""],
      ["BS", "Serveur ERP", "", "Serveur hébergeant l'ERP", "DSI", "interne", "Serveur", "VM1"],
    ]), "text/csv");

  const bvs = $derived(d.businessValues.filter((b) => matches(q, b.ref, b.name, b.owner)));
  const assets = $derived(d.supportingAssets.filter((a) => matches(q, a.ref, a.name, a.owner) && (!bvFilter || a.businessValueIds.includes(bvFilter))));
</script>

<PageTitle ws={1} title="Périmètre métier et technique" subtitle="Missions de l'objet étudié, valeurs métier à protéger et biens supports sur lesquels elles reposent.">
  {#snippet actions()}
    {#if !ro}
      <button class="btn" onclick={template} title="Télécharger un modèle CSV"><Icon name="download" size={14} /> Modèle CSV</button>
      <button class="btn" onclick={importCsv}><Icon name="upload" size={14} /> Importer CSV</button>
    {/if}
  {/snippet}
</PageTitle>

<div class="card mb-lg">
  <div class="card-title">
    <h3>Missions</h3>
    {#if !ro}<button class="btn sm" onclick={addMission}><Icon name="plus" size={13} /> Mission</button>{/if}
  </div>
  <div class="col">
    {#each d.missions as m, i (m.id)}
      <div class="row">
        <Ref>{m.ref}</Ref>
        <input type="text" class="inline-input grow" value={m.name} disabled={ro} aria-label="Mission {m.ref}" oninput={(e) => update((x) => void (x.missions[i].name = e.currentTarget.value), `mi-${m.id}`)} />
        {#if !ro}<button class="btn ghost sm icon" aria-label="Supprimer" onclick={() => confirmDelete(study, `la mission ${m.ref}`, (x) => void x.missions.splice(i, 1))}><Icon name="trash" size={13} /></button>{/if}
      </div>
    {/each}
    {#if d.missions.length === 0}<span class="muted">Finalités et raisons d'être de l'objet étudié (ex. « Identifier et fabriquer des vaccins »).</span>{/if}
  </div>
</div>

<Tabs value={tab} onChange={(t) => (tab = t)} tabs={[
  { id: "vm", label: `Valeurs métier (${d.businessValues.length})` },
  { id: "bs", label: `Biens supports (${d.supportingAssets.length})` },
  { id: "carte", label: "Carte du périmètre" },
]} />

{#if tab === "vm"}
  <div class="row between mb">
    <SearchBox value={q} onChange={(v) => (q = v)} />
    <span class="muted small">{d.businessValues.length > 10 ? "Le guide recommande de se limiter à 5 à 10 valeurs métier." : ""}</span>
    {#if !ro}<button class="btn primary" onclick={addBv}><Icon name="plus" size={14} /> Valeur métier</button>{/if}
  </div>
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr><th>Réf.</th><th>Valeur métier</th><th>Nature</th><th>Responsable</th><th>Missions</th>
          {#each CRIT as c (c)}<th class="num" title={CRITERIA_LABELS[c]}>{c}</th>{/each}
          <th class="num">Biens supports</th><th class="num">ER</th></tr>
      </thead>
      <tbody>
        {#each bvs as b (b.id)}
          <tr class="clickable" use:activable onclick={() => (editBv = b.id)}>
            <td><Ref>{b.ref}</Ref></td>
            <td><strong>{#if b.name}{b.name}{:else}<span class="muted">Sans nom</span>{/if}</strong><div class="muted small">{shortText(b.description, 110)}</div></td>
            <td>{b.nature === "process" ? "Processus" : "Information"}</td>
            <td>{b.owner} {#if b.ownerType === "external"}<span class="badge orange">externe</span>{/if}</td>
            <td class="small">{b.missionIds.map((m) => nameOf(d.missions, m)).join(", ")}</td>
            {#each CRIT as c (c)}<td class="num"><LevelChip scale={s.scales.securityNeeds} value={b.needs[c]} /></td>{/each}
            <td class="num">{d.supportingAssets.filter((a) => a.businessValueIds.includes(b.id)).length}</td>
            <td class="num">{d.fearedEvents.filter((e) => e.businessValueId === b.id).length}</td>
          </tr>
        {/each}
        {#if bvs.length === 0}<tr><td colspan="11" class="muted center">Aucune valeur métier.</td></tr>{/if}
      </tbody>
    </table>
  </div>
{:else if tab === "bs"}
  <div class="row between mb wrap">
    <div class="row">
      <SearchBox value={q} onChange={(v) => (q = v)} />
      <div style="width: 280px"><Combo options={opts.bv} value={bvFilter} onChange={(v) => (bvFilter = v)} placeholder="Filtrer par valeur métier…" /></div>
    </div>
    {#if !ro}<button class="btn primary" onclick={addAsset}><Icon name="plus" size={14} /> Bien support</button>{/if}
  </div>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Réf.</th><th>Bien support</th><th>Type</th><th>Responsable</th><th>Valeurs métier</th></tr></thead>
      <tbody>
        {#each assets as a (a.id)}
          <tr class="clickable" use:activable onclick={() => (editAsset = a.id)}>
            <td><Ref>{a.ref}</Ref></td>
            <td><strong>{#if a.name}{a.name}{:else}<span class="muted">Sans nom</span>{/if}</strong><div class="muted small">{shortText(a.description, 110)}</div></td>
            <td class="small">{s.catalogs.supportingAssetTypes.find((t) => t.id === a.typeId)?.label ?? "—"}</td>
            <td>{a.owner} {#if a.ownerType === "external"}<span class="badge orange">externe</span>{/if}</td>
            <td class="small">{#if a.businessValueIds.length}{a.businessValueIds.map((id) => nameOf(d.businessValues, id, true)).join(", ")}{:else}<span class="muted">—</span>{/if}</td>
          </tr>
        {/each}
        {#if assets.length === 0}<tr><td colspan="5" class="muted center">Aucun bien support.</td></tr>{/if}
      </tbody>
    </table>
  </div>
{:else}
  <div class="card">
    <div class="card-title"><h3>Missions, valeurs métier et biens supports</h3><span class="muted small">Survolez un élément pour isoler ses liens ; cliquez pour l'éditer.</span></div>
    {#if d.businessValues.length}
      <PerimeterMap data={d} onSelect={(k, id) => (k === "bv" ? (editBv = id) : (editAsset = id))} />
    {:else}
      <div class="empty">Le périmètre est vide.</div>
    {/if}
    <div class="legend mt">
      <span><span class="sw" style="background: #3949ab"></span>Processus</span>
      <span><span class="sw" style="background: #5c6bc0"></span>Information</span>
      <span><span class="sw" style="background: #00897b"></span>Bien support interne</span>
      <span><span class="sw" style="background: #00796b"></span>Bien support externe</span>
    </div>
  </div>
{/if}

{#if editBv}<BvDrawer id={editBv} onClose={() => (editBv = null)} />{/if}
{#if editAsset}<AssetDrawer id={editAsset} onClose={() => (editAsset = null)} />{/if}
