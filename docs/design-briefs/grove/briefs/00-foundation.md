# Brief 00 — Grove foundation (read first)

**For:** whoever designs/builds Grove. **Read with:** [`../HANDOFF.md`](../HANDOFF.md),
`docs/product-defs/grove.md`, `src/index.css`,
`CLAUDE.md` "Design system". Every other Grove brief assumes this foundation and only
notes its deviations.

## Inherit, don't invent

The default Grove theme **is** the immediately.run brand applied to a reading surface. All
foundations from `CLAUDE.md` "Design system" hold verbatim: near-black `--bg` (`#0a0b11`)
dark default + lilac-white light (`data-theme="light"`); the `--grad` magenta↔violet
signature gradient (text-clip on display headlines + big numerals, fill on the app mark
and primary buttons, **never** behind body text); Gabarito 800 display / Public Sans body /
Space Mono details; translucent violet hairlines define surfaces; the hard-offset
`6px 6px 0 var(--accent-2)` hover shadow; pills for buttons; the radii ladder
(`--r-xs`…`--r-pill`); the two faint radial page washes; Lucide + the unicode micro-set;
restrained `.14s` motion. Don't restate these per surface — design to them.

## What's Grove-specific (the small delta to add)

1. **Reading typography is the centrepiece.** The marketing site shouts in display type;
   Grove mostly renders **long-form MDX prose**, so the body reading column is where the
   craft goes. Define a measured prose scale (≈`--body` 16px/1.5, max measure ~68–72ch,
   generous heading rhythm in Gabarito, Space Mono for inline `code`/fenced blocks using
   the editor syntax tokens). This is the one place the brand's "fashion-poster display
   type" yields to **legibility**. Headlines (entry titles, section heads) still end on a
   period and may take the gradient clip; running prose never does.

2. **The link-graph motif — Grove's flavour of the placeholder texture.** The brand's
   recurring "art" is the 45° hairline stripe. Grove adds a sibling motif that *means*
   something here: a sparse **node-and-edge lattice** (small `--ink-3` dots joined by
   hairline `--line` edges) evoking the interlinked entries / knowledge graph. Use it for
   empty-state art, the app-icon glyph, and saturated tiles (with a radial accent bloom
   over it, like the stripe tiles). It is abstract and geometric — **no literal trees,
   leaves, or photography** (the "grove/garden" is a metaphor, not an illustration).

3. **Wiki-link styling — a first-class type treatment.** `[[wiki-links]]` need three
   visible states (this is load-bearing for a wiki, `grove.md` "Wiki-links"):
   - **resolved** — accent-tinted link, subtle underline-on-hover, no icon clutter;
   - **broken/ambiguous** — dimmed to `--ink-3` with a hairline dotted underline and a
     small Lucide `unlink`/`alert` cue; never red-error-loud, but unmistakably "dead";
   - **current entry / self** — non-interactive, `--ink` weight.
   Markdown links and `[[wiki-links]]` should be visually distinguishable at a glance.

4. **Tag chips.** Tags are everywhere (frontmatter, tag pages, tag-driven UI). One chip
   component: mono `#tag`, hairline pill, faint fill on hover, accent border when active.
   Reserved `ui/*` tags are an authoring concept, **not** shown as content chips.

## The agent contract — Grove's foundation, mostly invisible

Grove's deepest property is **agent legibility**: each instance carries a self-describing
contract (`grove.md` "The agent contract") — a shipped engine reference, a generated
`.grove/manifest.json`, and an authored `GROVE.md` — so a future coding-agent session
re-derives this wiki's conventions instead of guessing. **You don't style these files**
(they're agent-facing), and the contract's **validation/drift diagnostics surface through
the host edit experience, not Grove** (don't draw a diagnostics panel — see `HANDOFF.md`
constraint 1). Your job is the *flip side* of the same coin: the structure a reader sees
**is** the structure an agent reads, so making it legible is the design contribution.
Touchpoints:
- **In-content legibility** — the wiki-link states above, tag chips, and the namespace
  tree (brief 02) carry the conventions visibly. Get these crisp and the wiki is legible
  to humans and agents alike.
- **The embedded Grove agent (brief 06)** — the contract's working interface; it reads and
  updates `GROVE.md`. It *is* a styled surface (Grove's own, not the host's), and most
  users touch the contract through it.
- **An optional `/about` (colophon) entry** — a human-readable summary of the instance's
  conventions is just a normal MDX entry in the reading view; no special chrome, but a
  tasteful colophon pattern is a welcome example deliverable.

## The class-name + token contract (the themeability backbone)

Grove's CSS-only theming promise (`grove.md` "Theming & layout") only works if you design
to **stable, documented class names** driven by tokens — never one-off styling. Treat this
list as the contract a `THEMING.md` will publish; name layers in your mockups accordingly:

| Class | Surface |
|---|---|
| `.grove-shell` | the app frame (nav + sidebar + content + footer grid) |
| `.grove-nav`, `.grove-sidebar`, `.grove-footer` | the tag-driven chrome regions |
| `.grove-content` | the reading column wrapper |
| `.grove-page[data-layout="doc\|post\|full"]` | per-entry layout variant (from frontmatter `layout`) |
| `.grove-entry-header` / `.grove-meta` | title + frontmatter meta (date, tags) |
| `.grove-prose` | the MDX-rendered body (all prose element styles scope under here) |
| `.grove-wikilink[data-state="ok\|broken\|self"]` | link states above |
| `.grove-doclist`, `.grove-backlinks`, `.grove-tagcloud`, `.grove-toc`, `.grove-pagemeta` | built-in components (brief 03) |
| `.grove-tag` | the tag chip |
| `.grove-edit-affordance` | the host hand-off control (brief 02) |
| `.grove-agent`, `.grove-agent-launcher`, `.grove-agent-message`, `.grove-agent-preview` | Grove's own embedded agent conversation (brief 06) |

Layout shape is selected by `data-` attributes on `.grove-shell` / `.grove-page` (e.g.
`data-nav="top\|side"`, `data-layout="…"`) so re-laying-out is a CSS/data change, not a
component swap. **No inline styles, no CSS-in-JS** in anything you hand to a dev.

## The Grove app mark

Grove is an app within immediately.run, so it gets an **app icon** in the system idiom
(like the runner mark, but Grove's): a rounded-square tile (~23% corner radius) filled
with the `--grad` magenta→violet gradient, bearing an abstract **node-and-edge glyph**
(2–4 nodes joined by edges — the link-graph motif, masked to white over the gradient).
Provide: the full tile icon, a simplified tiny inline variant (a single rotated
gradient square at `--r-xs`, like the editor top-bar mark, for cramped chrome), and the
wordmark **`grove`** set in Gabarito 800 lowercase. Keep it unmistakably part of the
immediately.run family — not a competing logo.

## Voice (drafted copy must match)

Confident, plainspoken, sentence case; display headlines end on a hard period; numbers
brag in mono (`142 entries`, `38 backlinks`); one gradient marker-highlight per block,
max; no emoji, no exclamation points. Empty/error copy is helpful and intentional, never
cute. Grove's own micro-labels wear mono `/slug` and `#tag` ornament like the rest of the
brand.
