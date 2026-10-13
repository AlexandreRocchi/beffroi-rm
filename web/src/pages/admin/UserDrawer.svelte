<script lang="ts">
  import Checkbox from "../../components/Checkbox.svelte";
  import Drawer from "../../components/Drawer.svelte";
  import Field from "../../components/Field.svelte";
  import MultiSelect from "../../components/MultiSelect.svelte";
  import { api } from "../../lib/api";
  import { auth } from "../../lib/auth.svelte";
  import { toast } from "../../lib/feedback.svelte";
  import { fmtDateTime } from "../../study/helpers";
  import type { AdminUser, Group } from "./types";

  let { user, groups, onClose, onSaved, onDelete }: {
    user: AdminUser | null; groups: Group[]; onClose: () => void; onSaved: (pw: string | undefined, username: string) => void; onDelete: (u: AdminUser) => void;
  } = $props();
  // svelte-ignore state_referenced_locally
  let f = $state({
    username: user?.username ?? "",
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    function: user?.function ?? "",
    role: user?.role ?? ("user" as "admin" | "user"),
    canCreate: user?.canCreate ?? true,
    disabled: user?.disabled ?? false,
    authSource: user?.authSource ?? (auth.info.oidc ? "oidc" : "local"),
    groupIds: user?.groups.map((g) => g.id) ?? [],
  });

  async function save(extra: Record<string, boolean> = {}) {
    try {
      if (!user) {
        const r = await api<{ user: AdminUser; temporaryPassword?: string }>("POST", "/api/admin/users", {
          username: f.username, displayName: f.displayName, email: f.email, function: f.function, role: f.role, canCreate: f.canCreate,
          authSource: f.role === "admin" ? "local" : f.authSource,
        });
        if (f.groupIds.length && f.role === "user") await api("PATCH", `/api/admin/users/${r.user.id}`, { groupIds: f.groupIds });
        onSaved(r.temporaryPassword, f.username);
      } else {
        const r = await api<{ temporaryPassword?: string }>("PATCH", `/api/admin/users/${user.id}`, {
          displayName: f.displayName, email: f.email, function: f.function, canCreate: f.canCreate, disabled: f.disabled,
          ...(user.role === "user" ? { groupIds: f.groupIds } : {}), ...extra,
        });
        onSaved(r.temporaryPassword, user.username);
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
</script>

<Drawer title={user ? user.displayName : "Nouvel utilisateur"} {onClose}>
  <Field label="Identifiant" required hint={f.authSource === "oidc" && !user ? "Identifiant transmis par le fournisseur d'identité (preferred_username) : le compte y sera rattaché à la première connexion." : "Nominatif et unique (lettres, chiffres, . _ @ -)."}>
    <input type="text" bind:value={f.username} disabled={!!user} />
  </Field>
  <Field label="Nom affiché" required><input type="text" bind:value={f.displayName} /></Field>
  <div class="grid-2">
    <Field label="Courriel"><input type="email" bind:value={f.email} /></Field>
    <Field label="Fonction" hint="RSSI, DSI, Métier, Direction…"><input type="text" bind:value={f.function} /></Field>
  </div>
  <Field label="Rôle">
    <select bind:value={f.role} disabled={!!user}>
      <option value="user">Analyste (accès aux études selon les droits)</option>
      <option value="admin">Administrateur (gestion des comptes et du journal, sans accès aux études)</option>
    </select>
  </Field>
  {#if f.role === "user"}
    <Field label="Authentification">
      <select bind:value={f.authSource} disabled={!!user}>
        <option value="local">Mot de passe local</option>
        <option value="oidc" disabled={!auth.info.oidc && !user}>Compte de l'organisation (OpenID Connect)</option>
      </select>
    </Field>
    <Checkbox checked={f.canCreate} onChange={(v) => (f.canCreate = v)} label="Peut créer et importer des études" />
    <Field label="Groupes">
      <MultiSelect options={groups.map((g) => ({ value: g.id, label: g.name }))} value={f.groupIds} onChange={(v) => (f.groupIds = v)} />
    </Field>
  {/if}
  {#if user}
    <hr />
    <Checkbox checked={f.disabled} onChange={(v) => (f.disabled = v)} label="Compte désactivé" />
    <div class="row wrap">
      {#if user.locked}<button class="btn" onclick={() => save({ unlock: true })}>Déverrouiller</button>{/if}
      {#if user.authSource === "local"}<button class="btn" onclick={() => save({ resetPassword: true })}>Réinitialiser le mot de passe</button>{/if}
      {#if user.mfaEnabled}<button class="btn" onclick={() => save({ resetMfa: true })} title="Téléphone perdu ou changé : l'utilisateur devra enrôler un nouveau second facteur">Réinitialiser le second facteur</button>{/if}
    </div>
    {#if user.authSource === "oidc"}<p class="muted small">{user.linked ? "Rattaché à une identité du fournisseur de l'organisation." : "En attente de la première connexion par le fournisseur d'identité."}</p>{/if}
    {#if user.authSource === "local"}<p class="small">Second facteur : {#if user.mfaEnabled}<span class="badge green">actif depuis le {fmtDateTime(user.mfaEnabledAt)}</span>{:else if user.mustEnrollMfa}<span class="badge orange">à enrôler à la prochaine connexion</span>{:else}<span class="badge">non activé</span>{/if}</p>{/if}
    <p class="muted small">Créé le {fmtDateTime(user.createdAt)} · dernière connexion {fmtDateTime(user.lastLogin)}</p>
  {/if}
  {#snippet footer()}
    {#if user}<button class="btn danger" style="margin-right: auto" onclick={() => onDelete(user)}>Supprimer</button>{/if}
    <button class="btn" onclick={onClose}>Annuler</button>
    <button class="btn primary" onclick={() => save()} disabled={!f.displayName || !f.username}>Enregistrer</button>
  {/snippet}
</Drawer>
