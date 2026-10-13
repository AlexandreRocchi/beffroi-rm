<script lang="ts">
  import Drawer from "../../components/Drawer.svelte";
  import Empty from "../../components/Empty.svelte";
  import Field from "../../components/Field.svelte";
  import Icon from "../../components/Icon.svelte";
  import MultiSelect from "../../components/MultiSelect.svelte";
  import { activable } from "../../lib/actions";
  import { api } from "../../lib/api";
  import { confirm, toast } from "../../lib/feedback.svelte";
  import type { AdminUser, Group } from "./types";

  let groups = $state.raw<Group[]>([]);
  let users = $state.raw<AdminUser[]>([]);
  let edit = $state.raw<Group | "new" | null>(null);
  let f = $state({ name: "", description: "", memberIds: [] as string[] });
  function load() {
    api<Group[]>("GET", "/api/admin/groups").then((g) => (groups = g)).catch((e) => toast(e.message, "error"));
    api<AdminUser[]>("GET", "/api/admin/users").then((u) => (users = u)).catch(() => undefined);
  }
  load();

  function open(g: Group | "new") {
    edit = g;
    f = g === "new" ? { name: "", description: "", memberIds: [] } : { name: g.name, description: g.description, memberIds: g.members.map((m) => m.id) };
  }

  async function save() {
    try {
      if (edit === "new") {
        const r = await api<{ id: string }>("POST", "/api/admin/groups", { name: f.name, description: f.description });
        await api("PATCH", `/api/admin/groups/${r.id}`, { memberIds: f.memberIds });
      } else if (edit) {
        await api("PATCH", `/api/admin/groups/${edit.id}`, f);
      }
      edit = null;
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function remove(g: Group) {
    if (await confirm({ title: "Supprimer le groupe", message: "Les droits accordés via ce groupe seront retirés.", danger: true })) {
      await api("DELETE", `/api/admin/groups/${g.id}`);
      edit = null;
      load();
    }
  }
</script>

<div class="row between mb">
  <span class="muted">Les groupes permettent d'accorder des droits sur une étude à plusieurs analystes à la fois.</span>
  <button class="btn primary" onclick={() => open("new")}><Icon name="plus" size={14} /> Nouveau groupe</button>
</div>
{#if groups.length === 0}
  <div class="card"><Empty title="Aucun groupe" /></div>
{:else}
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Groupe</th><th>Description</th><th>Membres</th></tr></thead>
      <tbody>
        {#each groups as g (g.id)}
          <tr class="clickable" use:activable onclick={() => open(g)}>
            <td><strong>{g.name}</strong></td>
            <td>{g.description}</td>
            <td>{#if g.members.length}{g.members.map((m) => m.displayName).join(", ")}{:else}<span class="muted">—</span>{/if}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
{#if edit}
  {@const current = edit}
  <Drawer title={current === "new" ? "Nouveau groupe" : current.name} onClose={() => (edit = null)}>
    <Field label="Nom" required><input type="text" bind:value={f.name} /></Field>
    <Field label="Description"><textarea bind:value={f.description}></textarea></Field>
    <Field label="Membres">
      <MultiSelect options={users.filter((u) => u.role === "user").map((u) => ({ value: u.id, label: `${u.displayName} (${u.username})` }))} value={f.memberIds} onChange={(v) => (f.memberIds = v)} />
    </Field>
    {#snippet footer()}
      {#if current !== "new"}<button class="btn danger" style="margin-right: auto" onclick={() => remove(current)}>Supprimer</button>{/if}
      <button class="btn" onclick={() => (edit = null)}>Annuler</button>
      <button class="btn primary" onclick={save} disabled={!f.name.trim()}>Enregistrer</button>
    {/snippet}
  </Drawer>
{/if}
