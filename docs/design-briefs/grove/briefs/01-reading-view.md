# Brief 01 — The reading view (the entry page)

**The hero surface.** This is what a reader sees and where most of Grove's time is spent.
Get the long-form reading craft right here and the product feels good. Assumes
[`00-foundation`](./00-foundation.md). Source: `grove.md` "Content model", "Wiki-links",
"Images & assets", "Authoring".

## Anatomy of an entry

`.grove-page` → `.grove-entry-header` + `.grove-prose` (+ optional `.grove-toc`,
`.grove-backlinks`). Design these:

1. **Entry header** (`.grove-entry-header` / `.grove-meta`):
   - **Title** — Gabarito 800, sentence case, ends on a period when it's a statement;
     may take the gradient text-clip on hero entries, plain `--ink` on dense reference
     entries. One title per entry.
   - **Meta row** (`.grove-meta`) — mono `--mono-sm`: date, reading time (`→ 6 min read`),
     and tag chips. Muted `--ink-2`. On a reference wiki the date may be hidden; on a
     journal/blog layout it's prominent. This is `<PageMeta />` (brief 03).
   - The optional **edit affordance** sits here, top-right, unobtrusive (brief 02).

2. **The prose body** (`.grove-prose`) — the measured reading column (~68–72ch). Specify
   the full MDX element kit, because MDX renders all of it:
   - Headings h1–h4 (Gabarito, tightening rhythm), body (`--body` 16px/1.5), lists,
     **blockquotes**, and **callouts** (an Obsidian-style `> [!tip] Title` block — a
     hairline-bordered panel with an accent spine and a Lucide icon; design `tip` /
     `note` / `warning` variants using `--accent` / `--ink-2` / a warm-via-token cue,
     never raw red).
   - **Inline code** and **fenced code blocks** — use the editor syntax tokens
     (`--editor-bg`, `--syn-*`) so code on a Grove page matches the platform editor;
     `--r-md` corners, Space Mono.
   - **Tables** (the LOTR/chronology and KB cases lean on these) — hairline rules, mono
     numerics, zebra via `--panel-2` at most; must reflow/scroll on mobile.
   - **Images** — full-width within the measure, `--r-md`, hairline frame, optional mono
     caption. (These come through the SDK asset primitive, `grove.md` "Images & assets" —
     design a **loading placeholder** for an image whose bytes are still resolving: the
     link-graph motif or a shimmer, sized to the image's box to avoid layout shift.)
   - **Embeds** — YouTube/Spotify iframes (Pixies case) in a `--r-md` hairline frame,
     responsive aspect-ratio box, with a lightweight pre-consent poster if the iframe
     hasn't loaded.

3. **Wiki-links in flow** — render the three `.grove-wikilink[data-state]` states from
   brief 00. Show a paragraph with a resolved link, a broken link, and a self-link so the
   contrast is legible.

4. **Table of contents** (`.grove-toc`, the `<Toc />` component) — on `doc` layout, a
   sticky right-rail ToC on desktop that collapses into a top "On this page" disclosure on
   mobile. Current-section highlighted with the accent.

5. **Backlinks** (`.grove-backlinks`, `<Backlinks />`) — a footer block under the prose:
   "`38` entries link here." as a mono stat + a list of linking entries (title +
   breadcrumb of its namespace + the snippet around the link). This is a signature wiki
   affordance — make it feel substantial, not an afterthought. Design its **empty state**
   ("Nothing links here yet.") and a collapsed/expandable form when the list is long.

## Layout variants (`data-layout`, all CSS-selectable)

Same DOM, different `data-layout` — design all three:
- **`doc`** — reference/wiki: optional left namespace context, prose, right ToC rail.
  The default for encyclopedic content (LOTR, KB, Pixies song pages).
- **`post`** — chronological/blog: centered single column, prominent date + author, no
  ToC rail, generous lede. The family-journal / changelog shape.
- **`full`** — full-bleed: edge-to-edge for a landing/portal entry or a media-heavy page,
  minimal chrome.

## Mobile

Single column; the ToC becomes a disclosure; the meta row wraps; tap targets ≥44px;
images and embeds go edge-to-edge within the gutter. Reading column comfortable at 16px.
The edit affordance moves into the entry's overflow menu, never a floating bar over text.

## States

- **Loading** — skeleton of header + 6–8 prose lines + a ToC ghost (no spinner < 150ms).
- **Empty** — an entry that exists but has no body yet ("This entry is a stub." + an
  ask-the-agent / edit affordance if writable).
- **Error / 404** — the route resolves to no entry (a broken `[[wiki-link]]` was
  followed): a designed "No entry at `/slug`." with the closest-match suggestion and, if
  writable, "create it" → hands to the host. Never a raw stack or blank page.
- **Read-only** — identical, minus any edit affordance (brief 02 / 05).

## Copy to draft

The backlinks header ("`N` entries link here."), the stub-entry line, the 404 line +
suggestion, callout default titles, and the image/embed loading captions. Sentence case,
period-terminated, mono for counts.
