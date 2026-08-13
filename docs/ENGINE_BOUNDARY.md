# The Grove engine boundary — what lives here, what lives in a corpus

**Status:** decision record · **Recorded:** 2026-08-13 · **Item:** R3-262

This repo is the **canonical Grove engine**. This document records why, what belongs in it,
and what deliberately does not — so the fork that exists downstream is a known specialization
rather than drift nobody is tracking. It exists because the drift already happened once: see
§4.

## 1. Canonical home — this repo

`immediately-run/grove` is the engine. The `immediately-run/docs` wiki carries a **fork** of
it at its own repo root, and that fork is a recorded specialization, not a second engine.

The reason is dispatch. `REPO_CONTENT_DISPATCH_SPEC` resolves a content repo's
`opensWith: { task: 'open-wiki' }` marker through the binding registry to **a Grove repo**,
which then renders that repo's content. Self-dispatch is refused — the viewer must be a
*different program* than the content it renders — so the engine has to be a repo of its own.
There is no arrangement where "the docs wiki" is the thing a stranger's content dispatches to.

The reason the fork exists anyway is the kernel: `APP_ROOT` is hard-coded to `/app` (the repo
root) with no subdirectory anchoring (`sandbox/src/fsLayout.ts`), so the bare
`github/immediately-run/docs/main` URL only boots if the engine sits at the *docs* repo root.
That constraint is real and unresolved; it is why the fork is tolerated rather than deleted.

**The follow-through, not yet done:** once a viewer can render content from a mount
(R3-168/R3-169), `docs` becomes an ordinary content corpus dispatched to this engine and the
fork can go. Until then, an engine change lands **here first** and is ported to `docs`.

## 2. What is engine

Anything that renders *any* corpus, and holds no opinion about what the corpus is about:

