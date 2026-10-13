<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import { CHAPTERS, PARTS, type Block, type Chapter } from "../docs/chapitres";
  import { escape } from "../lib/actions";
  import { link } from "../lib/router.svelte";

  let { id }: { id: string | null } = $props();

  const chapter = $derived(id ? (CHAPTERS.find((c) => c.id === id) ?? null) : null);
  const index = $derived(chapter ? CHAPTERS.indexOf(chapter) : -1);
  const prev = $derived(index > 0 ? CHAPTERS[index - 1] : null);
  const next = $derived(index >= 0 && index < CHAPTERS.length - 1 ? CHAPTERS[index + 1] : null);

  let q = $state("");
  let zoom = $state<{ src: string; alt: string } | null>(null);

  /** Texte brut d'un chapitre, pour la recherche. */
  function plain(c: Chapter): string {
    const parts = [c.title, c.summary];
    for (const b of c.blocks) {
      if ("p" in b) parts.push(b.p);
      else if ("h" in b) parts.push(b.h);
      else if ("steps" in b) parts.push(...b.steps);
      else if ("list" in b) parts.push(...b.list);
      else if ("tip" in b) parts.push(b.tip);
      else if ("warn" in b) parts.push(b.warn);
      else if ("img" in b) parts.push(b.alt, b.caption ?? "");
      else if ("terms" in b) parts.push(...b.terms.flat());
    }
    return parts.join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const visible = $derived(q.trim() ? CHAPTERS.filter((c) => norm(q).split(/\s+/).every((w) => plain(c).includes(w))) : CHAPTERS);

  /** Mise en forme minimale : **gras**, `code`, [[chapitre|libellé]]. Aucun HTML interprété. */
  type Tok = { k: "t" | "b" | "c"; s: string } | { k: "l"; s: string; to: string };
  function tokens(text: string): Tok[] {
    const out: Tok[] = [];
    const re = /\*\*(.+?)\*\*|`(.+?)`|\[\[([a-z0-9-]+)\|(.+?)\]\]/g;
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (m.index > last) out.push({ k: "t", s: text.slice(last, m.index) });
      if (m[1] !== undefined) out.push({ k: "b", s: m[1] });
      else if (m[2] !== undefined) out.push({ k: "c", s: m[2] });
      else out.push({ k: "l", s: m[4], to: m[3] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ k: "t", s: text.slice(last) });
    return out;
  }
  const src = (img: string) => `/captures/${img}.jpg`;
  const isImg = (b: Block): b is Extract<Block, { img: string }> => "img" in b;
  /** Première capture d'un chapitre (vignette du sommaire). */
  const cover = (c: Chapter) => c.blocks.find(isImg)?.img;
</script>

{#snippet rich(text: string)}{#each tokens(text) as t, i (i)}{#if t.k === "b"}<strong>{t.s}</strong>{:else if t.k === "c"}<kbd>{t.s}</kbd>{:else if t.k === "l"}<a href="/documentation/{t.to}" use:link>{t.s}</a>{:else}{t.s}{/if}{/each}{/snippet}

<div class="page doc-page">
  <div class="doc-layout" class:has-chapter={!!id}>
    <nav class="doc-toc" aria-label="Sommaire de la documentation">
      <a href="/documentation" use:link class="doc-toc-home" class:active={!chapter}><Icon name="book" size={15} /> Documentation</a>
      <label class="doc-search">
        <Icon name="search" size={14} />
        <input type="search" bind:value={q} placeholder="Rechercher…" aria-label="Rechercher dans la documentation" />
      </label>
      {#each PARTS as part (part)}
        {@const items = visible.filter((c) => c.part === part)}
        {#if items.length}
          <div class="doc-toc-part">{part}</div>
          {#each items as c (c.id)}
            <a href="/documentation/{c.id}" use:link class:active={c.id === chapter?.id}>{c.title}</a>
          {/each}
        {/if}
      {/each}
      {#if !visible.length}<p class="muted small">Aucun chapitre ne correspond.</p>{/if}
    </nav>

    <article class="doc-main">
      {#if id}<a href="/documentation" use:link class="doc-back small"><Icon name="left" size={13} /> Sommaire</a>{/if}
      {#if chapter}
        <div class="eyebrow">{chapter.part}</div>
        <h1>{chapter.title}</h1>
        <p class="doc-summary">{chapter.summary}</p>
        {#each chapter.blocks as b, i (i)}
          {#if "h" in b}
            <h2>{b.h}</h2>
          {:else if "p" in b}
            <p>{@render rich(b.p)}</p>
          {:else if "steps" in b}
            <ol class="doc-steps">{#each b.steps as s, j (j)}<li>{@render rich(s)}</li>{/each}</ol>
          {:else if "list" in b}
            <ul>{#each b.list as s, j (j)}<li>{@render rich(s)}</li>{/each}</ul>
          {:else if "tip" in b}
            <div class="callout doc-callout"><strong>Astuce.</strong> {@render rich(b.tip)}</div>
          {:else if "warn" in b}
            <div class="callout warning doc-callout"><strong>Attention.</strong> {@render rich(b.warn)}</div>
          {:else if isImg(b)}
            <figure class="doc-figure">
              <button type="button" class="doc-shot" onclick={() => (zoom = { src: src(b.img), alt: b.alt })} title="Agrandir">
                <img src={src(b.img)} alt={b.alt} loading="lazy" />
              </button>
              {#if b.caption}<figcaption>{@render rich(b.caption)}</figcaption>{/if}
            </figure>
          {:else if "terms" in b}
            <dl class="doc-terms">
              {#each b.terms as [t, d] (t)}<dt>{t}</dt><dd>{d}</dd>{/each}
            </dl>
          {/if}
        {/each}
        <div class="doc-pager">
          {#if prev}<a href="/documentation/{prev.id}" use:link class="btn"><Icon name="left" size={14} /> {prev.title}</a>{:else}<span></span>{/if}
          {#if next}<a href="/documentation/{next.id}" use:link class="btn">{next.title} <Icon name="right" size={14} /></a>{/if}
        </div>
      {:else if id}
        <h1>Chapitre introuvable</h1>
        <p><a href="/documentation" use:link>Retour au sommaire</a></p>
      {:else}
        <div class="eyebrow">Documentation</div>
        <h1>Guide de Beffroi RM</h1>
        <p class="doc-summary">Tutoriels pas à pas, illustrés sur l'étude exemple du guide ANSSI : de la première connexion au plan de traitement du risque. Chaque page d'étude renvoie au chapitre utile par le bouton <kbd>?</kbd> puis <strong>Tutoriel illustré</strong>.</p>
        {#each PARTS as part (part)}
          {@const items = visible.filter((c) => c.part === part)}
          {#if items.length}
            <h2>{part}</h2>
            <div class="doc-cards">
              {#each items as c (c.id)}
                <a href="/documentation/{c.id}" use:link class="card doc-card">
                  {#if cover(c)}<img src={src(cover(c) ?? "")} alt="" loading="lazy" />{/if}
                  <strong>{c.title}</strong>
                  <span class="muted small">{c.summary}</span>
                </a>
              {/each}
            </div>
          {/if}
        {/each}
        {#if !visible.length}<p class="muted">Aucun chapitre ne correspond à « {q} ».</p>{/if}
      {/if}
    </article>
  </div>
</div>

{#if zoom}
  <div class="doc-zoom" role="dialog" aria-modal="true" aria-label={zoom.alt} tabindex="-1" use:escape={() => (zoom = null)}>
    <button type="button" class="doc-zoom-close btn ghost icon" onclick={() => (zoom = null)} aria-label="Fermer (Échap)"><Icon name="close" /></button>
    <button type="button" class="doc-zoom-img" onclick={() => (zoom = null)} aria-label="Fermer l'agrandissement"><img src={zoom.src} alt={zoom.alt} /></button>
  </div>
{/if}
