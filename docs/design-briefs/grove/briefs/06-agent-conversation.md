# Brief 06 — The embedded Grove agent conversation

Grove's **primary authoring surface**, and the one new app-owned surface this refinement
adds. Unlike text editing (delegated to the host editor), the agent conversation is
**embedded in Grove** because most users change content — not just code — by talking to an
agent, so it must feel native to the wiki (`grove.md` "Authoring — an embedded agent
conversation"; "The Grove agent conversation"). Assumes [`00-foundation`](./00-foundation.md).

**Bake it in, front and center — but never obscure content.** The agent communication is an
**integral, always-present** part of the Grove experience, not a tucked-away tool you go
find: it should be visible and one gesture away at all times, and **front and center in the
authoring/editing experience**. The binding constraint is that on mobile it must **not
obscure the content** — so its resting state is a *minimal persistent affordance* (a thin
input line pinned at the bottom à la the iOS Safari URL bar, a pull tab/handle, or a small
icon) that **expands on demand** and **collapses back**. This brief sets that intent and the
constraints; **it deliberately leaves the exact form open — explore 2–3 approaches, compare
them, and recommend.**

## What this is (and what it is not)

- It **is** Grove's *own* conversational coding agent: contract-aware (it knows this wiki's
  frontmatter schema, tags, namespace, components from `GROVE.md` + the manifest), fluent in
  wiki operations, scoped to Grove's grants via the SDK method catalog.
- It is **not** the host's agent pane, and must never be styled to pass as it. It is also
  not a from-scratch chat app — it rides the platform's agent backend; you're designing the
  **conversation UX**, not a model or a tool runner.
