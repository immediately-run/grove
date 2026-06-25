# Brief 04 — Extensibility views (the agent-built surfaces)

Grove's signature claim is that a coding agent can add views its authors never imagined,
reading existing frontmatter, without changing how entries are written (`grove.md`
"Extending Grove with a coding agent"). These three views are the worked examples — design
them both as **proof the extension surface is designable** and as **on-brand reference
implementations** an agent can target. Assumes [`00-foundation`](./00-foundation.md).

> These are *example* extensions, not core chrome. Design them to feel native to Grove
> (same tokens, same `.grove-*` idiom) so a fork that adds them looks first-party — but
> note in the inventory that they're optional, agent-added components.

## 1. Animated timeline (`grove.md` worked example)

Reads every entry with a `date` and lays them on a time axis. The family-journal and
changelog hero view.
- **Desktop** — a horizontal or vertical time axis with hairline gridlines and mono year/
  month markers; each entry a node (the link-graph node motif) on the axis with title,
  date, and an optional thumbnail/asset; clusters when dense; the accent marks "today".
- **Motion** — restrained reveal as the axis scrolls into view (respect
  `prefers-reduced-motion`; the brand bans bounce/spring — keep it a smooth fade/slide,
  `.14s`–scale, not theatrical). "Animated" here means tasteful progressive reveal, not a
  carousel.
- **Mobile** — vertical axis, single column, nodes stack; sticky date headers.
- **States** — loading (axis skeleton with ghost nodes), empty ("No dated entries yet."),
  and a dense-data state (hundreds of nodes → grouping/zoom affordance).

## 2. Family tree / relationship graph

Reads genealogy frontmatter (`parent`, `house`, …) for the LOTR case. Two presentations
to sketch:
- **Tree** — a classic hierarchical genealogy: nodes (name + dates) joined by hairline
  edges; the current entry highlighted; collapsible branches; pan/zoom on desktop,
  horizontal scroll on mobile.
- **Graph** — when relationships aren't a clean tree, the **link-graph motif made
  literal**: nodes + labelled edges, force-directed-ish but legible. This is where Grove's
  node-and-edge identity pays off visually.
- **States** — loading (ghost nodes/edges), empty ("No relationships defined."), and an
  overflow state (too many nodes → focus + neighbourhood view).

## 3. Directory / table (the company phone book)

Reads structured frontmatter (`name`, `role`, `phone`, …) across a set of entries and
renders a **sortable, filterable table**. The KB case.
- Hairline table, mono for phone numbers/IDs, sticky header, click-to-sort (accent on the
  active column), a filter input reusing the search field styling.
- **Mobile** — table collapses to stacked cards (label/value pairs), not a pinch-scroll
  grid.
- **States** — loading (skeleton rows), empty ("No people listed yet."), no-filter-match.

## Why these three

They span the extension space the product promises: **temporal** (timeline), **relational**
(tree/graph), and **tabular** (directory). If all three are designable in the Grove idiom
and themeable via the same tokens/classes, the "agent adds a view" claim is visually
credible. Keep each one's chrome minimal and its data presentation the star.

## Deliverable

Each view at mobile + desktop, the three states, motion notes (restrained), and a short
note on which frontmatter fields drive it (so a dev/agent can wire it). Themeable via the
brief-00 token/class contract like everything else.
