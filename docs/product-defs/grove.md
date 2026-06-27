# Grove — a minimal, agent-first MDX wiki engine

**Status:** product definition (proposal) · **Updated:** 2026-06-27
**Author:** drafted for peter@peterneumark.com

> *(Reconciliation, 2026-06-27 — the platform source of truth is the immediately-run docs repo's
> `specs/AGENT_AUTHORING_ARCHITECTURE.md`, which **supersedes** several mechanisms still described
> in this doc's deeper sections. Read those sections through these corrections:*
> - ***The authoring agent is the platform *workbench* agent, not a Grove-hosted `llm:chat`
>   mini-app.** It runs in the workbench main pane under the editing-session principal and writes
>   Grove's filesystem directly; **Grove holds no agent and no `llm:chat`** and is a read-only
>   renderer. Sections describing "Grove's own agent is a mini-app" / "Grove ships its own embedded
>   coding-agent from v1" are retired in favour of the unmodified workbench agent (the doc's own
>   intro, line ~12, already says "instruct a coding agent in the immediately.run workbench").*
> - ***Mini-apps are full-stage-region overlays, not scroll-tracked inline rectangles.** The
>   "host-owned sibling composited into a Grove-nominated inline region" + "scroll-tracked region
>   composition" delta is dropped (clickjacking/occlusion surface); capability-using surfaces are
>   full-region overlays with host chrome.*
> - ***The absolute "every elevated capability lives only in a mini-app" is refined to a tier:**
>   high-stakes caps only; a low-stakes `rw` mount may stand (a direct-manipulation app).*
> - ***"Mini-app" is a UX/role word, not a security class.** Stage app and mini-apps are all
>   **entry points of one repo** (`appKey = (provider, namespace, repository, entryPoint)`), each
>   with isolated grants; the stage app is just the default entry point.*
> - *Conflict/undo specifics live in the companion `grove-agent-authoring.md`: undo is
>   per-working-tree-timeline (not per-author); field-merge is deferred V2.)*

> **Grove** is a wiki / knowledge-garden engine for
> [immediately.run](https://immediately.run): every entry is a single MDX file, entries
> interlink densely, and the whole site renders in the browser with no build step. It
> **reads like a wiki**; "blog"-style chronological presentation is just a *layout* over
> the same entries, not a separate product. Grove is **agent-first** — the primary way to
> create and change content is to instruct a coding agent in the immediately.run
> workbench; manual editing is the fallback for when you want perfect control. This
> document defines the product; it is not yet a spec. When the app is scaffolded, this
> file can move into its repo as `PRODUCT_DEFINITION.md`.
>
> **Reads first** (in the immediately-run docs repo): `docs/context/product_definition.md`
> (the platform this app runs on), `docs/context/product_values.md` (the non-negotiables
> this app honours), `docs/specs/EDITOR_FIRST_EDITING_SPEC.md` (the editing-delegation
> model — load-bearing here), `docs/context/core_concepts.md` §3/§5/§7 (slots,
> capabilities, resources).

---

## One-paragraph summary

**Grove** is a minimalistic **wiki engine** for immediately.run where **every entry is a
single MDX file** (Markdown + JSX). It runs straight from a content source — a GitHub
repo or a granted space — renders each entry in the browser with no build step, and
derives all of its structure (slugs, tags, ordering, draft state, navigation) from each
file's **frontmatter**, not from configuration. Entries link to each other with standard
double-bracket `[[wiki-links]]`, and the engine resolves them across a hierarchical
namespace so it can show backlinks and flag broken links. Authors write prose in
Markdown and reach for a small **built-in component library** — available in MDX *with
no import statement* — to drop dynamic indexes into a page (`<DocsByTag tag="design" />`,
`<Backlinks />`, a tag cloud); their **own** reusable elements (infoboxes, repeated
headers) are shared by ordinary **MDX imports**. The defining choice is that Grove is
**agent-first**: you change content and structure by asking the in-browser coding agent,
and fall back to editing the MDX directly in the **immediately.run main-pane editor**
only when you want fine control — Grove ships **no editor of its own** in v1 (though it's
architected to allow one as a fork). Its layout is **themeable by editing CSS alone**, and
it is built so a coding agent can add views its authors never imagined — a timeline, a
family tree — **without changing how entries are written**. Because the
substrate is MDX, an entry can be **interactive content** as readily as prose — a
converter, a clickable report, a Claude-artifact-style mini-UI — and such artifacts are
first-class citizens of the wiki: linkable, taggable, indexed, and contract-described, not
bolted-on widgets (see *Interactive content*, and the companion
[`grove-interactive-content.md`](./grove-interactive-content.md) for its trust and
execution model). Most foundational of all,
every Grove is **self-describing for agents**: it carries a discoverable, partly
self-generated, validated **contract** of its own conventions and decisions, so a future
coding-agent session re-derives exactly how *this* wiki works instead of guessing.

## Positioning — a wiki engine, capable of custom use

Grove is, first and structurally, a **wiki / knowledge-garden** engine: atemporal,
densely interlinked entries with a namespace, backlinks, and transclusion-by-tag. A
**blog or journal is a *view*** of that same content — a chronological layout — not a
second product. We say this plainly because straddling "blog" and "wiki" as co-equals
would make Grove a weak version of each; instead it is a strong wiki engine whose
chronological presentation (the family journal, a changelog, a dev log) is one layout
among several. Where a full blog platform's machinery (feeds, comments, subscriptions,
SEO suites) or a sophisticated wiki's collaboration machinery (page history in spaces,
talk pages, watchlists) is out of v1 scope, this document says so in *Non-goals* rather
than implying completeness.

## Why this app, and how it differs from `markdown-notebook`

