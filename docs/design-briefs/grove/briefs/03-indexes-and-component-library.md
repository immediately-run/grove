# Brief 03 — Indexes and the built-in component library

Discovery surfaces and the visual vocabulary of the import-free components. Assumes
[`00-foundation`](./00-foundation.md). Source: `grove.md` "The component library",
"Content model".

## The index / home

A Grove's home is itself an entry that typically renders a `<DocList>` (chronological feed
or grid) — there's no separate "home template" to invent, but design the **two index
shapes** the components below produce, because the home, tag pages, and section pages all
reuse them:

- **Feed shape** — a vertical list of entry rows (title, mono date, tag chips, a
  one-line description/excerpt, reading time). The journal/blog/changelog look.
- **Grid shape** — entry **cards** on the brand's asymmetric tile grid: hairline `--r-lg`
  card, optional cover/asset or the link-graph placeholder motif, title, description, tag
  chips, the hard-offset hover lift. The showcase look (Pixies discography, KB sections).

Both must show **loading** (skeleton rows/cards), **empty** ("No entries yet."), and
work mobile-first (cards → single column).

## The built-in components (design each once, reuse everywhere)

Each is a thin presentational reader with a stable `.grove-*` class (brief 00). Design the
**populated**, **empty**, and **loading** appearance of each:

| Component | Class | Visual spec |
|---|---|---|
| `<DocList sort filter limit>` | `.grove-doclist` | the feed/grid shapes above; sort/filter are data, not visible chrome unless the author adds it |
| `<DocsByTag tag>` | `.grove-doclist` (filtered) | identical to DocList; the tag-page body is just this. Header shows the `#tag` + count |
| `<Backlinks>` | `.grove-backlinks` | footer block: mono "`N` entries link here." + linking-entry list with snippet (detailed in brief 01) |
| `<TagCloud>` / `<TagList>` | `.grove-tagcloud` | tag chips sized by frequency (cloud) or a plain sorted list; chips are the brief-00 component |
| `<ChildPages>` | `.grove-doclist` (scoped) | the entries under this one; a compact nested list |
| `<Toc>` | `.grove-toc` | the on-this-page rail/disclosure (brief 01) |
| `<RecentlyUpdated limit>` | `.grove-doclist` (date-sorted) | compact dated list, mono dates |
| `<PageMeta>` | `.grove-pagemeta` | the entry's date + tags as a styled header strip (used in the entry header, brief 01) |

Design rules to honour visually: **data in, markup out** (no chrome of their own beyond
their class), and they must **re-skin via CSS** like everything else.

## Author reuse — the `<Infobox>` example

Authors share their own repeated elements by **MDX import** (`grove.md` "two component
tiers"). Design one **reference example** so the pattern is concrete and dev-copyable: an
**`<Infobox>`** (the LOTR character / Pixies song "facts panel"):
- A right-floated (desktop) / full-width (mobile) hairline `--r-lg` panel inside the prose
  column; a gradient or `--panel-2` header bar with the subject name; a definition-list
  body of typed fields (mono labels, `--ink` values) read from frontmatter
  (`house`, `reign`, `album`, `released`, …); optional cover asset at top.
- This is **author-land**, not an engine component — present it as a *pattern + example*
  others clone, styled with `.grove-`-adjacent classes so it themes consistently.

## Tag pages

The destination of a tag chip / `ui/nav` tag: header (`#tag`, count, optional description
entry), then `<DocsByTag>` in feed or grid shape, plus a "related tags" `<TagList>`.
Empty state for a tag with no entries.

## States & copy

Per surface: populated, empty (each component's "nothing here" line — make them specific:
"No entries tagged `#song` yet.", "Nothing links here yet."), loading skeletons. Draft the
index/section headers and the count strings (mono). Sentence case, period-terminated.
