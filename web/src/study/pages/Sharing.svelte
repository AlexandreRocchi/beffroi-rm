<script lang="ts">
  import { PROTECTION_MARKS } from "@beffroi/shared";
  import Combo from "../../components/Combo.svelte";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import { Api, type AclEntry } from "../../lib/api";
  import { auth } from "../../lib/auth.svelte";
  import { toast } from "../../lib/feedback.svelte";
  import { router } from "../../lib/router.svelte";
  import PageTitle from "../PageTitle.svelte";
  import { useStudy } from "../study.svelte";

  const ACCESS = { read: "Lecture", write: "Lecture et écriture", owner: "Propriétaire" } as const;
  type Dir = Awaited<ReturnType<typeof Api.directory>>;

  const study = useStudy();
  const id = study.studyId;
  const meta = $derived(study.m);
  const ro = $derived(study.readOnly);
  const owner = $derived(meta.access === "owner");
  let acl = $state.raw<AclEntry[]>([]);
  let dir = $state.raw<Dir>({ users: [], groups: [] });
  let pick = $state<string | null>(null);
  const init = study.m;
  let form = $state({ name: init.name, reference: init.reference, organisation: init.organisation, protection: init.protection as string });

  // Mode poste seul : ni partage ni annuaire, seulement les propriétés.
  if (!auth.poste) {
    Api.acl(id).then((a) => (acl = a)).catch(() => undefined);
    Api.directory().then((x) => (dir = x)).catch(() => undefined);
  }

  async function save(entries: AclEntry[]) {
    try {
      const r = await Api.setAcl(id, entries.map(({ principalType, principalId, access }) => ({ principalType, principalId, access })));
      acl = r;
      toast("Droits mis à jour.", "success");
      if (!r.some((e) => e.principalType === "user" && e.principalId === auth.user?.id && e.access === "owner")) router.navigate("/");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function saveMeta() {
    try {
      const m = await Api.updateStudyMeta(id, form);
      study.setMeta({ ...study.m, ...m });
      toast("Propriétés enregistrées.", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  function grant() {
    if (!pick) return;
    const [t, pid] = pick.split(":");
    void save([...acl, { principalType: t as "user" | "group", principalId: pid, access: "read", name: "", username: "" }]);
    pick = null;
  }
  const options = $derived([
    ...dir.users.filter((u) => !acl.some((a) => a.principalType === "user" && a.principalId === u.id)).map((u) => ({ value: `user:${u.id}`, label: `${u.displayName} (${u.username})${u.function ? ` — ${u.function}` : ""}`, group: "Utilisateurs" })),
    ...dir.groups.filter((g) => !acl.some((a) => a.principalType === "group" && a.principalId === g.id)).map((g) => ({ value: `group:${g.id}`, label: g.name, group: "Groupes" })),
  ]);
</script>

{#if auth.poste}
  <PageTitle title="Propriétés de l'étude" subtitle="Étude enregistrée sur ce poste. Pour la transmettre, exportez-la (Exports et imports, format JSON)." />
{:else}
  <PageTitle title="Propriétés, partage et droits" subtitle="Le besoin d'en connaître s'applique : seules les personnes et groupes listés ci-dessous accèdent à cette analyse." />
{/if}
<div class="grid-2">
  <div class="card col gap-lg">
    <h3>Propriétés de l'étude</h3>
    <Field label="Nom" required><input type="text" bind:value={form.name} disabled={ro} /></Field>
    <div class="grid-2">
      <Field label="Référence"><input type="text" bind:value={form.reference} disabled={ro} /></Field>
      <Field label="Organisation"><input type="text" bind:value={form.organisation} disabled={ro} /></Field>
    </div>
    <Field label="Mention de protection" required>
      <select bind:value={form.protection} disabled={ro}>
        {#each PROTECTION_MARKS as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
      </select>
    </Field>
    {#if !ro}<button class="btn primary" style="align-self: flex-start" disabled={!form.name.trim()} onclick={saveMeta}>Enregistrer</button>{/if}
  </div>
  {#if !auth.poste}
    <div class="card col">
      <h3>Accès</h3>
      <div class="table-wrap auto">
        <table class="table">
          <thead><tr><th>Utilisateur ou groupe</th><th style="width: 200px">Droit</th><th></th></tr></thead>
          <tbody>
            {#each acl as a, i (`${a.principalType}:${a.principalId}`)}
              <tr>
                <td><Icon name={a.principalType === "group" ? "users" : "eye"} size={13} /> {a.name} {#if a.username}<span class="muted small">({a.username})</span>{/if}</td>
                <td>
                  <select value={a.access} disabled={!owner} aria-label="Droit de {a.name}" onchange={(e) => { const v = e.currentTarget.value as AclEntry["access"]; void save(acl.map((x, j) => (j === i ? { ...x, access: v } : x))); }}>
                    {#each (Object.keys(ACCESS) as AclEntry["access"][]).filter((k) => a.principalType === "user" || k !== "owner") as k (k)}<option value={k}>{ACCESS[k]}</option>{/each}
                  </select>
                </td>
                <td>{#if owner}<button class="btn ghost sm icon" title="Retirer l'accès" onclick={() => save(acl.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if owner}
        <div class="row">
          <div class="grow"><Combo {options} value={pick} onChange={(v) => (pick = v)} placeholder="Ajouter un utilisateur ou un groupe…" /></div>
          <button class="btn" disabled={!pick} onclick={grant}>Donner l'accès en lecture</button>
        </div>
      {:else}
        <div class="muted small">Seul un propriétaire peut modifier les droits.</div>
      {/if}
      <p class="small muted">Le compte administrateur ne peut pas recevoir d'accès aux analyses. Tous les accès et modifications sont journalisés.</p>
    </div>
  {/if}
</div>
