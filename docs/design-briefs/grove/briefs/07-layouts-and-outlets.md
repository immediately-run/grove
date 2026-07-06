# Brief 07 — Layouts & outlets (separating chrome from content)

How Grove separates **page layout from page content** so entries don't each repeat
the nav, sidebar, footer, section hero, etc. — while the URL keeps naming the
**actual content file**. This is Grove's take on React Router's nested layout
routes / outlets, adapted to the content-is-chrome model. Assumes
[`00-foundation`](./00-foundation.md); relates to `grove.md` "Theming & layout"
and the tag-driven UI section.

> **Two different things both once called "layout".** Keep them distinct:
> - **`layout:` frontmatter** (`doc` | `post` | `full`) → a CSS **`data-layout`
>   variant** of a single page (its measure, whether it has a ToC rail). Per-page,
>   visual, unchanged by this brief.
> - **A layout file (`_layout.mdx`) + `<Outlet/>`** → shared **chrome composition**
>   wrapped *around* a page (and around a whole folder of pages). This brief.
>   The per-entry override key for it is **`frame:`**, chosen so it never collides
>   with `layout:`.

## The mechanism

- **`<Outlet/>`** is an import-free engine component. Inside a layout it marks
  where the page — or the next nested layout — renders. (The React Router analogue.)
- **A layout is an MDX file** named `_layout.mdx`. It arranges chrome out of the
  import-free layout primitives (`<GroveNav/>`, `<GroveSidebar/>`, `<GroveFooter/>`,
  and any author/engine component) around an `<Outlet/>`. Because it's MDX, it's
  authored, forked, and CSS-themed like any entry — the shell is **content**.
- **Association is folder convention, nested up the namespace.** A `_layout.mdx`
  in a directory wraps every entry in that subtree, and directories nest:
  `content/_layout.mdx` (the site shell) wraps `content/people/_layout.mdx` (a
  section) wraps the profile page. That chain **is** the outlet nesting.
- **The URL never sees it.** Routing still targets the leaf content file
  (`/content/people/ada-lovelace.mdx`); the engine resolves the layout chain
  *around* it at render time. Layout files are `_`-prefixed, so they're excluded
  from routing, nav, the sidebar tree, search, backlinks, and every index —
  they're structure, never entries.

## Overriding the convention — `frame:`

Frontmatter on an entry overrides folder convention:

- `frame: none` (or `frame: false`) → render the page **bare** (no chrome) — for a
  landing/portal page that supplies its own frame.
- `frame: <slug>` → wrap with exactly that one layout instead of the inherited chain.
- A `_layout.mdx` whose own frontmatter sets `frame: none` becomes a **new root** —
  layers above it are dropped (a section that deliberately escapes the site shell).

## The engine/content seam (what's *not* content)

"Shell as content" stops at the visible arrangement. The invisible scaffolding
stays in the engine because MDX can't own it:

- the outer `.grove-root` / `.device__scroll` / `.grove-shell` wrappers and the
  `data-theme` / `data-vw` / `data-nav` attributes every CSS rule keys off;
- the shell state (theme, appearance, search/drawer/menu open) — held in
  `GroveShellContext` and *read* by the chrome components wherever a layout places
  them;
- the global overlays (search, drawer, the Grove agent).

So a layout composes and places the chrome; the engine provides the themed
container, the state, and the overlays. Delete every `_layout.mdx` and the engine
falls back to a **built-in default shell** that is the identical arrangement — so a
bare folder of `.mdx` is still a fully-chromed site (value 3).

## Reference implementation (in this repo)

- `content/_layout.mdx` — the site shell as content: `<GroveNav/> <GroveSidebar/>
  <main className="grove-content"><Outlet/></main> <GroveFooter/>`.
- `content/people/_layout.mdx` — a nested section: a shared hero + a "more people"
  rail (`<ChildPages/>`) around `<Outlet/>`, so **no profile carries that header**.
- `.grove-section*` classes in `GroveApp.css` — the section-layout styling, themeable
  via the same token/class contract as everything else (brief 00).

## Deliverable / design notes

Design the section-layout shapes (hero band, section sub-nav, section footer) so a
folder of entries reads as a coherent sub-site while each page's own `data-layout`
still governs its reading column. Show a section layout at mobile + desktop and its
empty state (a section with one entry → the "more" rail hides). Restrained motion,
hairline borders, tokens only — like the rest of Grove.
