# Grove — interactive content, capability isolation, and the mini-app model

**Status:** product definition (proposal) · **Updated:** 2026-06-26
**Author:** drafted for peter@peterneumark.com
**Companion to:** [`grove.md`](./grove.md) — read that first. This document expands one
claim made there (Grove treats interactive content as a first-class citizen) into its
trust model and its execution architecture. It is not yet a spec; when Grove is specced,
this becomes `GROVE_INTERACTIVE_CONTENT_SPEC.md`.

> **Reads first** (immediately-run docs repo): `docs/specs/UI_AS_APPS_SPEC.md` §3 (slots/
> regions), §8 (capabilities), `docs/context/core_concepts.md` §1/§4/§5/§7/§8 (principals,
> capabilities, spaces, content-trust), `docs/specs/EDITOR_FIRST_EDITING_SPEC.md` §6 (the
> "proposed delta" pattern this document reuses).

---

## Why this document exists

Grove's substrate is MDX — Markdown that mixes prose with JSX — so an entry can be more
than text: it can be an **interactive thing**. A unit-converter, a clickable report with
baked-in data, a small tool, a Claude-artifact-style mini-UI. Unlike Obsidian or Notion,
where interactivity is bolted on, Grove can treat **content-that-is-code and
content-that-is-text as the same kind of citizen**: they live side by side, link to each
other, are surfaced by the same indexes, and are described by the same agent contract.

That promise is only safe if we are precise about what runs, with whose authority, and in
front of whom. This document is that precision. Its single thesis:

> **The thing that decides how content runs is *what capability it needs*, never *who is
> looking at it*.** Capability-free content runs inline, live, and identically for every
> viewer. Capability-using content runs as a separate, host-brokered mini-app that the
> viewer explicitly starts. There is no third behaviour, and no per-viewer rendering fork.

This is a deliberate correction of an earlier, worse idea — that a "trusted" contributor
would see a richer rendering than an "untrusted" reader. That breaks publishing: content
that looks great to its author and degraded to its audience is not a wiki you would
publish. We reject it.

---

## The content type: an artifact entry

Alongside the **prose entry** (`grove.md` content model), Grove recognises the **artifact
entry** — an entry whose body is, or contains, an interactive component. It is not a new
file format or a new storage shape; it is still one `.mdx` file with frontmatter. What
makes it first-class is that it is **wiki-embedded**, and that is exactly its edge over a
standalone immediately.run app:

- It is **linkable** and **backlinkable** (`[[wiki-links]]`, `<Backlinks />`).
- It is **taggable** and surfaced by indexes (`<DocsByTag />`, tag-driven UI).
- It is **described by the agent contract** (Layer 1 manifest records the component, its
  source, props, and docstring; `GROVE.md` records its intent).
- It can be **imported** and reused by other entries the ordinary MDX way.

The boundary that keeps Grove from dissolving into "the platform with a wiki shell": Grove
owns the **linked, namespaced, frontmatter-indexed, agent-legible substrate**; an artifact
is first-class *content within that substrate*, not a standalone app that happens to be
linked. A bare app is not better in Grove for being embedded in an iframe — it is better
for being a *node in the wiki graph*.

---

## The axis: capability requirement, not viewer trust

Every piece of content sits in exactly one of two execution classes.

### 1. Capability-free content → inline, live, identical for everyone

Prose, engine components (`<Backlinks />`, `<DocsByTag />`, `<Toc />`), author-defined
presentational components (an `<Infobox>`, a `<PopularEntries>`), and interactive
artifacts that need **no elevated capability** — a Celsius/Fahrenheit converter, a
calculator, a clickable chart over baked-in data — all render **inline in Grove's own
tree, live, and the same way for an anonymous visitor, a logged-in non-contributor, and a
contributor.** There is no run gate, because there is nothing to gate.

A direct consequence, and a requirement `grove.md` states: **a Grove-supplied component
and a user-authored or forked one are indistinguishable** when both are capability-free.
`<Backlinks />` and a forked `<MyCustomBacklinks />` are the same kind of thing — engine
code has no privilege a content author's capability-free code lacks. For a large fraction
of useful artifacts, this is the whole story: no permission, no isolation, no preview.

### 2. Capability-using content → a host-brokered mini-app, started explicitly

Content that needs an elevated capability — `llm:chat` (an AI feature), `net:fetch`
(arbitrary network), a writable mount, a cross-app task like "post to Bluesky" — does
**not** run inline. It runs as a **separate immediately.run app** (the *mini-app*), with
its own appKey, sourced from a filesystem Grove exposes, and it is **displayed as a preview
until the viewer explicitly starts it** — at which point the **host** (not Grove) brokers
its capability requests through the **platform's own consent UI**. Same flow for every
viewer; a contributor is not auto-trusted into skipping it.

This split maps the four user types `grove.md` enumerates onto **one mechanism**, not four:

| Viewer | Capability-free content | Capability-using content |
|---|---|---|
| Single-user (own notebook) | inline, live | mini-app; they grant their own caps |
| Trusted collaborator | inline, live | mini-app; platform consent |
| Logged-in non-contributor (e.g. has `llm:chat`) | inline, live | mini-app; **their** key, **their** consent — never the author's |
| Anonymous (no login, no key) | inline, live | mini-app preview; can start only caps that need no grant |

