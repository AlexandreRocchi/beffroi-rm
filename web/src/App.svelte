<script lang="ts">
  import ConfirmHost from "./components/ConfirmHost.svelte";
  import Icon from "./components/Icon.svelte";
  import Logo from "./components/Logo.svelte";
  import Redirect from "./components/Redirect.svelte";
  import Toasts from "./components/Toasts.svelte";
  import { auth } from "./lib/auth.svelte";
  import { link, router } from "./lib/router.svelte";
  import About from "./pages/About.svelte";
  import ChangePassword from "./pages/ChangePassword.svelte";
  import Documentation from "./pages/Documentation.svelte";
  import Login from "./pages/Login.svelte";
  import MfaEnroll from "./pages/MfaEnroll.svelte";
  import Portfolio from "./pages/Portfolio.svelte";
  import Profile from "./pages/Profile.svelte";

  void auth.init();

  const path = $derived(router.path);
  const study = $derived(/^\/etudes\/([^/]+)(?:\/([^/]+))?\/?$/.exec(path));
  const bare = $derived(path === "/connexion");
  const doc = $derived(/^\/documentation(?:\/([a-z0-9-]+))?\/?$/.exec(path));
  /** Mode poste seul : pas de connexion, de compte ni d'administration. */
  const posteRedirect = $derived(auth.poste && !!auth.user && (bare || path === "/profil" || path === "/mot-de-passe" || path === "/securite/mfa" || path.startsWith("/admin")));
  const posteLocked = $derived(auth.poste && !auth.loading && !auth.user && path !== "/a-propos" && !doc);
  /** Accès protégé : connexion, changement de mot de passe imposé, second facteur exigé, rôle. */
  const guard = $derived.by((): string | null => {
    if (auth.loading) return null;
    if (!auth.user) return "/connexion";
    if (auth.user.mustChange) return "/mot-de-passe";
    if (auth.user.mustEnrollMfa) return "/securite/mfa";
    return null;
  });

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  }

  async function logout() {
    await auth.logout();
    router.navigate("/connexion");
  }
</script>

<div class="app-shell">
  {#if !bare}
    <header class="topbar">
      <a href="/" use:link class="brand" aria-label="Beffroi RM — accueil"><Logo size={34} tagline /></a>
      <span class="divider"></span>
      {#if auth.user?.role === "user"}
        <a href="/" use:link class="nav-link" class:active={path === "/"}><Icon name="grid" size={15} /> <span class="lbl">Mes études</span></a>
      {/if}
      {#if auth.user?.role === "admin"}
        <a href="/admin" use:link class="nav-link" class:active={path.startsWith("/admin")}><Icon name="users" size={15} /> <span class="lbl">Administration</span></a>
      {/if}
      <span class="spacer"></span>
      <a href="/documentation" use:link class="nav-link" class:active={!!doc} title="Tutoriels illustrés et glossaire"><Icon name="book" size={15} /> <span class="lbl">Documentation</span></a>
      <a href="/a-propos" use:link class="nav-link" class:active={path === "/a-propos"} title="À propos et conditions d'emploi"><Icon name="info" size={15} /> <span class="lbl">À propos</span></a>
      {#if auth.user && auth.poste}
        <span class="divider"></span>
        <span class="user" title="Mode poste seul : études enregistrées sur ce poste">
          <span class="avatar" aria-hidden="true">{initials(auth.user.displayName)}</span>
          {auth.user.displayName}
          <span class="badge outline">poste local</span>
        </span>
      {:else if auth.user}
        <span class="divider"></span>
        <a href="/profil" use:link class="user" title="Mon profil">
          <span class="avatar" aria-hidden="true">{initials(auth.user.displayName)}</span>
          {auth.user.displayName}
          {#if auth.user.role === "admin"}<span class="badge orange">admin</span>{/if}
        </a>
        <button class="btn ghost sm" onclick={logout} title="Se déconnecter"><Icon name="logout" size={14} /> <span class="lbl">Déconnexion</span></button>
      {/if}
    </header>
  {/if}

  {#if posteRedirect}
    <Redirect to="/" />
  {:else if posteLocked}
    <div class="page">
      <div class="card" style="max-width: 560px; margin: 40px auto">
        <h2>Beffroi RM n'est plus relié à cette page</h2>
        <p>Relancez le programme Beffroi RM : il ouvrira une nouvelle page dans votre navigateur. Vos études sont conservées sur ce poste.</p>
      </div>
    </div>
  {:else if path === "/connexion"}
    <Login />
  {:else if path === "/a-propos"}
    <About />
  {:else if doc}
    <Documentation id={doc[1] ?? null} />
  {:else if path === "/mot-de-passe"}
    {#if auth.loading}<div class="page muted">Chargement…</div>{:else if auth.user}<ChangePassword />{:else}<Redirect to="/connexion" />{/if}
  {:else if path === "/securite/mfa"}
    {#if auth.loading}<div class="page muted">Chargement…</div>{:else if !auth.user}<Redirect to="/connexion" />{:else if auth.user.mustChange}<Redirect to="/mot-de-passe" />{:else if auth.user.authSource !== "local"}<Redirect to="/profil" />{:else}<MfaEnroll />{/if}
  {:else if auth.loading}
    <div class="page muted">Chargement…</div>
  {:else if guard}
    <Redirect to={guard} state={guard === "/connexion" ? { from: path } : undefined} />
  {:else if path === "/profil"}
    <Profile />
  {:else if path.startsWith("/admin")}
    {#if auth.user?.role !== "admin"}
      <Redirect to="/" />
    {:else}
      {#await import("./pages/Admin.svelte") then m}<m.default />{/await}
    {/if}
  {:else if study}
    {#if auth.user?.role !== "user"}
      <Redirect to="/admin" />
    {:else}
      {#await import("./study/StudyRoot.svelte") then m}
        {#key `${study[1]}:${router.param("version") ?? ""}`}
          <m.default id={study[1]} section={study[2] ?? "vue-ensemble"} version={router.param("version")} />
        {/key}
      {/await}
    {/if}
  {:else if path === "/"}
    {#if auth.user?.role === "admin"}<Redirect to="/admin" />{:else}<Portfolio />{/if}
  {:else}
    <Redirect to="/" />
  {/if}
</div>
<Toasts />
<ConfirmHost />