The platform already ships [`markdown-notebook`](https://github.com/immediately-run/markdown-notebook),
an Obsidian-style notes app. Grove is deliberately its **run-first, agent-first
counterpart**, and the contrast is the point:

| | `markdown-notebook` | **Grove** |
|---|---|---|
| Authoring | a bespoke in-app source pane (`SourceEditor.tsx`) | **agent-first via a built-in, contract-aware Grove agent conversation**; manual text edits delegated to the platform editor (a bundled editor is a possible *fork*) |
| Primary mode | edit (notes app) | **run/read** (a published site) — run-mode-first (value 2) |
| Entry format | `.md` | **`.mdx`** (prose + JSX components) |
| Structure | folders + a tags view | **frontmatter-driven** (slug, tags, order, draft, layout) |
| Linking | `[[wiki-links]]` (flat) | **`[[wiki-links]]`, relative *or* absolute** in a hierarchical namespace |
| Dynamic content | n/a | **import-free engine components** + author **reuse via MDX imports** |
| Chrome | coded into the app | **tag-driven UI** — menus/buttons/sidebar composed from tagged entries (TiddlyWiki-style) |
| Customization | app code | **CSS-only theming** + **agent-authored extensions** |
| Deployment | one shape | **two** — self-contained app, or stock engine + content-in-a-space |

`markdown-notebook` is the right tool for private note-taking with a live side-by-side
editor. Grove is the right tool for **a public, readable, interlinked site** you
*publish* and mostly *read* — where you change content by asking an agent, and only drop
into the editor when you want to type prose yourself. Both can coexist; this is not a
replacement.

## Who it is for

In the platform's audience priority order (`product_values` §2, §5, §8):

- **Readers** — the primary audience. Most visits are reads of a published Grove site on
  a phone or desktop. The reading experience (typography, navigation, link integrity,
  fast first paint) is never compromised to serve authoring. Mobile is first-class.
- **Authors, including non-technical ones** — people who keep a digital garden, a docs
  site, a personal or family wiki, a knowledge base. The intended on-ramp is **ask the
  agent** ("add an entry about Maya's recital with these photos"), so a non-technical
  author never has to touch YAML or MDX. Those who *want* to type prose drop into the
  platform editor as a fallback.
- **Coding agents** — first-class (value 5), and here doubly so: they are both the
  **primary authoring interface** and the **extension mechanism**. A Grove site is *just
  plain MDX files with frontmatter*, so an agent that has never heard of Grove can create
  an entry, add a tag, fix a link, or build a whole new view by writing files. And because
  each instance carries a self-describing **agent contract** (below), a fresh session
  re-derives this wiki's specific conventions and prior decisions unambiguously — the
  property that makes "agent-first" actually hold *across sessions*, not just within one.

## Representative use cases

These are the shapes Grove should fit well. Each exercises a different cluster of the
features below — and together they bound the design.

- **A Pixies fan site.** One entry per band member and per song, with detailed
  background, embedded YouTube/Spotify players (MDX drops in an iframe/embed), images via
  standard Markdown syntax, and guitar tabs for the famous tracks. Dense `[[wiki-links]]`
  tie songs to members to albums; tag-driven nav turns `member` / `song` / `album` tags
  into menus and index pages; `<DocsByTag tag="song" />` builds the discography
  automatically. A public, read-mostly site → **Mode A** (entries in the repo,
  publish-by-push), great on mobile.
- **A small company's Notion-style knowledge base.** Team processes, business reports,
  and the company phone book live as entries a team co-edits. Shared editing with
  reader/writer roles → **Mode B** (content in a space). The phone book is a set of
  entries whose frontmatter carries `name` / `role` / `phone`, surfaced by a directory
  component; the sidebar is composed from tagged section entries (tag-driven UI), so
  reorganizing the handbook is tagging, not coding.
- **A shared family journal.** A geographically distributed family records events — a
  birth, a seven-year-old's piano recital, an eighteen-year-old's graduation — each
  entry dated in frontmatter, with embedded video and many photos. A family **space**
  (Mode B) with space sharing governs who can post; entries are added from phones, mostly
  by asking the agent (mobile-first authoring without typing MDX); media-heavy entries
  lean on platform large-file support and the asset-embedding primitive (below). The
  dated entries are exactly what a **timeline view** wants (see extensibility, below).
- **A Lord of the Rings mythology wiki.** Dense linking and deep structure: family
  trees of the dwarves, the important elf leaders, the chronology of the rulers of each
  house of Men. Heavy `[[wiki-links]]` with **relative/absolute** resolution over a
  hierarchical namespace (`dwarves/`, `elves/`, `men/houses/`), `<Backlinks />` to see
  who references a figure, reusable infobox components shared by **MDX import**, and
  frontmatter (`reign`, `parent`, `house`) feeding agent-built genealogy and chronology
  views. The encyclopedic, cross-referenced case.

## What you can do with it

- **Read** any Grove site immediately from a URL. Plain MDX files render with zero
  configuration — even a bare folder of `.mdx` files is a usable site (value 3).
- **Navigate** by slug. Each entry has a stable `slug`; the app routes between entries
  by URL hash within the single sandboxed app (the `landing-page` pattern), so links
  are shareable and the back button works.
- **Discover** through frontmatter-derived surfaces: an index, per-tag listings,
  backlinks, chronological views, and a built-in search over titles/tags/body.
- **Author by asking the agent (primary).** Describe the entry you want; the agent
  writes the MDX file with frontmatter. No YAML by hand, no app-specific API.
- **Edit by hand (fallback).** Open an entry in the **platform main-pane editor** for
  perfect control or to type prose; the contribute flow commits or PRs it back to GitHub.
- **Embed images** with ordinary Markdown `![alt](path)` — Grove resolves the file from
  the mounted filesystem and displays it (via the proposed SDK asset primitive, below).
- **Extend with the agent** — add a new view (timeline, family tree, directory) by asking
  the agent, without changing how entries are written.
- **Theme** a fork by editing CSS only — palette, type, spacing, and the common layout
  shapes, with no TypeScript changes.

---

## Two ways to use Grove

Grove is one engine with **two deployment shapes**, chosen by *where the entries live*.
Both run the same code and the same content model; they differ only in the source the
engine reads from — which in turn picks the editing-delegation path and the versioning
story (both below).

### Mode A — the self-contained app (entries live in the app repo)

The entries *and* the engine source live in **one git repository**. You fork the engine,
write your entries under `content/` next to `src/`, and publish by pushing — the repo
*is* your site. This is the **highly customizable, fully-versioned** shape: because you
own the whole repo, you can edit the engine's CSS (theming), extend the component
library, and tune layout, all in the same fork that holds your prose, and git gives you
complete history. It's the natural shape for a **digital garden, a docs site, a personal
wiki, or a blog-style chronological log** that one person (or a small team via PRs) owns
end to end.

- **Content source:** the app's own working tree (`content/**.mdx`), read at baseline.
- **Editing:** `requestEdit({ path })` drops the author into the platform editor on
  that file; the host contribute flow commits/PRs back to GitHub (uses the *landed*
  `EDITOR_FIRST_EDITING_SPEC` §6 Delta A).
- **Versioning:** full git history, diffs, revert, blame, PR review — composed from
  GitHub, not reimplemented (value 7).

### Mode B — engine-from-repo, content-in-a-space

The engine loads from its repository **unmodified**, and the **entries live in a shared
space** the user grants it (`core_concepts` §7). Nobody forks the engine to publish; they
point a stock Grove at their space. This is the natural shape for a **collaborative or
personal wiki** where many people read and write the *content* but nobody touches the
*engine* — space reader/writer/owner roles govern who can edit, and the engine stays a
shared, upgradeable dependency. It trades git's history for frictionless, in-place
editing (see *Versioning & collaboration* for the v1 limits).

- **Content source:** a granted space mount, requested with user consent; writes to a
  read-only space fail with `EROFS`.
- **Editing:** the `edit-file` task delegates exactly the one file being edited
  (`EDITOR_FIRST_EDITING_SPEC` §3.1) — see the §6 Delta B honesty note below for the
  current main-pane-vs-overlay limitation.
- **Customization:** the engine is stock; theming is still possible via the `ui/stylesheet`
  tag (content-carried CSS), but a heavily customized look favours forking into Mode A.

> **The two modes are a spectrum, not a fork in the road.** The engine discovers its
> content source the same way in both (a scan over MDX files); only the *mount* differs.
> A project can even start as Mode A and later point at a space. v1 leads with Mode A
> (it rides the landed `requestEdit` and gives full versioning); Mode B firms up as
> Delta B lands.

### Versioning & collaboration (v1 scope)

The two modes deliberately make different trade-offs, and v1 is explicit about the limits:

- **Versioned content → keep it in git (Mode A).** Full history, diffs, revert, and
  PR-based review come from GitHub. This is the recommended shape for content you can't
  afford to lose or that multiple people review.
- **Frictionless content → a non-versioning space (Mode B).** Single users and small,
  non-technical teams get in-place editing with no git ceremony — at the **accepted risk
  of losing prior revisions**, because v1 spaces are not version-controlled.
- **Real-time conflict reporting, not silent last-write-wins.** When two people edit the
  same entry, the space surfaces the conflict **as it happens** (the engine observes
  concurrent changes via the platform's filesystem change signal, `fs:watch`), so a
  collision is *visible* even though v1 offers no merge/resolution tooling. This is
  strictly better than last-write-wins, and strictly less than a real wiki's history.
- **Out of scope for v1 (a non-goal, not an oversight):** page history *inside spaces*,
  talk/discussion pages, watchlists, per-page provisioning, and true conflict
  resolution/merge. A sophisticated wiki has these; Grove v1 does not build them, and
  points version-critical use at git instead.

> **Dependency to confirm in the spec.** Real-time conflict reporting assumes the
> spaces/filesystem layer signals concurrent writes promptly (the `fs:watch` mechanism
> `EDITOR_FIRST_EDITING_SPEC` §3.1 already uses for live preview). Verify the latency and
> semantics against `FILE_SHARING_SPEC` / `FILESYSTEM_SPEC` before promising it.

---

## Content model — one MDX file per entry, frontmatter as the database

Each entry is exactly one `.mdx` file. There is **no central config file and no
database**; the file *is* the record, and its **frontmatter is the only metadata
surface**. A representative frontmatter:

```mdx
---
title: Why we delegate editing to the host
slug: editor-first              # URL hash; defaults to a slugified path/title
date: 2026-06-25
tags: [design, editing, platform]
draft: false                    # draft entries are hidden in run mode, visible in edit
order: 10                       # optional manual sort key for ordered collections
layout: doc                     # selects a CSS layout class (doc | post | full | …)
description: A short summary for index cards and link previews.
aliases: [editor-first-editing] # extra slugs that redirect here (avoids dead links)
---

# Why we delegate editing to the host

Prose in **Markdown**, with an embedded image in standard syntax:

![The editor overlay](./images/overlay.png)

Drop in a dynamic index with a built-in component — no import line needed:

<DocsByTag tag="design" />

And show who points here:

<Backlinks />
```

**Frontmatter drives everything** the engine does:

- `slug` / `aliases` → routing and stable, rename-safe links.
- `tags` → tag pages, tag clouds, `<DocsByTag>` results, **and** tag-driven UI (below).
- `date` / `order` / `draft` → chronological views, ordering, and visibility.
- `layout` → which CSS layout class the entry is rendered under (theming hook, below).
- `title` / `description` → index cards, link previews, and the document `<title>`.

Unknown frontmatter keys are preserved and passed through to components, so a fork can
invent its own fields (`author`, `cover`, `series`, `reign`, …) and read them from a
component without engine changes. Because authoring is agent-first, a non-technical
author typically never writes this block by hand — they describe the entry and the agent
produces the frontmatter.

### Wiki-links — double-bracket syntax, relative or absolute

Linking between entries uses **standard double-bracket wiki syntax** — the
familiar `[[Entry name]]` — alongside ordinary Markdown links. A pipe gives custom
link text: `[[design/editor-first|why we delegate editing]]`. This is the canonical,
must-have linking form (it's how authors and agents cross-reference entries), and the
engine resolves it against the whole content set, so it can render **backlinks**
(`<Backlinks />`) and **dim or flag broken links** at render time.

Because entries live in a **hierarchical namespace** (the content directory tree),
an entry name in a `[[…]]` link is resolved as either **relative** or **absolute**:

- **Absolute** — a leading `/` resolves from the content root, regardless of where the
  linking entry sits: `[[/guides/install]]` always means that exact entry.
- **Relative** — a bare name, or one with `./` / `../`, resolves **relative to the
  linking entry's own directory**: from `guides/advanced/tuning.mdx`, `[[install]]`
  finds `guides/advanced/install` if present, `[[../intro]]` walks up to `guides/intro`,
  and `[[./caveats]]` stays in the current folder.
- **Resolution order for a bare name** — try the current directory first, then walk up
  toward the root, then fall back to a unique match anywhere in the set (so a flat,
  folderless Grove "just works" with plain `[[names]]`, TiddlyWiki-style). An ambiguous
  bare name is reported (and surfaced as a broken-link style) rather than guessed.
- **Names, slugs, aliases.** A link target matches an entry by its path-name, its
  explicit `slug`, or any of its `aliases`, so renames stay survivable.

The resolution rules are part of the engine, defined once in `src/lib/`, so every
surface (rendered links, `<Backlinks />`, the broken-link audit) agrees.

**The mechanism — a `<WikiLink>` component, resolved on a stable id.** Ordinary Markdown
links (`[]()`) and a plain `<Link>` are *path-coupled* — they break when a file moves. The
`[[…]]` form is implemented by a **remark plugin that rewrites `[[Name]]` into a
`<WikiLink target="…">` component** at parse time, so authors keep the clean double-bracket
ergonomics and the engine gets a real component that participates in backlinks and
broken-link flagging. Crucially, `<WikiLink>` resolves on a **stable `slug` (plus
`aliases`)**, **not** on the prose `title`: the title is display text and is edited often
(you wordsmith headlines), whereas the slug is decoupled from both the path and the title,
so a link survives **both** a file rename **and** a retitle. The pipe form
(`[[slug|custom text]]`) sets only the visible label; the part before the pipe is the
stable id that resolves. (Resolving on `title` would be rename-safe but retitle-fragile —
backwards, since titles change far more than paths.)

### Images & assets — standard Markdown, resolved through the SDK

Authors embed images with ordinary Markdown — `![alt](./images/overlay.png)` — and link
to other assets the same way. There is no Grove-specific image syntax to learn.

Under the hood this is **not** a trivial `<img src>`: the entry's content lives on the
**mounted filesystem** (a space or the app working tree), not at a URL the sandboxed,
opaque-origin iframe can fetch by relative path. The engine must **read the file's bytes
from the mount and attach them to the DOM** — typically by wrapping them in a `Blob` and
handing the element a `URL.createObjectURL(...)` object URL (and revoking it on unmount
to avoid leaks).

**This is a cross-cutting concern, not a Grove concern.** "Resolve a mount-relative path
to a displayable URL" is something many immediately.run apps need (the markdown notebook,
any gallery, any docs app). It therefore belongs in **`@immediately-run/sdk`**, not
reimplemented per app — and **Grove is a good forcing function for adding it.** The shape
to propose (and to check against the current SDK first — don't reinvent it):

- A small primitive — e.g. a `useAssetUrl(path)` hook and/or an `assetUrl(ref)` resolver
  — that maps a mount-relative path to an object URL, owns the **caching and revocation**
  lifecycle, and degrades to a typed error for a missing/forbidden path.
- It should cooperate with **large-file support** (`LARGE_FILE_SUPPORT_SPEC`) so a
  10 MB family-journal photo or an embedded video streams sensibly rather than buffering
  the whole blob where avoidable.

Grove consumes that primitive to back the Markdown image renderer; if the SDK lacks it
today, the spec proposes it as an SDK delta with Grove as the first consumer. *(Open
question below: confirm whether the SDK already exposes an asset-URL helper.)*

---

## The component library — import-free engine components, MDX imports for reuse

Grove distinguishes **two tiers** of components, and the distinction matters:

**1. Engine components — import-free.** The engine pre-registers a small, curated set
into the **MDX provider** so they resolve **with no import statement** in any entry. A
writer (or agent) types `<Backlinks />` and it works. The starter set:

| Component | What it renders |
|---|---|
| `<DocsByTag tag="…" />` | every entry carrying that tag (a filtered, sorted list) |
| `<Backlinks />` | every entry that links to the current entry |
| `<DocList sort="date" filter="…" limit="…" />` | a general index of entries (a chronological view is just this) |
| `<TagCloud />` / `<TagList />` | all tags across the site, sized by frequency |
| `<ChildPages />` | entries "under" this one (by path or an explicit `parent` field) |
| `<Toc />` | a table of contents built from the current entry's headings |
| `<RecentlyUpdated limit="…" />` | most-recently-dated entries |
| `<PageMeta />` | the current entry's frontmatter (date, tags, …) as a styled header |

**2. Author-defined reuse — via standard MDX imports.** When an author has their *own*
repeated element — an infobox for every LOTR character, a "song facts" panel, a shared
callout — they factor it into a component (or an MDX partial) and **import it** the
ordinary MDX way:

```mdx
import Infobox from '../components/Infobox'

<Infobox name="Durin" house="Longbeards" reign="Y.T. — …" />
```

This keeps the engine's import-free set **small and curated** (it's the *vocabulary
everyone shares*) while giving authors unbounded reuse through the standard mechanism
they'd reach for anyway — no bespoke "template" system to learn, and an agent already
knows how to write an import. (Per each repo's `CLAUDE.md` rule 9, MDX is for the prose
entries and these presentational components; the engine's own structured data — the page
index, tag map, link graph — is built from typed scans in `src/lib/`, not authored as
MDX.)

Design rules for the engine components:

- **Data in, markup out.** Each is a thin, presentational reader over the engine's
  in-memory page index (slugs, tags, link graph, dates). They hold no state and perform
  no platform calls — the engine has already gathered the data.
- **Themeable, like everything else.** Each emits stable semantic class names
  (`.grove-doclist`, `.grove-backlinks`, …) and no inline styles, so the CSS-only
  theming rule covers them too.
- **Extensible by agent/fork.** The provider map is one place. Adding a component (or
  overriding `<DocsByTag>`) is one localized edit — the extension surface agents use.

---

## Interactive content — artifacts as first-class citizens

Because every entry is MDX, **content-that-is-code and content-that-is-text are the same
kind of citizen.** This is Grove's structural edge over Obsidian and Notion, where
interactivity is bolted on: a Grove entry can *be* an interactive thing — a Celsius/
Fahrenheit converter, a clickable report over baked-in data, a Claude-artifact-style
mini-UI — and that **artifact entry** is linkable, backlinkable, taggable, surfaced by the
same indexes, described by the same agent contract, and importable like any other entry. Its
edge over a standalone immediately.run app is precisely that it is a **node in the wiki
graph**, not an app that merely happens to be linked. (Grove owns the *linked, namespaced,
indexed, agent-legible substrate*; the artifact is content within it — the line that keeps
Grove from dissolving into "the platform with a wiki shell".)

The full trust and execution model lives in the companion
[`grove-interactive-content.md`](./grove-interactive-content.md). The load-bearing points:

- **The axis is *what capability the content needs*, never *who is looking.*** The same
  content renders the same way for an anonymous visitor, a logged-in non-contributor, and a
  contributor. There is no per-viewer rendering fork — content that looked great to its
  author and degraded to its audience would not be publishable.
- **Capability-free content runs inline, live, identically for all.** Prose, engine
  components, author/forked presentational components, and interactive artifacts that need
  **no elevated capability** all render inline in Grove's own tree. A Grove-supplied
  `<Backlinks />` and a forked `<MyCustomBacklinks />` are indistinguishable — engine code
  holds no privilege a content author's capability-free code lacks. For a large fraction of
  useful artifacts this is the whole story: no permission, no isolation, no preview.
- **The invariant that makes that safe: Grove holds no standing elevated authority.** Inline
  author code inherits Grove's authority, and that authority is only "read the (public) content
  and render it" — so there is nothing in it worth stealing, even for a viewer carrying an
  `llm:chat` key. *Every elevated capability lives only inside a transient, separately-keyed
  mini-app that requested it.* (Honest residual: inline code can still call the browser
  `fetch` — the baseline risk of any web page; bounded later by a platform network policy.)
- **Capability-using content runs as a host-brokered mini-app, started explicitly.** Content
  needing `llm:chat`, `net:fetch`, a writable mount, or a cross-app task runs as a **separate
  immediately.run app** — its own appKey, sourced from a filesystem Grove exposes — shown as a
  **preview (with a capability disclosure) until the viewer starts it**, at which point the
  **host** brokers consent through the **platform's own consent UI**. Outbound/irreversible
  actions confirm at the call. Same flow for every viewer.
- **Grove's own agent is itself a mini-app.** Since the agent needs `llm:chat`, the invariant
  forbids it from being ambient in Grove's tree: it runs through the *same* mini-app path. One
  mechanism serves the agent and third-party artifacts (and it is exactly what security-model
  §8 — "don't hand-roll tools around the SDK" — already wants).
- **The mini-app is a host-owned *sibling*, composited into a Grove-nominated inline region —
  never a DOM child of Grove.** Making it Grove's DOM child would put Grove in the mini-app's
  trusted computing base and hand Grove its capabilities. Instead the host keeps the mini-app a
  direct child of the host window and *paints* it over a rectangle Grove nominates, pinned as
  Grove scrolls: structurally flat, visually inline. This rests on two proposed platform deltas
  — **spawn-a-child-app-from-a-parent-exposed-filesystem-with-its-own-appKey** (load-bearing)
  and **scroll-tracked region composition** (inline-vs-modal) — with a **docked/modal fallback**
  until the second lands, in the same "ships now, improves when the delta lands" spirit as the
  editor path. Details, hazards (scroll sync, z-order, theme propagation), and open questions
  are in the companion doc.

## Tag-driven UI — the chrome is content (TiddlyWiki-inspired)

Grove borrows TiddlyWiki's most distinctive idea: **significant parts of the interface
are not coded into the engine — they are composed from the entries themselves, selected
by tag.** In TiddlyWiki, a tiddler tagged `$:/tags/SideBar` becomes a sidebar tab, one
tagged `$:/tags/PageControls` becomes a page-control button, and one tagged
`$:/tags/Stylesheet` is applied as CSS. The chrome is *data*: to add a menu item you
write a note and tag it, never edit the program. Grove adopts the same model, scaled to
its frontmatter-and-MDX world.

**The mechanism.** The engine reserves a small set of **UI tags** (a namespaced family,
e.g. `ui/nav`, `ui/action`, `ui/sidebar`, `ui/footer`, `ui/home`). It renders each UI
region by **listing the entries carrying that region's tag** and projecting them into
that region — the same "transclude-by-tag" idea as `<DocsByTag>`, but the output is a
menu item / toolbar button / sidebar panel instead of an article-list row. Concretely:

- An entry tagged `ui/nav` appears as a **top-nav / menu item** linking to itself.
- An entry tagged `ui/action` appears as an **action button** (its frontmatter can name
  an icon and, where appropriate, a built-in action; an ordinary action is "navigate to
  this entry").
- An entry tagged `ui/sidebar` contributes a **sidebar section** (its body is
  transcluded), so a "table of contents" or "about" panel is just a tagged entry.
- Ordering within a region is **frontmatter-driven** (`order`, or `list-before` /
  `list-after`), exactly as the rest of Grove is — no separate config.

**Why this is the right fit for Grove:**

- It's the natural extension of the two ideas already in this document — *frontmatter
  drives behavior* and *transclude-by-tag* — applied to the chrome instead of the body.
  The same `<DocsByTag>` engine plumbing powers it.
- It keeps Grove **agent-trivial**: building a navigation menu, adding a button, or
  restructuring the sidebar is *tagging an entry* — which the agent does by editing
  frontmatter, with no engine fork.
- It makes **Mode B** (engine-from-repo, content-in-a-space) genuinely powerful: a stock,
  unmodified engine can host a richly-chromed site whose entire menu/sidebar/button set
  is defined by the space's content.

**The stylesheet tag (CSS as content).** TiddlyWiki's `$:/tags/Stylesheet` has a direct
Grove analogue that ties tag-driven UI to the CSS-only theming requirement: an entry
tagged `ui/stylesheet` can carry CSS (in its body's code block or a frontmatter field)
that the engine applies as a theme. This lets a **space-backed** Grove (Mode B) be
re-themed *without forking the engine* — the theme travels with the content, edited like
any other entry.

**Guardrails (carry into the spec).** UI tags compose authority-free chrome from
content, so the spec must bound them: reserved tags live in a documented namespace
(`ui/*`) so a normal content tag can't accidentally inject chrome; a `ui/action` entry
can only invoke a **curated, declared** action set (navigation and built-ins) — it is
*not* an arbitrary code-execution surface; and CSS from `ui/stylesheet` entries is
applied within the app's own sandboxed iframe under the platform **content-trust** posture
(`core_concepts` §8) — a multi-writer space is lower-trust input, so the spec decides how
freely author-supplied CSS/chrome is honored. (TiddlyWiki trusts its single author; Grove
runs in the platform's capability + content-trust model, which is stricter on purpose.)

---

## Authoring — an embedded agent conversation (primary), manual editing (fallback)

Authoring in Grove is **workbench-centric** — but the two authoring surfaces take
**deliberately different stances**, because users will primarily change content (not just
code) by *talking to a coding agent*, and only sometimes by typing:

- **The agent conversation is the *primary* surface, so Grove builds its own.** Grove ships
  a **Grove-optimized coding-agent conversation from v1** — embedded in the app, aware of
  the wiki and its agent contract — rather than only deferring to the workbench's agent
  pane. (Users *can* still drive Grove from the workbench agent-conversations main pane;
  the embedded one is the integrated, default experience.)
- **Manual text editing is the *fallback* surface, so Grove delegates it.** Hand-editing
  the MDX is the secondary path, so Grove ships **no text editor of its own** in v1 and
  delegates to the immediately.run main-pane editor (editor-first). A bundled WYSIWYG
  editor is a *permitted future extension*, not a v1 feature.

**This asymmetry is the point.** Delegating the *fallback* (text editing) keeps Grove small
and gives authors the one shared editor. Embedding the *primary* surface (the agent
conversation) is worth the cost because it's where most authoring happens — and a generic,
content-unaware agent pane can't give a wiki the integrated feel the primary path needs.
The same logic is a **platform observation**, not just a Grove one (see *Platform
consequence* under "How it fits the platform"): when users author *content* through agents,
the agent conversation deserves to be a first-class, app-customizable surface — which the
platform already anticipates (each `CLAUDE.md` security model §8: "if you embed an LLM
agent, its tool list is your catalog").

### The Grove agent conversation (embedded, v1)

What "Grove-optimized" means concretely — and why it isn't a from-scratch agent:

- **Built on the platform substrate, scoped by the SDK catalog.** Grove's agent is the
  platform's in-browser LLM/agent backend (BYO key via the secret store) plus the
  **SDK-provided method catalog as its tools** — *pre-filtered to Grove's own grants*, so
  the agent can never exceed what Grove may do (each `CLAUDE.md` security model §8; never
  hand-roll tools that shell around the SDK). Grove adds only an **opinionated layer**: a
  system prompt and affordances that make the agent fluent in *this* wiki. A thin,
  capability-clean wrapper, not a new agent engine.
- **Contract-aware by construction.** The agent is primed with the **agent contract**
  (Layer 0 engine conventions + the Layer 1 manifest + the instance's `GROVE.md`), so it
  already knows the frontmatter schema, the tag taxonomy, the namespace, the wiki-links,
  and the registered components — and it **updates `GROVE.md`** when it makes a decision
  (the Layer 2/Layer 3 loop). This is the natural home for "recording the decision is part
  of done."
- **Wiki-fluent affordances.** It offers and understands content operations a wiki wants:
  *"add an entry about X," "tag every song with its album," "fix the broken links here,"
  "reorganize the sidebar," "add a timeline view."* These map onto Grove's own model
  (entries, frontmatter, tags, components), which a content-unaware agent pane does not
  know.
- **In the reading context, mobile-first.** The conversation lives *inside* Grove next to
  what you're reading, so changing *this* entry or *this* wiki never requires a mental
  switch into the editor/workbench. On a phone — where typing MDX is hardest — the
  conversation is the main authoring path.
- **Privileged actions stay host-mediated.** Grove draws the *conversation*; the actual
  file writes/diffs/contributions still go through the SDK/host (diff-before-write, the
  contribute flow), so the embedded agent gains no authority the capability model wouldn't
  otherwise grant. Grove's agent is clearly **its own**, never a visual imitation of the
  host's trusted agent or chrome.
- **The agent is itself a capability mini-app, not ambient in Grove's tree.** Because the
  agent needs `llm:chat`, the *Interactive content* invariant (Grove holds no standing
  elevated authority) forbids it from living in Grove's own render realm — so it runs through
  the **same host-brokered mini-app path** as any capability-using artifact: its own appKey,
  `llm:chat` requested via platform consent, isolated from the inline realm. "Embedded" means
  *mounted as a Grove-branded, Grove-prompted child surface via the platform primitive* — not
  *ambient in Grove's JavaScript*. One mechanism serves the agent and third-party artifacts
  alike (see [`grove-interactive-content.md`](./grove-interactive-content.md)).
- **Coexists with the workbench agent.** The workbench's agent-conversations pane remains a
  valid way to drive Grove (and to do deep, multi-file engine work); Grove offers a
  hand-off to it. The embedded agent is the *default, integrated* surface; the workbench
  agent is the *power* surface.

**1. Primary — the embedded Grove agent (above).** The default way to create or change
content is to tell it what you want; it writes the MDX (frontmatter and all), shows the
diff, and a non-technical author never has to see YAML or MDX. This is the deliberate
answer to the hardest problem in a file-based wiki — that hand-authoring
MDX-with-frontmatter is a technical act — moved off the common path entirely.

**2. Fallback — edit the MDX by hand in the platform editor.** When an author wants
perfect control, or simply prefers to type prose, they open the entry in the
**immediately.run main-pane editor** (`EDITOR_FIRST_EDITING_SPEC` §1). Grove ships **no
text editor of its own** in v1 — it delegates, exactly as the platform's editor-first
principle prescribes, so authors get the one shared, forkable, mobile-capable editor and
its contribute flow rather than a second one.

- **Edit affordance, not an edit mode.** In run mode each entry carries a single
  unobtrusive *edit* affordance. Grove never draws editor chrome, a `<textarea>`, or a
  source pane. The reading UI stays clean (value 2).
- **Two delegation paths, one per usage mode** (`EDITOR_FIRST_EDITING_SPEC` §3):
  - **Mode A — entries in the app repo:** the edit affordance calls
    **`requestEdit({ path })`** (§6 Delta A, *landed* — baseline, self-scoped) to drop
    the author into the platform editor on that file; the contribute flow handles
    commit/PR to GitHub.
  - **Mode B — entries in a shared space:** the edit affordance invokes the
    **`edit-file` task** delegating exactly that one file's capability (§3.1) — the host
    opens the editor and tears the grant down when done, no consent prompt.
- **New entries.** "New entry" is itself usually an agent request; the manual path hands
  a freshly-named `.mdx` file to the platform editor pre-filled with a frontmatter stub.
- **Gate on writability.** The edit affordance appears only when the content source is
  writable (`rw` mount, or a repo the user can contribute to), re-evaluated live on
  `onMountsChange`. A read-only viewer sees a clean, edit-free site — never a dead button
  or an `EROFS` surfaced as UX (`EDITOR_FIRST_EDITING_SPEC` §7.3).

**Extension point — a bundled editor, only if it's ever needed.** Editor-first is the
default *and the strong recommendation*, not an absolute prohibition. Grove is
architected so a fork *could* add a bundled in-app editor if delegation ever proves
insufficient for a specific need (and the author writes down why, per
`EDITOR_FIRST_EDITING_SPEC` §2). v1 does not ship one, and shouldn't — but the door is
left open by design rather than welded shut.

> **Known platform gap (honesty note).** Opening an *arbitrary mounted file* in the
> **main** edit experience from a standalone app is `EDITOR_FIRST_EDITING_SPEC` §6
> **Delta B**, which is **not yet built** — today a space-backed file opens in the
> per-file `edit-file` **overlay**, not the full main pane. For a multi-entry browser
> like Grove the overlay is a slightly-wrong shape; the repo-backed path (`requestEdit`)
> already lands in the main pane. v1 ships on what exists and improves automatically when
> Delta B lands. Grove is a strong motivating consumer for it.

---

## Theming & layout — CSS-only, by construction

A core requirement: **the look and the common layout shapes must be customizable by
editing CSS alone.** A fork should be able to go from "default Grove" to a different
visual identity without opening a `.tsx` file. This is achieved by construction:

1. **Tokens, not literals.** Every colour, font, radius, spacing, and breakpoint is a
   CSS custom property defined in `src/index.css` (the platform design tokens —
   `--bg`, `--panel`, `--ink`, `--accent`, `--grad`, the type families, …). Components
   never hard-code these (each repo's `CLAUDE.md` design-system rule).
2. **Semantic, stable class names — no inline styles, no CSS-in-JS.** The React tree
   renders structural elements with documented class names (`.grove-shell`,
   `.grove-sidebar`, `.grove-content`, `.grove-doclist`, `.grove-page[data-layout]`,
   …). Per each repo's `CLAUDE.md` rule 5, styling lives in `.css` files imported from
   TypeScript, **not** in `style={{}}` blocks — which is exactly what makes CSS-only
   re-theming possible.
3. **Layout is CSS, selected by data.** The page shell is a CSS-grid/flex skeleton
   driven by classes and `data-` attributes; the frontmatter `layout:` field maps to a
   `data-layout` value, so "chronological feed", "wiki doc with sidebar", and "full-bleed"
   are **CSS layout variants**, not separate components.
4. **A documented theming contract.** The class-name/`data-attribute`/token surface is
   written down (a `THEMING.md`), so a re-skin is a well-lit task for a human or an
   agent — "edit `theme.css`," not "reverse-engineer the components."
5. **Honest boundary.** Common customizations (palette, type, spacing, the built-in
   layout shapes) are reachable from CSS alone. A *genuinely new structure* the layout
   classes don't anticipate is a TSX change — which, in Grove, is an agent task (next
   section), not a hand-coding chore.

Dark is the default; the platform's `data-theme="light"` light theme is wired the same
way it is across the brand.

---

## Extending Grove with a coding agent — a first-class goal

A central goal: **a user should be able to extend Grove, with a coding agent, in ways its
original authors never anticipated — even with zero coding skill — without disturbing the
content-authoring workflow.** This isn't a nice-to-have; it's the test the design is built
to pass, and it follows straight from the platform's values (agents are first-class,
value 5; everything outside the kernel is a forkable app, value 4).

**Why Grove makes this structurally easy:**

- **Extensions read content; they don't restructure it.** Behavior comes from frontmatter
  and the engine's in-memory page index (slugs, tags, dates, the link graph). A new
  feature is almost always a new **reader** over data that already exists — not a change
  to how entries are stored or edited.
- **A new feature is a small, localized change.** The natural extension points are the
  ones this document already defines: add a component to the **import-free provider map**,
  add a **layout** (a new `data-layout` + CSS), or add a **tag-driven UI region**. Each
  is a contained edit an agent can make and verify.
- **The authoring workflow is untouched.** Extending the *engine* never changes how
  *entries* are written: they stay plain MDX files. An agent adds a view; authors keep
  writing prose (or keep asking the agent). The two concerns don't collide — which is
  exactly why a non-coder can commission an extension without fear of breaking content.
- **The platform makes the agent loop trivial.** The in-browser coding agent edits the
  app with instant HMR, shows the diff before writing, and contributes via the host flow.

**Worked example — the animated timeline view.** A family-journal user (or the LOTR wiki
author) wants entries shown as a visually rich, animated timeline. With Grove this is a
small ask to the in-browser agent, because the pieces are already in place:

1. Entries already carry a date in frontmatter (`date` is a core field) — *no change to
   any existing entry is required.*
2. The user tells the agent: *"add a timeline view that shows every entry with a date as
   an animated timeline."*
3. The agent adds a `<Timeline />` component that reads the page index, filters entries
   with a date, sorts them, and renders an animated, CSS-styled timeline; registers it in
   the provider map (usable import-free in any entry); optionally adds a `ui/nav` entry to
   surface a **"Timeline"** menu item and a CSS block for the animation.
4. It lands through the normal edit→HMR→contribute loop. **Nothing about writing or
   editing entries changed** — the timeline is a new way to *view* the same files.

The same shape covers the LOTR wiki's **family-tree** and **chronology** views (read
`parent` / `reign` frontmatter) and the company KB's **phone-book directory** (read
`name` / `phone`). The recurring pattern — *new component reads existing frontmatter,
registers import-free, optionally gets a tag-driven menu entry, themed in CSS* — is the
extension surface, kept deliberately small enough for an agent to wield.

> **Honesty note on the extension boundary.** A genuinely new computed *view* (timeline,
> family tree) is engine code, so it lands as a **fork** (Mode A) or a contribution to the
> engine — not as content alone. That's by design: forking is the platform's native
> customization model, and the agent is what makes a fork cheap *to write*. The
> *maintenance* cost of a fork (re-merging upstream engine improvements) is real and is
> the price of deep customization; content-only customization (theme via `ui/stylesheet`,
> chrome via tag-driven UI) avoids it. The spec should keep that line bright so users know
> which asks stay in content and which produce a fork.

---

## The agent contract — how successive agents communicate through the wiki

**This is Grove's foundational design property** — more load-bearing than the engine code
or the MDX-authoring conventions. Because Grove is agent-first, the decisive question is
not whether a *human* understands how the sidebar is built or what a frontmatter field
means; it is whether a **future coding-agent session, starting cold with no memory of the
last one, can read this specific Grove and act on it without misinterpreting it.** A
decision a previous agent made — "this wiki's sidebar comes from `ui/sidebar` entries
ordered by `order`," "song entries always carry `album` and `year`," "there is a custom
`<Infobox>` component" — is worthless if the next session has to *infer* it by sampling
files and guessing. So the most important thing Grove provides is that **every instance is
self-describing in a form a language model interprets the same way every time.** This is
important enough to earn its own spec (`GROVE_AGENT_CONTRACT_SPEC.md`); the direction below
is **committed** (decided 2026-06-25).

### Agents coordinate through the artifact, not with each other

Successive sessions are separated in time, so they cannot hold a live conversation — they
coordinate **stigmergically**, by leaving structured marks in a shared environment the
next one reads (the way social insects coordinate through the environment rather than by
messaging). For Grove, **the wiki carries its own memory**, and the contract below is the
structured index over that memory. There is deliberately **no live agent-to-agent
protocol** — a durable artifact is simpler and more robust than a channel between sessions
that never overlap. The single failure mode this is all shaped to defeat is **drift**: a
hand-written convention that says one thing while the content does another, which the next
agent trusts and then breaks.

### The contract — three layers plus validation

- **Layer 0 — engine conventions (ships with the code; the same for every Grove).** The
  universal rules — reserved `ui/*` tags, the base frontmatter schema, wiki-link
  resolution, the import-free component contract — shipped in the engine repo as an
  agent-facing reference (the Grove analogue of the SDK's `llms.txt`). An agent reads it to
  understand "Grove in general"; a fork that changes engine behaviour updates it in the
  same commit. **Highest trust** — it comes from the engine, not the content.

- **Layer 1 — the derived manifest (generated from content; *cannot drift*).** The engine
  already scans every entry to build the page index, tag map, and link graph, so it
  **emits** the observed reality as a machine-readable file (`.grove/manifest.json`,
  engine-owned, never hand-edited): every frontmatter key in use with inferred types and
  example entries, every tag with its count and which region it drives, the namespace
  tree, the registered components/layouts/themes (name, source path, docstring, props),
  and link-integrity stats. Because it is generated from the content, it **cannot lie about
  the content** — it is the anti-staleness anchor a session reads to learn "what is
  actually here," with no file-sampling.

- **Layer 2 — the authored contract (intent + decisions; what derivation can't see).** A
  discoverable, human-and-agent-readable file, **`GROVE.md` at the content root** (chosen
  to ride the instinct agents already have to look for `AGENTS.md` / `CLAUDE.md` /
  `README.md` at a root). It records what the manifest cannot infer: the **meaning** behind
  the observed facts ("`order` on `ui/nav` controls menu order"), a **declared schema** for
  frontmatter where the instance wants one enforced, the **tag taxonomy's intent**, the
  **namespace/layout rationale**, **component descriptions**, the **invariants** the
  instance promises to uphold, and a **Decisions & rejected alternatives** section
  (don't-relitigate). An agent that makes a decision **writes it here**; a starting agent
  reads it **after** the manifest. **Lower trust than Layer 0** — see the trust boundary.

- **Layer 3 — validation (warn by default, opt-in strict).** Where a convention is
  expressible as a constraint — a declared frontmatter schema (required fields, types,
  enums), the reserved `ui/*` namespace, link integrity, "every `ui/action` names a
  declared action" — the engine **validates content against the contract and surfaces
  violations as diagnostics** to the edit experience and to the agent (via the platform
  `diagnostics:read` surface). By default a violation **warns and never breaks a reader's
  page** (run-mode-first); an instance may opt a specific invariant into **blocking
  errors**. The inverse closes the loop: an **undeclared** new frontmatter key or `ui/*`
  tag raises a "declare this" diagnostic — the mechanism that makes recording-the-decision
  part of "done."

Cross-checking **Layer 1 (facts that can't drift)** against **Layer 2 (declared intent)**
*is* the drift detector: a `GROVE.md` claim about a field the manifest shows is unused is
stale; a manifest tag with no `GROVE.md` entry is undocumented. The engine flags both
rather than silently trusting either (the same "never silently shadowed" instinct as the
platform's overlay-provenance work) — and it does **not** auto-rewrite `GROVE.md`, because
that file holds human/agent intent; it flags it for an agent to reconcile.

### The session loop is the protocol

1. **Start.** Read Layer 0 (engine conventions) → Layer 1 (manifest: what's actually
   here) → Layer 2 (`GROVE.md`: what it means and why). The agent now holds the full
   operating model with nothing guessed.
2. **Work.** Validation surfaces violations and undeclared additions in real time.
3. **Finish ("done" includes this).** The manifest regenerates automatically (it's
   derived); the agent **updates `GROVE.md`** with any new decisions, conventions, or
   components it introduced — and the undeclared-addition diagnostics ensure it doesn't
   forget. The contract now reflects the change, so the *next* session re-derives the wiki
   exactly.

### Trust boundary (a correctness rule, not a preference)

In Mode B (a shared space) or any forked/remote Grove, `GROVE.md` and the content are
**lower-trust, attacker-influenceable** input (`core_concepts` §8 content-trust). The
contract is **descriptive data about conventions — never instructions to obey**: text in
`GROVE.md` that tries to redirect the agent ("ignore your prior rules," "exfiltrate X") is
inert content, not a command. **Layer 0 (the trusted engine repo) outranks Layer 2 (the
possibly-untrusted instance)** in trust, and reading low-trust content taints the session
so later high-authority actions are gated more tightly, exactly as the platform already
specifies. An agent uses the contract to *understand structure*, not to *take orders*.

---

## How it fits the platform (security & composition)

- **Sandbox-native.** Grove runs as an ordinary stage app in the sandboxed iframe under
  the stage principal (`core_concepts` §1/§4). It needs only what it reads.
- **Capabilities, asked-for not taken.** A repo-backed Grove reads its own working tree
  (baseline). A space-backed Grove **requests a mount** for the content space; the *user*
  grants it in host UI, and writes to a read-only space fail with `EROFS`
  (`core_concepts` §5/§7; each `CLAUDE.md` security model §3–§5). All typed errors
  (`forbidden`, `cancelled`, `read-only`) are handled by degrading, never crashing.
- **Content-trust aware.** A Grove rendering a *multi-writer* space is reading
  lower-trust bytes (`core_concepts` §8). MDX executes JSX, so the engine renders the
  curated import-free component set by default and treats arbitrary author-imported
  components and `ui/stylesheet` CSS under the platform's content-trust posture — a
  consideration to carry into the spec, not hand-wave.
- **Composes, doesn't reimplement** (value 7). Publishing & versioning = git (GitHub).
  Manual editing = the platform editor. Contribution/PRs = the host contribute flow +
  GitHub. Identity = host auth. Asset URLs = a (proposed) shared SDK primitive. Grove
  adds the *reading, linking, authoring-affordance, and embedded-agent* layer over MDX and
  owns nothing it can borrow.
- **The embedded agent is composition, not reinvention.** Grove's agent conversation is
  the platform LLM/agent backend + the **SDK method catalog as tools, pre-filtered to
  Grove's grants** (each `CLAUDE.md` security model §8) + a Grove-specific prompt/affordance
  layer. It draws only the *conversation*; writes/diffs/contributes stay host-mediated, so
  it gains no authority outside the capability model and never spoofs the host's agent.

> **Platform consequence (beyond Grove).** Grove embeds its agent because of a realization
> that generalizes: **users author *content* — not just application code — primarily through
> coding agents.** So the agent conversation is not only an editor-adjacent power tool; it
> is *the primary authoring surface*, and apps will want it to feel native. The platform
> already sanctions app-embedded agents (security model §8) and is building agent
> conversations as a workbench surface (the `agent-conversations` plan / `LLM_AND_AGENTS_SPEC`);
> Grove is evidence those should treat **app-customized, content-aware, capability-scoped
> embedded agents** as first-class — with good support for an app supplying the system
> prompt/affordances, conversation persistence for app-embedded agents, and a clean hand-off
> between an app's embedded agent and the workbench agent. Worth feeding back into those
> specs (not done in this PR).

---

## Non-goals & v1 scope boundaries

Stated plainly so the product isn't mistaken for something it isn't:

- **Not a co-equal blog platform.** Chronological presentation is a *layout*, not a
  product. No feeds (RSS/Atom), comments, subscriptions, or SEO/OpenGraph suite in v1 —
  these are candidate future work, not the v1 promise.
- **Not a full collaborative wiki in v1.** No page history *inside spaces*, talk pages,
  watchlists, per-page provisioning, or merge/conflict-resolution. Versioning lives in
  git (Mode A); spaces (Mode B) offer real-time conflict *reporting* only.
- **Not a static-site generator.** No build step, no `dist/`, no deploy — entries render
  in the browser from source.
- **Not a CMS with a database.** Files are the content; frontmatter is the schema.
- **Not a bundled *text editor* (but not forbidden).** v1 delegates manual text editing to
  the platform editor; a fork may add one with a stated reason (`EDITOR_FIRST_EDITING_SPEC`
  §2). *(This is about the editor only — the **agent conversation** is deliberately
  embedded in v1; the two surfaces take opposite stances, see "Authoring".)*
- **Not a from-scratch agent.** The embedded agent is the platform backend + the
  SDK-scoped method catalog + a Grove prompt/affordance layer — not a new agent engine, and
  not a hand-rolled tool surface around the SDK. It runs as a host-brokered mini-app, not
  ambient in Grove's tree (*Interactive content*).
- **Not a bespoke sandbox, consent UI, or server-driven-UI protocol.** Capability-using
  content runs as a host-brokered mini-app using the **platform's** app sandbox and consent;
  Grove does not invent a JSX-as-JSON protocol to render untrusted output in its own tree
  (it reinvents a UI framework, kills full interactivity, and adds latency for no security
  gain over a host-owned sibling). See [`grove-interactive-content.md`](./grove-interactive-content.md).
- **No per-viewer rendering fork.** The same content renders and functions identically for
  anonymous, logged-in, and contributor viewers; behaviour depends on the content's
  capability needs, never on who is looking.
- **Not desktop-only.** Reading, the embedded agent conversation, agent-authoring, and the
  edit affordance are first-class on mobile (value 8).

---

## Open questions (for the spec that follows this)

1. **Asset-URL SDK primitive** — does `@immediately-run/sdk` already expose a
   filesystem-path-to-object-URL helper? If not, define it (hook vs. resolver vs. image
   component, caching, revocation, large-file streaming) with Grove as the first consumer.
2. **Spaces real-time conflict signal** — confirm the `fs:watch` latency/semantics that
   real-time conflict reporting depends on (`FILE_SHARING_SPEC` / `FILESYSTEM_SPEC`).
3. **Mode A vs Mode B for v1** — lead with Mode A (full versioning; landed `requestEdit`)
   or Mode B (frictionless; blocked on §6 Delta B for the main-pane editor)?
   *Recommendation:* Mode A first; Mode B firms up as Delta B lands.
4. **Content discovery** — scan a conventional directory (e.g. `content/**.mdx`) vs. an
   explicit manifest. *Lean:* convention over manifest (zero-config, agent-friendly).
5. **Engine component set and prop contracts** — the table above is a proposal; the spec
   pins names, props, and the override mechanism.
6. **Reserved UI-tag vocabulary** — exact `ui/*` names, the curated `ui/action` set, and
   region ordering/`list-before` semantics.
7. **Wiki-link ambiguity policy** — exact precedence when a bare `[[name]]` could match
   several entries, and how broken/ambiguous links render.
8. **Search & scale** — client-side over the in-memory index for v1; define the entry
   count at which scan-everything/index-in-memory stops being acceptable, and the fallback.
9. **MDX & CSS content-trust posture** — how far to let entries import/execute arbitrary
   JSX, and how freely to honor `ui/action` chrome and `ui/stylesheet` CSS, when the
   source is a low-trust multi-writer space (`core_concepts` §8).
10. **Agent-contract specifics** (own spec, `GROVE_AGENT_CONTRACT_SPEC.md`) — the
    direction is committed (layered durable contract; derived manifest + authored
    decisions; warn-by-default, opt-in-strict). Residual detail for the spec: the
    `.grove/manifest.json` schema and its regeneration trigger; how a declared `GROVE.md`
    frontmatter schema is expressed (fenced JSON/YAML vs. a typed sidecar); whether to also
    emit a pointer `AGENTS.md` for cross-tool discovery; and the precise drift-diagnostic
    rules (Layer 1 ↔ Layer 2 reconciliation).
11. **Embedded-agent mechanics** — what the platform provides today vs. needs: the
    LLM/agent **backend** dependency (the in-browser agent / `LLM_AND_AGENTS_SPEC`, the
    `agent-conversations` plan), the **secret store** for BYO keys, whether the **SDK method
    catalog** already covers Grove's content operations or needs additions, **conversation
    persistence** for an app-embedded agent, how an app supplies the **system
    prompt/affordances**, and the **diff-before-write / contribute** path for agent edits.
12. **Embedded-agent ↔ workbench-agent boundary** — the clean hand-off between Grove's
    embedded conversation and the workbench agent-conversations pane (when each is right;
    shared vs. separate conversation history; avoiding two divergent agents on one wiki).
13. **Interactive-content mechanics** (own companion, `grove-interactive-content.md`) — the
    two platform deltas (spawn-a-child-app-from-a-parent-exposed-filesystem; scroll-tracked
    region composition), the `uses:` capability-declaration shape and preview disclosure,
    appKey identity / consent persistence, the ambient-`fetch` residual and any platform
    network policy, and the serializable inputs contract Grove passes a mini-app at spawn.

## Decisions already made (don't relitigate)

- **Positioned as a wiki engine.** Blog/journal is a chronological *layout* over the same
  entries, not a co-equal product — avoids being a weak version of both.
- **Asymmetric authoring: embed the agent, delegate the editor.** Creating/changing content
  is primarily an **agent conversation**, so Grove ships its **own Grove-optimized,
  contract-aware embedded agent in v1** (built on the platform backend + the SDK method
  catalog scoped to Grove's grants; the workbench agent stays usable too). **Manual text
  editing** is the fallback, so Grove ships **no editor** in v1 and delegates to the
  platform editor (a bundled editor is a permitted future fork). The two surfaces take
  opposite stances on purpose — embed the primary path, delegate the fallback.
- **`[[double-bracket]]` wiki-links, relative or absolute,** resolved over a hierarchical
  namespace — implemented as a remark plugin that rewrites `[[…]]` into a `<WikiLink>`
  component **resolved on a stable `slug` + `aliases` (never the prose `title`)**, so links
  survive both a file rename and a retitle. `title` is the display label only.
- **Interactive content is first-class, on a capability axis.** Content renders by *what
  capability it needs*, never *who is looking* (no per-viewer fork). Capability-free content
  (incl. author/forked components and many artifacts) runs **inline, live, identically for
  all** — safe because **Grove holds no standing elevated authority**. Capability-using
  content (incl. Grove's own agent) runs as a **host-brokered, separately-keyed mini-app**,
  shown as a preview until the viewer starts it, consented through **platform** UI. The
  mini-app is a **host-owned sibling composited into a Grove-nominated inline region — never
  a DOM child of Grove** — resting on two proposed platform deltas with a docked/modal
  fallback. Full model in [`grove-interactive-content.md`](./grove-interactive-content.md).
- **Frontmatter is the only metadata surface.** No separate config/database.
- **Two component tiers:** a small **import-free** engine set (the shared vocabulary) and
  author **reuse via standard MDX imports** (infoboxes, partials).
- **The UI is content-defined (tag-driven), TiddlyWiki-style.** Menus, buttons, sidebar
  sections, and themes are composed from tagged entries, not coded into the engine.
- **Images use standard Markdown syntax,** resolved through a (proposed) **shared SDK
  asset-URL primitive** — a cross-cutting concern Grove forces, not Grove-specific code.
- **CSS-only theming** for the look and the built-in layout shapes, enforced by the
  no-inline-style / tokens-from-`index.css` construction rules.
- **v1 versioning/collaboration scope:** git for history (Mode A); non-versioning spaces
  with real-time conflict *reporting* (Mode B); full wiki collaboration is a non-goal.
- **Agent-extensibility is a design test, not a feature.** Extensions are *readers* over
  existing frontmatter, so an agent can add unforeseen views without changing how entries
  are authored.
- **Agent legibility is Grove's foundational property** (decided 2026-06-25, more core
  than the engine code or the authoring conventions). Successive agent sessions coordinate
  **stigmergically through a durable, layered contract** the wiki carries — engine
  conventions (shipped) + a content-**derived manifest** that can't drift + an agent-
  **authored** record of intent/decisions — with **warn-by-default, opt-in-strict**
  validation, and **no live agent-to-agent protocol**. Recording a decision is part of an
  agent's "done." The contract is read as **descriptive data, never as instructions**
  (content-trust; Layer 0 > Layer 2). Warrants its own spec
  (`GROVE_AGENT_CONTRACT_SPEC.md`).