The viewer's experience of *the same content* never forks. What differs is only what each
viewer *can grant* — which is a property of the viewer's own session, decided in host UI,
exactly as it would be for any app.

---

## The load-bearing invariant: Grove holds no ambient elevated authority

Here is why it is safe to run a content author's capability-free code **inline**, with
Grove's own authority, even for a logged-in viewer carrying an `llm:chat` key.

On immediately.run, **anything Grove runs inline in its own tree runs with Grove's appKey
authority** — there is no inline way to give author MDX *less* authority than Grove itself.
So a "this component is capability-free" *declaration* cannot be trusted for inline code; a
dishonest converter could try to call whatever Grove can call. The rescue is not to trust
the declaration. It is to ensure there is **nothing worth calling**:

> **Grove keeps its own render realm free of standing elevated capabilities. Every elevated
> capability lives only inside a transient, separately-keyed mini-app that requested it.**

Grove's *standing* authority is just "read the content mount and render it." The content is
the wiki itself — public (or already shared with this viewer). So inline author code, honest
or not, inherits an authority that contains **nothing it could steal**: it can read public
content (which the viewer already has) and manipulate the page DOM. It cannot reach a
viewer's `llm:chat` key, because **Grove does not hold one ambiently** — that key, when used,
lives inside a mini-app the viewer started, in a principal Grove cannot reach.

**Honest residual.** Inline code can still call the browser `fetch` and phone home — the
baseline risk of any `<script>` on any web page. For a public wiki this leaks nothing the
page didn't already expose. It is bounded further by any platform network policy, and named
here rather than hidden. (`net:fetch` *as a declared capability* — the artifact wanting the
wiki to grant it network — is class 2 and goes through a mini-app; the residual is only the
ambient browser primitive.)

### The unification: Grove's own agent is a mini-app too

The invariant applies to Grove's *own* embedded agent, which needs `llm:chat`. Therefore the
agent **cannot be ambient in Grove's render tree** either: it runs through the *same*
mini-app path — its own appKey, `llm:chat` requested via platform consent, isolated from the
inline realm. "Embedded" means *mounted as a Grove-branded, Grove-prompted child surface via
the platform primitive*, not *ambient in Grove's JavaScript*. One mechanism serves the agent
and third-party artifacts alike, and it is exactly what `CLAUDE.md` security-model §8 ("don't
hand-roll tools around the SDK") and `grove.md`'s "embedded agent is composition, not
reinvention" already ask for.

---

## The viewer experience for a mini-app: preview, then run

Because mounting a mini-app is what triggers its capability requests, "preview-until-run"
falls out for free — Grove simply does not mount the child app until the viewer asks:

1. **Resting (preview).** In the prose flow, where the artifact sits, Grove renders a
   **preview card**: the surrounding prose (it carries the meaning), an optional
   author-supplied poster (`artifactPreview: ./shot.png`), and a **capability disclosure**
   derived from the entry's declared `uses:` — *"Running this will use: AI chat (your key) ·
   network."* The viewer sees the cost before paying it. The rest of the wiki — navigation,
   search, indexes, backlinks, prose, images — is fully live regardless; only the artifact's
   *execution* waits.
2. **Run.** A single per-entry gesture mounts the mini-app. The **host** brokers the
   capability requests through the platform consent UI. Reads consented at run; **outbound
   or irreversible actions** (an fs write, a Bluesky post) get an in-the-moment confirm at
   the call — the same "visible consent gesture" rule used in the trusted-collaborator case,
   and the honest answer to "a standing grant can be silently abused."
3. **Scope.** Consent is **per-entry, per-session** — running one artifact never blesses the
   wiki. At most a "run the rest of this page" gesture for an artifact-dense page, still
   session-scoped, never persistent by default.

Why poster-not-snapshot: Grove cannot auto-screenshot a mini-app for its preview, because
snapshotting *is* running it. The poster is opt-in; the default card is plain prose +
disclosure. Acceptable.

---

## The architecture: a host-owned sibling, composited into a Grove-nominated region

The dangerous-but-tempting implementation is to make the mini-app a **DOM child of Grove**
— Grove creates an `<iframe>` in its own document and points it at the mini-app. **We refuse
this.** If Grove owns the iframe, Grove controls its `src` and `sandbox`, can reach into it,
and sits *in the mini-app's trusted computing base* — so the host can no longer independently
broker the mini-app's capabilities, and an elevated capability (the mini-app's `llm:chat`) is
back inside Grove's reach. That is the "Grove hand-rolls a sandbox around the SDK" we reject.

The resolution separates **visual nesting** from **structural/security nesting**:

> The mini-app is a **direct child of the host window — a sibling of Grove's iframe** —
> host-owned, host-keyed, host-brokered, like every app today. The host **composites** that
> sibling surface over a **rectangle Grove nominates within its own region**, and keeps it
> pinned as Grove scrolls and reflows. Structurally flat; visually inline.