- **Privileged actions stay host-mediated.** The agent proposes changes; the actual
  write/diff/contribute is confirmed through the host. Design the *proposal/preview*, and
  assume the final write confirmation may be a host surface (don't fake a host consent).

## Posture & placement — integral, present, never obscuring (iterate here)

The agent is **always present** (front and center, one gesture away) yet **never covers
content** until invoked — the same trick as the iOS Safari URL bar: an always-there sliver
that becomes a full surface only when you reach for it. There are **two states**, and the
resting one is the design problem to crack:

- **Resting — a minimal persistent presence.** Always visible, near-zero footprint, never
  occluding the reading column (approaches 1–3 collapse to a sliver; approach 4 keeps a thin
  always-live band). **Explore and compare at least two of these, recommend one** (combining
  them is fair game):
  1. **Persistent thin input line** pinned to the bottom edge — a single "Ask Grove…" row,
     always visible, that grows upward into the conversation on tap/focus and shrinks back
     (the Safari-URL-bar pattern). *Recommended starting point.*
  2. **Pull tab / handle** at the bottom edge — a small grabber the user drags up to reveal
     the conversation as a bottom sheet; collapsed, only the tab shows.
  3. **Persistent icon / launcher** fixed in a corner — the most minimal footprint; opens
     the conversation, leaving content fully unobscured when closed.
  4. **Permanent thin region — always *slightly* expanded.** Instead of collapsing to a pure
     sliver, the agent owns a small, permanent band of the layout that is *always live* — a
     visible input plus the last turn or a one-line status — which the user grows into the
     full conversation and shrinks back to (but never fully away). The content column simply
     reflows to sit above it; the band never overlays content. This is the most
     "front-and-center" reading of the brief — the agent is *part of the frame*, not an
     overlay on it. Trade-off: it permanently spends a thin slice of vertical space, so it
     must stay genuinely minimal (one row or two) and must not crowd the reading column on
     small screens. **Consider it the boldest option; weigh it against approach 1**, which
     keeps the same always-visible input while giving content the full viewport until invoked.
- **Expanded — the conversation itself.** A surface the **user** sizes and dismisses, never
  one that springs to full-screen unbidden.
  - **Mobile** — a user-controlled **bottom sheet** with peek / half / full detents;
    one-thumb reachable; the keyboard must not cover the input; swipe-down collapses back to
    the resting affordance; **content stays scrollable/visible** above the sheet. This is
    the main authoring path on a phone — it must be excellent, and it must never trap the
    reader behind it.
  - **Desktop** — a persistent **dock/rail** (or a bottom command bar that grows into a
    panel) that coexists with the reading column, resizable, and collapsible back to the
    resting sliver. A first-class column in the authoring experience, not a modal.

**Front and center in editing.** When the user is actively authoring with the agent, the
expanded conversation is the *central* surface of the experience, not a side panel — while
in pure reading it recedes to the resting sliver. Same component, two intensities.

## The conversation surface

- **Launcher / entry point** — "Ask Grove to change this…", contextual to the current entry
  ("…this entry", "…this wiki"). Inviting, not technical (the on-ramp for non-technical
  authors). Grove app-mark present so it reads as Grove's own.
- **Message stream** — user turns and agent turns, clearly distinguished; agent identity is
  **Grove's**, with a subtle "scoped to this wiki" trust cue (not a host badge). Streaming
  output (restrained — typing/append, no bounce). Mono for any code/paths/`#tags` the agent
  echoes.
- **Suggestion chips** — wiki-fluent starting prompts surfaced from the contract: *"Add an
  entry…", "Tag every song with its album", "Fix broken links here", "Reorganize the
  sidebar", "Add a timeline view."* Pill chips (brief 00 idiom).
- **Proposed-change preview** — when the agent proposes edits, show a compact, readable
  **summary of what will change** (files added/edited, entries affected, new tags/components)
  with an inline **diff or before/after**, and **apply / discard** actions. This is the
  trust surface — make the change legible *before* it lands. (Whether the final apply hands
  to a host confirmation is a platform detail; design the preview either way.)
- **Contract awareness, made visible** — when a change introduces a new convention (a new
  tag, a new frontmatter field, a custom component), surface a quiet note that the agent is
  **recording it in `GROVE.md`** ("Noted in this wiki's conventions"). This makes the
  Layer-2 "record the decision" loop visible without drawing a diagnostics panel.
- **Workbench hand-off** — a secondary, unobtrusive "Open in the workbench agent" action for
  power/multi-file work. The embedded agent is the default; the workbench agent is the
  power surface (`grove.md`).

## States (design every one)

- **Resting (collapsed)** — the persistent minimal affordance itself (thin input line / pull
  tab / icon, per your chosen approach): always visible, content fully unobscured. This is
  the default state most of the time — design it as carefully as the expanded one.
- **Idle / first-run (expanded)** — input + suggestion chips + a one-line "what Grove's agent
  can do" explainer.
- **Thinking / streaming** — restrained progress; the input stays available or clearly
  disabled; cancel affordance.
- **Proposing a change** — the preview/diff with apply/discard.
- **Applied** — a concise confirmation ("Added `songs/where-is-my-mind`. Tagged `#song`,
  `#album/surfer-rosa`.") with an undo/he-link to the new entry.
- **Empty / no history** — the first-run state.
- **Error** — model/backend error, a **no-key / no-backend** state (BYO key not set →
  a calm "connect a key to use the agent" that hands to the host secret flow, never a fake
  key prompt), a **forbidden** state (the agent can't do something outside Grove's grants →
  explain, don't retry), and a **read-only** state (a viewer with no write grant → the agent
  is read/explain-only or the launcher is absent; never offer edits that will fail).
- **Offline / unavailable** — degrade to read-only Grove; don't block reading.

## Hard rules for this surface

- **Grove's own, never a host spoof** (`HANDOFF.md` constraint 1). Distinct placement and
  identity; never imitate the host agent pane, sign-in, or consent.
- **Scoped to Grove's grants** — the agent's capabilities are the SDK catalog pre-filtered
  to Grove (security model §8); never present an action the app can't actually perform.
- **Integral but non-obscuring** — the agent is always present (the resting affordance is
  never fully hidden), yet it **never covers content on mobile** until the user expands it,
  and the user can always collapse it back. Front-and-center ≠ in-the-way: reconcile the two
  via the resting-sliver posture, not by hiding the agent.
- **Accessibility** — full keyboard operability, focus management on open/collapse, the
  resting affordance reachable and labelled, announced streaming/results, AA on both themes
  and all alternate themes.

## Deliverable

**2–4 explored approaches** for the resting affordance + expansion (thin input line / pull
tab / icon / permanent thin always-live band), compared, with a recommendation — including
an explicit call on the boldest option (the permanent band, approach 4) vs. the
full-viewport-until-invoked options. The chosen approach drawn at **mobile and
desktop** across **every state above** (resting included), the proposed-change preview/diff,
the contract-recording cue, the workbench hand-off, motion notes (restrained; the
collapse/expand transition is the signature interaction here — keep it smooth, no spring),
and drafted on-brand copy (the resting "Ask Grove…" line, suggestion chips, the
no-key/forbidden/read-only messages, the applied-confirmation strings). All themeable via the
brief-00 token/class contract (`.grove-agent*`).