- the two render paths — compiled MDX via `<Include>`, and the **interpreter** path
  (`SafeEntryBody` → the SDK's `parseSafeMdast`/`renderMdast`), selected by `render: safe` on
  the home entry (wiki-wide) or a single entry;
- routing, path helpers and link classification (`lib/content.ts` — `hrefKeyCandidates`,
  `linkKind`, `splitFragment`), and `<WikiLink>`'s resolution of author-relative hrefs;
- deep-linking (`lib/fragment.ts`, `ScrollToFragment`) and the raw-source read cache
  (`lib/sourceCache.ts`);
- the layout chain (`lib/layout.ts`, `_layout.mdx` + `<Outlet/>`) and the shell primitives;
- the generic content vocabulary registered in `mdxComponents.ts` — `<DocList>`, `<TagCloud>`,
  `<Backlinks>`, `<Timeline>`, `<FamilyTree>`, and friends.

## 3. What is corpus furniture

Components that encode **one corpus's frontmatter conventions**. They live with that corpus,
not here. In the docs wiki that is `RoadmapBoard`, `RoadmapMeta`, `NextAvailable`,
`Dependencies`, `ProjectIndex`/`ProjectItems`/`ProjectMeta`, `TopicIndex`, `StatusBadge`,
`ItemCard`, plus `data/roadmap.ts`, `lib/roadmap.ts`, their `.rm-*` stylesheet block, the
`<Dependencies/>` slot in `PageView`, and `EntryHeader`'s `isItemMeta` → `<RoadmapMeta>` hook.
Every one of them reads `status:` / `project:` / `prs:` / `depends_on:` — fields that mean
something only to an engineering roadmap.

The measured shape of that boundary, taken 2026-08-13: the docs fork's `GroveApp.css` delta is
a **pure append** of 221 `.rm-*` lines, and its `mdxComponents.ts` and `EntryHeader.tsx` deltas
are *entirely* roadmap wiring. Nothing about the engine's own rendering had diverged. That is
what makes the split cheap to state and cheap to keep.

**How furniture is meant to travel, eventually.** R3-174 (frontmatter-discovered content
components, `type: component`, content-wins on a name clash) is the mechanism: a corpus ships
its own components and the viewer registers them, no fork. Note the constraint that follows —
**a content component is author JavaScript, so R3-174 is available only to a corpus rendered
on the compiled path.** The docs wiki qualifies (it left interpreter mode in R3-252). An
**interpreter-mode** wiki cannot have content components at all, and must use the engine's
vocabulary or extend the engine.

## 4. Why this document exists

Between 2026-07-10 and 2026-08-13 every engine change landed only in the `docs` fork, and
nobody noticed. By the time it was measured, this repo had **no interpreter path at all** —
`grep -rn safe src/` returned zero matches — while the specs described Grove as an interpreter
and a planned dispatch feature assumed stock Grove would render foreign content
non-executably. It would have rendered it as *code*.

The engine's tests had drifted the same way, and unevenly: `fragment.ts` and `sourceCache.ts`
arrived with their tests in the same commit, but `lib/content.ts` and `SafeEntryBody.tsx` both
shipped bare and were untested for three weeks, gaining coverage only when a bug forced it. If
you add to this engine, the test goes in the same commit as the source.

## 5. Test posture

`npm run verify` = `lint` + `build` (`tsc -b`, all three TS projects) + `test`.

`src/lib/safeRender.test.ts` drives the **real published** SDK safe renderer — the same bytes
the sandbox resolves on immediately.run — and proves the non-executable property: planted
`{fetch()}` / `<script>` / `import` stay inert, unknown components collapse to their children,
and heading ids exist for citations to land on.

Two of its cases are **fixture-backed here and corpus-backed in `docs`**, deliberately. This
repo's sample corpus writes no `[[…]]` citations and no `#sec-…` deep-links, so a corpus read
would assert nothing — and the sweeps carry non-vacuity guards (`checked > 0`) that correctly
*fail* on an empty sweep rather than passing quietly. The fixtures make the property
deterministic here; the docs wiki keeps the large-corpus sweep, which is what R3-252 says that
harness is for. Do not "fix" a fixture by pointing it back at the corpus, and do not delete a
non-vacuity guard to make a sweep green.

## 6. Authoring a layout under the interpreter (R3-263)

`_layout.mdx` renders through the **safe** renderer whenever the wiki declares `render: safe`
— it used to go through `<Include>` (the compiled path) regardless, which meant an
"interpreter" wiki still executed author JavaScript out of its shell. Four things an author
needs to know, all of which fail *quietly*:

1. **Literal attributes only.** The renderer copies literal attributes and drops expression
   ones, so `<Foo n={3}/>` arrives with no `n`.
2. **Only allow-listed structural tags render as elements.** `src/lib/safeIntrinsics.tsx`
   holds the closed set (`main`, `section`, `div`, …) with an attribute allow-list
   (`className`, `id`, `data-*`, `aria-*`, …). A tag outside it collapses to a Fragment that
   **keeps its children** — content survives, the wrapper and its class do not.
3. **`import` lines are not resolved — and they are not silently dropped either.** The ESM
   extension is off, so no ESM node is produced and the line renders as ordinary paragraph
   **text, printed on the page**. Layouts are import-free by design; the vocabulary arrives
   through the component map.
4. **A block tag must open on its own line.** `<main className="x">text</main>` on one line is
   consumed by micromark as an **HTML block** and renders as literal angle brackets; the same
   tag opened on its own line parses as JSX. The symptom is "my layout is visible as markup"
   with no error anywhere, and the fix is a line break, which nobody guesses.

**Why the allow-list rather than raw tags.** The SDK's `literalProps` does no name filtering
and no URL sanitizing — it copies every literal attribute verbatim onto whatever the map
resolves. Measured against React 19: `onclick=` and `onerror=` are dropped by React, and a
`javascript:` URL is blocked by React — but `style="…"` **throws** ("expects a mapping … not a
string"), `dangerouslySetInnerHTML="…"` **throws**, and `iframe srcdoc="<script>…"` **passes
straight through**. The two throwing cases are worse than they look: the throw is in the
*layout*, so one content file takes down the shell for every page. So the barrier is the
allow-list, and React's own defenses are a second layer rather than the only one.
`src/lib/safeIntrinsics.test.tsx` pins every one of those cases, including the raw-tag
behaviour that motivates the wrapper.