What this means for the platform invariants:

- **Preserved:** "every app iframe is a direct child of the host" — the mini-app *is* a
  direct child of the host, merely painted over a sub-rectangle of Grove.
- **Preserved (the one that matters):** "the host owns and brokers every app principal; no
  app is in another app's TCB." The mini-app is never in Grove's TCB.
- **Relaxed (the only change):** the weak default that an app's surface occupies *its own*
  full region rather than being composited over another app's region.

**All coordination is host-mediated; Grove never touches the mini-app.** Per the security
rules (no reaching sibling iframes, no app-to-parent postMessage), Grove speaks only to the
host via the SDK: *"run this child, its source is this filesystem I expose, place it at this
rect, here are theme tokens, here are its serializable inputs."* Grove and the mini-app never
talk directly. If the artifact needs wiki context (the entry's frontmatter, a text
selection), it arrives as **declared, host-passed inputs at spawn** — the cross-app
`invokes`/`provides` contract — not by reading Grove's memory.

### Two platform deltas (not one), with a fallback

This splits "can a stage app embed a child app inline?" into two separable primitives,
written here as proposed platform deltas in the `EDITOR_FIRST_EDITING_SPEC` §6 idiom:

1. **Spawn-and-broker** (load-bearing). An app asks the host to run another app from a
   **filesystem the parent exposes**, where the child gets its **own appKey** and the **host**
   brokers the child's capability requests through platform consent. This is the
   authority-isolation primitive — and the one Grove's own agent also needs.
2. **Region composition** (inline vs. modal). The host places the child's surface in a
   **scroll-tracked rectangle the parent nominates within its region**, rather than a fixed
   chrome slot or a centred modal overlay.

Delta 1 can ship before delta 2: the mini-app opens in a **docked region or modal overlay**
until scroll-tracked inline placement lands. So the v1 honesty note: **lead on delta 1; if
the host offers only fixed regions / modal overlays today, mini-apps mount there in v1, and
inline-composited placement is the proposed delta** — improving automatically when it lands,
exactly as Grove's editor path improves when Editor Delta B lands.

### Engineering hazards to carry into the spec

Cross-surface compositing is where this gets hard; name these rather than discover them:

- **Scroll / position sync.** Pinning a host-owned sibling to a position *inside* a scrolling
  child app is the classic overlay-tracking problem; done per-frame it jitters. The rect wants
  to be expressed relative to Grove's scroll container, not re-reported each frame.
- **Z-order / occlusion.** A host-owned iframe normally paints above everything, so Grove UI
  that should sit *over* the mini-app (a dropdown, Grove's own modal, the agent panel) needs
  the host to honour occlusion across the boundary — the "iframe is always on top" problem.
- **Visual continuity.** The mini-app is a separate app, so Grove's CSS does not cascade in;
  Grove must pass design tokens across so a running mini-app still looks like the wiki.
- **AppKey identity.** Fresh-per-run (re-consent every time; safest for untrusted viewers) vs.
  stable-per-artifact (consent persists; more convenient, but a once-consented malicious
  artifact keeps the grant). Lean session-scoped; let the platform own the policy.

---

## What stays in scope, what is honestly deferred

- **In scope, v1:** capability-free interactive content inline and identical for all viewers;
  the artifact-entry concept; the preview/disclosure card; the no-ambient-authority invariant;
  mini-apps via delta 1 with a docked/modal fallback; the agent as a mini-app.
- **Deferred (proposed deltas):** scroll-tracked inline composition (delta 2); platform
  network policy that tightens the ambient-`fetch` residual.
- **Non-goal:** Grove inventing its own sandbox, its own consent UI, or a server-driven-UI
  ("JSX-as-JSON") protocol to render untrusted output in its own tree. We reuse the platform's
  app sandbox and consent; a bespoke protocol reinvents a UI framework, kills full
  interactivity, and adds round-trip latency for no security gain over a host-owned sibling.

---

## Open questions (for the spec that follows this)

1. **Delta 1 surface.** The exact SDK shape for "run a child app from a parent-exposed
   filesystem, host-brokered" — and whether the platform already has any of it.
2. **Delta 2 composition.** Coordinate space, scroll-tracking contract, and occlusion model
   for a parent-nominated, scroll-tracked region.
3. **Capability declaration.** How an entry declares `uses:` (frontmatter field shape), how
   the preview disclosure is rendered from it, and the fact that the declaration drives the
   *consent UI* while the host broker drives *enforcement* (undeclared use fails closed).
4. **Class detection.** How Grove decides an entry is capability-using (so it routes to a
   mini-app) — static hint from `uses:` for UX, with the real boundary enforced by the
   host broker, never by Grove's own static analysis.
5. **AppKey identity / consent persistence** — session-scoped vs. stable-per-artifact.
6. **Ambient-`fetch` residual** — whether/when a platform network policy bounds it, and what
   Grove communicates about it.
7. **Inputs contract** — the declared, serializable inputs Grove passes a mini-app at spawn
   (frontmatter, selection, page context) via `invokes`/`provides`.
