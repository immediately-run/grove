# Brief 02 — Shell, navigation, and authoring affordances

How a reader moves through a Grove, and how an author hands off to the host to change it.
Assumes [`00-foundation`](./00-foundation.md). Source: `grove.md` "Tag-driven UI",
"Authoring", "Two ways to use Grove".

## The shell (`.grove-shell`)

A CSS-grid frame whose **regions are filled by tagged content**, not hard-coded (this is
the TiddlyWiki-style tag-driven UI, `grove.md`). Design the frame and each region's
*rendering of tagged entries* — remember the content is data, so design the **template**,
then show it populated and **empty** (a Grove with no `ui/*`-tagged entries still works —
it falls back to title + a default index).

- **`data-nav="top"`** — horizontal nav bar (blog/journal shape).
- **`data-nav="side"`** — left sidebar nav (wiki/docs shape).
Both are CSS-selectable over the same DOM; design both.

## Top nav (`.grove-nav`)

- Left: the **Grove app mark + site title** (the site's own name, from config/home entry).
- Center/right: **menu items composed from `ui/nav`-tagged entries** — pill ghost links,
  sentence case, current one filled faintly. Overflow into a "More" menu past N items.
- Right cluster: **search** trigger (Lucide `search`), **theme toggle** (`☀`/`☾`), and —
  when writable — the **new-entry** and **ask-the-agent** affordances (below).
- Sticky on scroll, hairline bottom border, `--bg` with slight translucency.

## Sidebar (`.grove-sidebar`)

Two stacked, independently designable parts:
1. **Namespace tree** — the hierarchical entry namespace (`grove.md` "Wiki-links") as a
   collapsible tree: folders + entries, current entry highlighted, breadcrumb-aware. The
   LOTR `dwarves/ elves/ men/houses/` structure is the stress test — design nesting to 3–4
   levels without getting noisy. Lucide `chevron` disclosure; mono counts optional.
2. **`ui/sidebar`-tagged sections** — author-defined panels (an "About", a featured list,
   a tag cloud) transcluded from tagged entries. Design the section header + body slot.

## Footer (`.grove-footer`)

Composed from `ui/footer`-tagged entries (links, colophon). Minimal, hairline top border,
mono micro-labels. The brand's huge "Go build."-style sign-off is *immediately.run's*, not
Grove's — a Grove site's footer is the author's, so keep the template neutral.

## Search

Design as an **overlay command palette** (the `⌘K` idiom, but also a tap target on
mobile): an input + live results grouped by kind (entries, tags), each result showing
title + namespace breadcrumb + matched snippet. States: idle (recent / suggested),
typing, **no results** (designed empty: "No entry matches `query`." + create-if-writable),
loading skeleton rows. Keyboard-navigable; visible focus. This is client-side search over
the in-memory index (`grove.md` open question 8) — keep it instant-feeling.

## Authoring affordances — editor hands off, the agent is Grove's own

**Important distinction** (`HANDOFF.md` §Hard constraints, `grove.md` "Authoring"): Grove
**delegates text editing** to the host editor, but **ships its own embedded agent
conversation** (the primary path). So two of the three controls below are *hand-off
affordances*; the third opens *Grove's own* surface (brief 06):

1. **Edit affordance** (`.grove-edit-affordance`) — a small Lucide `pencil`/`edit` control
   on the entry header, shown **only when the source is writable** (re-evaluated on mount
   changes; absent entirely for a read-only viewer). Activating it calls the host
   (`requestEdit` in Mode A / the `edit-file` task in Mode B) — design the control and its
   hover/active/disabled-while-opening states, **not** the editor that appears.
2. **New entry** — a nav-cluster button (Lucide `plus`). Usually this is just a phrasing of
   an agent request; the manual path hands a new MDX file to the host editor with a
   frontmatter stub. Design the button + (optionally) a tiny inline "name / location" step
   that is a *form, not an editor* (`EDITOR_FIRST_EDITING_SPEC` §2.2 — a few typed fields).
3. **Ask the agent** — the **primary** authoring path (`grove.md` "Authoring"), and unlike
   the two above it is **not** a mere nav-cluster button: the agent is **baked in, front and
   center** as an **always-present** surface with a minimal non-obscuring resting affordance
   (the Safari-URL-bar-style thin bottom line / pull tab / icon — **brief 06 owns the form
   and invites iteration**). A nav-cluster "Ask Grove…" entry may *also* exist, but the
   persistent presence is the point. It opens **Grove's own embedded conversation** (brief
   06), not the host agent (a secondary "open in the workbench agent" hand-off should exist),
   reads as **Grove's own** agent scoped to Grove's grants, and never styles itself to pass
   as the host's trusted agent pane.

> Show the edit/new-entry affordances **present (writable)** and **absent (read-only)** so
> the writability gating is unambiguous. The edit/new-entry affordances must not look like
> the host editor they summon; the agent entry point opens Grove's *own* conversation
> (brief 06), which must not look like the *host's* agent pane.

## Mobile chrome

Nav collapses to a top bar with the mark, a search tap target, and a menu (hamburger or
bottom-sheet) that holds nav items + theme toggle. The sidebar namespace tree becomes a
full-height drawer. Authoring affordances live in a per-entry overflow menu. Bottom-sheet
overlays for search and menus; comfy tap targets; reachable with one thumb.

## States & copy

Every region: populated, **empty** (no `ui/*` entries → graceful default), loading
skeleton. Draft: the search placeholder + no-results line, the ask-the-agent label, the
new-entry label, and the read-only-viewer absence (nothing to draw, but note it).
