# Brief 05 — States, the theming showcase, and the app mark

The unglamorous-but-load-bearing surfaces, plus the deliverable that *proves* Grove's
core promise. Assumes [`00-foundation`](./00-foundation.md). Source: `grove.md` "Theming &
layout", "Two ways to use Grove", "How it fits the platform".

## Universal states (design once, reference everywhere)

The per-surface briefs each call their own states; this brief defines the **shared
templates** they reuse so they're consistent:

1. **Loading — skeletons, never spinners.** A skeleton kit matched to Grove's shapes:
   prose lines, entry rows, cards, table rows, ToC ghost, timeline axis, graph nodes. Use
   `--panel`/`--panel-2` blocks with a slow shimmer; budget ~150ms before anything
   appears; **zero layout shift** (skeletons occupy the real box). The link-graph motif
   can stand in for asset/graph placeholders.
2. **Empty — designed, intentional, helpful.** A reusable empty-state block: the
   link-graph motif art, a one-line sentence-case explanation, and (only if writable) one
   action that hands to the host. Per-surface copy lives in those briefs; the *frame* is
   here. "Nothing here" must look composed, never broken.
3. **Error / 404 / broken link.** The wiki-specific case matters: following a broken or
   ambiguous `[[wiki-link]]` lands on "No entry at `/slug`." with the closest-match
   suggestion and a create-if-writable hand-off. Also: a **mount/permission error** (a
   space the app can't read → "This space isn't available." with a calm explanation, never
   a raw `EROFS`/`forbidden`), and a generic load failure. All designed, all on-brand,
   never a stack trace.
4. **Read-only viewer.** The whole app minus every authoring affordance (no edit pencil,
   no new-entry, no ask-the-agent). Design this as a first-class variant — an anonymous
   share-link reader is a real, common viewer (`grove.md` "Authoring", "How it fits the
   platform"). It should feel complete, not "logged out".

## The theming showcase (the proof deliverable)

Grove's promise is **CSS-only re-skinning over stable classes + tokens** (`grove.md`
"Theming & layout"; brief 00 contract). Make it visible:

- **Default Grove theme** — the immediately.run brand (your baseline across all briefs).
- **Three alternate themes**, each a *CSS-only* re-skin of the **same DOM/components**,
  keyed to the real use cases so they double as showcase art:
  - **`pixies`** — a saturated, high-contrast music theme (think gig-poster): bolder
    gradient use, heavier display type, denser grid. Proves "loud" is reachable.
  - **`family-journal`** — soft, warm-leaning-within-tokens, generous whitespace, photo-
    forward `post` layout. Proves "gentle/personal" is reachable.
  - **`lotr`** — a quiet, dense, parchment-ish reference theme: muted palette, serif-ish
    feel achieved within the type system, `doc` layout with prominent ToC + infoboxes.
    Proves "encyclopedic/archival" is reachable.
- **Present them as a triptych of the *same entry*** (e.g. one reference page) rendered
  under each theme, side by side, with a caption that only the CSS changed. This single
  comparison is the most persuasive asset in the whole set — it makes the product's
  central claim legible at a glance.

For each theme, deliver the **token overrides** (the handful of `--bg`/`--ink`/`--accent`/
type-family/radius values that define it) so a dev sees re-skinning is a small CSS diff,
not a rebuild. Keep them honest: only the look + the built-in layout shapes change; a
genuinely new structure is a fork (`grove.md` honesty note), not a theme.

## The Grove app mark (from brief 00, delivered here)

Produce the asset set: the **gradient rounded-tile app icon** with the abstract
node-and-edge glyph; the **tiny inline variant** (rotated gradient square) for cramped
chrome; the **`grove` wordmark** (Gabarito 800 lowercase); and a one-line lockup
(mark + wordmark) for the nav. Light + dark. Unmistakably part of the immediately.run
family, never a competing logo.

## Accessibility pass (every state, both themes)

AA contrast verified on default + all three alternate themes (the alternates are the risk
— check them); state never conveyed by gradient/colour alone (broken links carry an icon +
dotted underline, active sort carries a caret, etc.); skeletons and live regions announced
sanely to assistive tech; full keyboard operability with the glow focus ring; semantic
landmarks/headings intact so agents and screen readers read the same structure.

## Deliverable

The skeleton/empty/error/read-only templates; the four-theme showcase incl. the same-entry
triptych and per-theme token overrides; the app-mark asset set — all mobile + desktop, both
themes, with on-brand drafted copy for the shared empty/error strings.
