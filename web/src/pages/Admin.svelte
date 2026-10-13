<script lang="ts">
  import Tabs from "../components/Tabs.svelte";
  import { router } from "../lib/router.svelte";
  import AuditTab from "./admin/AuditTab.svelte";
  import GroupsTab from "./admin/GroupsTab.svelte";
  import UsersTab from "./admin/UsersTab.svelte";

  type Tab = "utilisateurs" | "groupes" | "journal";
  const tab = $derived((router.path.split("/")[2] || "utilisateurs") as Tab);
</script>

<div class="page">
  <div class="section-title">
    <div>
      <div class="eyebrow">Administration</div>
      <h1>Comptes, groupes et journal</h1>
      <div class="subtitle">Le compte administrateur gère les accès mais n'a pas accès au contenu des analyses de risques (besoin d'en connaître).</div>
    </div>
  </div>
  <Tabs tabs={[{ id: "utilisateurs", label: "Utilisateurs" }, { id: "groupes", label: "Groupes" }, { id: "journal", label: "Journal d'audit" }]} value={tab} onChange={(t) => router.navigate(`/admin/${t}`)} />
  {#if tab === "groupes"}<GroupsTab />{:else if tab === "journal"}<AuditTab />{:else}<UsersTab />{/if}
</div>
