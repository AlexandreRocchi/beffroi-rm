<script lang="ts">
  import Icon from "../../components/Icon.svelte";
  import { activable } from "../../lib/actions";
  import { api } from "../../lib/api";
  import { confirm, toast } from "../../lib/feedback.svelte";
  import { fmtDateTime } from "../../study/helpers";
  import PasswordNotice from "./PasswordNotice.svelte";
  import type { AdminUser, Group } from "./types";
  import UserDrawer from "./UserDrawer.svelte";

  let users = $state.raw<AdminUser[]>([]);
  let groups = $state.raw<Group[]>([]);
  let edit = $state.raw<AdminUser | "new" | null>(null);
  let pw = $state<{ username: string; password: string } | null>(null);
  function load() {
    api<AdminUser[]>("GET", "/api/admin/users").then((u) => (users = u)).catch((e) => toast(e.message, "error"));
    api<Group[]>("GET", "/api/admin/groups").then((g) => (groups = g)).catch(() => undefined);
  }
  load();

  async function remove(u: AdminUser) {
    if (await confirm({ title: "Supprimer le compte", message: `Supprimer définitivement le compte ${u.username} ?`, danger: true, confirmLabel: "Supprimer" })) {
      try {
        await api("DELETE", `/api/admin/users/${u.id}`);
        edit = null;
        load();
        toast("Compte supprimé.");
      } catch (e) {
        toast((e as Error).message, "error");
      }
    }
  }
</script>

<div class="row between mb">
  <span class="muted">{users.length} compte(s)</span>
  <button class="btn primary" onclick={() => (edit = "new")}><Icon name="plus" size={14} /> Nouvel utilisateur</button>
</div>
<div class="table-wrap">
  <table class="table">
    <thead>
      <tr><th>Nom</th><th>Identifiant</th><th>Fonction</th><th>Rôle</th><th>Groupes</th><th>État</th><th>Dernière connexion</th></tr>
    </thead>
    <tbody>
      {#each users as u (u.id)}
        <tr class="clickable" use:activable onclick={() => (edit = u)}>
          <td><strong>{u.displayName}</strong><div class="muted small">{u.email}</div></td>
          <td class="mono">{u.username}{#if u.authSource === "oidc"} <span class="badge outline" title="Compte de l'organisation (OpenID Connect)">SSO</span>{:else if u.mfaEnabled} <span class="badge outline" title="Second facteur (TOTP) actif">MFA</span>{/if}</td>
          <td>{u.function}</td>
          <td>{#if u.role === "admin"}<span class="badge orange">Administrateur</span>{:else}<span class="badge blue">Analyste{u.canCreate ? "" : " (sans création)"}</span>{/if}</td>
          <td>{u.groups.map((g) => g.name).join(", ")}</td>
          <td>
            {#if u.disabled}<span class="badge red">Désactivé</span>{:else if u.locked}<span class="badge orange">Verrouillé</span>{:else if u.mustChange}<span class="badge">Mot de passe à changer</span>{:else if u.mustEnrollMfa}<span class="badge orange">Second facteur à enrôler</span>{:else if u.authSource === "oidc" && !u.linked}<span class="badge">En attente de connexion</span>{:else}<span class="badge green">Actif</span>{/if}
          </td>
          <td class="nowrap">{fmtDateTime(u.lastLogin)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
{#if edit}
  <UserDrawer user={edit === "new" ? null : edit} {groups} onClose={() => (edit = null)} onDelete={remove}
    onSaved={(pwd, username) => { edit = null; load(); if (pwd) pw = { username, password: pwd }; }} />
{/if}
{#if pw}<PasswordNotice username={pw.username} password={pw.password} onClose={() => (pw = null)} />{/if}
