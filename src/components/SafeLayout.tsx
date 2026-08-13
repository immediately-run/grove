import { Suspense, use } from 'react';
import { SafeContent, RenderExportedComponentContext } from '@immediately-run/sdk';
import { SAFE_MDX } from '../mdxComponents';
import { keyToRepoRel } from '../lib/content';
import { safeSources } from '../lib/safeSources';

// A `_layout.mdx` rendered NON-EXECUTABLY — the layout-chain counterpart to
// `SafeEntryBody`. (R3-263)
//
// WHY THIS EXISTS. `App.tsx` `renderLayers` used to render every layer through `<Include>`
// — the compiled path — *regardless* of `render: safe`. So an "interpreter" wiki still
// executed author JavaScript out of one content file, and the non-executable guarantee had
// a hole precisely where nobody would look for it: not in the entries, in the shell around
// them. Worse, `<Include>` evaluates an APP-SOURCE module, so a layout resident in a
// content MOUNT could not render through it at all — which would have made the layout chain
// inoperable under dispatch, not merely unsafe.
//
// The authored surface is unchanged. `renderMdast` resolves a JSX tag by NAME against the
// component map, and the layout vocabulary (`<GroveNav/>`, `<GroveSidebar/>`, `<Outlet/>`,
// `<GroveFooter/>`) is already in it. `<Outlet/>` reads React context, and context flows
// through this subtree normally, so the nested chain still nests.
//
// THREE THINGS AN AUTHOR MUST KNOW (they fail quietly, not loudly):
//   1. Literal attributes only. `SafeContentComponents` types props as
//      `Record<string,string>`; an expression prop (`<Foo n={3}/>`) is dropped.
//   2. An unregistered tag collapses to a Fragment that KEEPS its children — so a stray
//      wrapper loses its element and its class but never its content. The structural tags
//      worth keeping are registered as sanitizing wrappers (`lib/safeIntrinsics.tsx`).
//   3. `import` lines are never resolved — and note what actually happens, because it is
//      not "the ESM node renders as null": the ESM extension is OFF, so no such node is
//      produced and the line survives as ordinary paragraph TEXT, printed on the page.
//      Layouts must be import-free — which they already are, the vocabulary being
//      import-free by design.
//
// And one parser gotcha worth more than it looks: a lowercase tag with inline content on
// the SAME line (`<main class="x">text</main>`) is consumed by micromark as an HTML block
// and renders as literal text, while the same tag opened on its own line parses as JSX.
// Layouts are authored in the second shape; `safeRender.test.ts` pins both.

function LayoutBody({ layoutKey }: { layoutKey: string }) {
  const raw = use(safeSources.read(keyToRepoRel(layoutKey)));
  // Frontmatter on a layout is metadata for the engine (`layoutRole`, `frame`), never
  // something to render — the same strip the entry path performs.
  const body = raw.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '');
  return (
    <RenderExportedComponentContext
      value={{ evaluationContext: { evaluation: { module: { filepath: layoutKey } } } } as never}
    >
      <SafeContent source={body} components={SAFE_MDX as never} />
    </RenderExportedComponentContext>
  );
}

/** Interpreter-mode layout layer: the raw `_layout.mdx` rendered as data (no author JS runs). */
export default function SafeLayout({ layoutKey }: { layoutKey: string }) {
  // No fallback markup: a layout that is still loading should render NOTHING rather than a
  // skeleton shell, or the page paints chrome-then-content and shifts (LOADING_UX §3).
  return (
    <Suspense fallback={null}>
      <LayoutBody layoutKey={layoutKey} />
    </Suspense>
  );
}
