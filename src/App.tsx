// The entry point immediately.run renders — deliberately a GATE, not the wiki.
//
// Grove ships in two packagings and they disagree about two things: where the corpus is,
// and who knows what is in it.
//
//   • FORK      — `/app/content/`, indexed by the bundler at build time. Both answers
//                 arrive before the app boots, so the gate falls straight through.
//   • DISPATCH  — a host-minted chroot at someone else's directory (R3-169), which the
//                 bundler never scanned, so the frontmatter index has to be BUILT
//                 (R3-265). Neither answer exists at first render.
//
// Every helper the wiki is made of — which keys are entries, what their hrefs are, which
// layouts wrap them — is a function of the root; every surface a reader sees — nav,
// sidebar, search, backlinks, routing, the 404 index — is a function of the index. A
// component that rendered before either was settled would show the VIEWER's corpus, or an
// empty one, and then not correct itself. Both are outcomes dispatch may never produce.
//
// Hence the split: this file resolves, `GroveWiki` renders.

import { use, useEffect, useRef } from 'react';
import * as sdk from '@immediately-run/sdk';
import { sendMessage } from '@immediately-run/sdk/sandboxUtils';
import { MetadataSource } from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { MDXProvider } from '@immediately-run/sdk/MDXProvider';
import { useOpenWikiBoot } from './hooks/useOpenWikiBoot';
import { useCorpusMetadata } from './hooks/useCorpusMetadata';
import { useContentComponents } from './hooks/useContentComponents';
import { getContentRoot } from './lib/contentRoot';
import { viewedDocumentForTarget } from './lib/content';
import ThemeAssets from './components/ThemeAssets';
import { DEFAULT_THEME_ASSETS } from './data/themeFonts';
import GroveWiki from './GroveWiki';

// R3-268 — the viewed-document rule, registered ONCE at module load: every
// `navigate()`/`<Link>` navigation declares which file the destination renders,
// so the host's file explorer can highlight it. The mapping is
// `viewedDocumentForTarget` (lib/content): repo-relative for a fork,
// CORPUS-relative under dispatch — the host joins its chroot prefix, since the
// corpus's repo-side location is host knowledge this app cannot see. Resolved
// PER NAVIGATION, not captured: the content root is a function of dispatch
// state (see `contentRoot`). Guarded with `?.` so Grove still runs against an
// SDK generation without the hook (the host then falls back to the URL
// convention, which under dispatch simply yields no highlight). Highlight-only
// by contract — this never scrolls, never moves focus, never opens the editor.
(sdk as { setViewedDocumentResolver?: (r: (href: string) => string | null | undefined) => void })
  .setViewedDocumentResolver?.(viewedDocumentForTarget);

export default function App() {
  const host = use(TinkerableContext);
  const boot = useOpenWikiBoot();
  // R3-268 deep links: declare the INITIALLY rendered document once at boot. A
  // fresh page load performs no navigation, so without this the host records no
  // viewed document for a deep link and the explorer shows no highlight (nor
  // ancestor dot) until the first in-app click. Carries no gesture: the host
  // records it userInitiated=false — highlight-only, never a reveal. Waits for
  // the boot resolution because the content root (and so the mapping) is a
  // function of dispatch state. Fire-and-forget: no transport (plain `vite dev`)
  // must not crash the wiki.
  const declaredBootRef = useRef(false);
  const outerHref = host?.outerHref;
  useEffect(() => {
    if (declaredBootRef.current) return;
    if (boot.status !== 'ready' && boot.status !== 'fork') return;
    if (!outerHref) return;
    declaredBootRef.current = true;
    try {
      sendMessage('viewed-document-declare', { value: viewedDocumentForTarget(outerHref) });
    } catch {
      /* no host transport — a standalone dev server render */
    }
  }, [boot.status, outerHref]);
  // Only a dispatched viewer scans; a fork's index is already in the context.
  const corpus = useCorpusMetadata(boot.status === 'ready' ? getContentRoot() : null);
  // BOTH packagings, deliberately (R3-174). A corpus's own component vocabulary must not
  // depend on how it was composed — `PLATFORM_LAYERING_SPEC` §1.1's mode-invariance rule —
  // so a fork reads its marker too; that is one cheap open of a file already in `/app`.
  // Gated on the boot status for the same reason the scan is: before the delegation
  // resolves, `getContentRoot()` is still the fork default, and reading THAT marker under
  // dispatch would register the viewer's own sample-corpus components against someone
  // else's content.
  const contentComponents = useContentComponents(
    boot.status === 'ready' || boot.status === 'fork' ? getContentRoot() : null,
  );

  if (boot.status === 'failed') {
    return (
      <div className="grove-boot">
        <p className="grove-boot__msg">{boot.message}</p>
      </div>
    );
  }

  // The provider must be COMPLETE before content paints (MDX_FROM_MOUNT_SPEC §2's
  // invariant): rendering into a half-composed map would flash a missing-component error
  // for `<RoadmapBoard>` until registration landed — the very error content components
  // exist to remove — and a nested provider patched in afterwards would do the same.
  // Holding here costs nothing, because the gate already exists for the corpus scan.
  if (boot.status === 'waiting' || corpus.status === 'scanning' || contentComponents.status === 'loading') {
    return (
      <div className="grove-boot">
        <p className="grove-boot__msg">Opening…</p>
      </div>
    );
  }

  // Corpus-declared components (R3-174) go on as a nested provider, which the SDK's
  // `useMDXComponents` resolves as `{...stock, ...content}` — so CONTENT WINS a name
  // clash, and a wiki may override even `<DocsByTag>` with its own (value 4, max
  // hackability). §2's "single-map merge, never provider nesting" was written against
  // patching a provider in AFTER a partial render; nesting it INSIDE the gate above is
  // that same merge, composed before anything paints.
  const wiki = <GroveWiki readOnly={boot.readOnly} rejectedComponents={contentComponents.rejected} />;
  const withComponents =
    contentComponents.status === 'ready' && Object.keys(contentComponents.components).length > 0 ? (
      <MDXProvider components={contentComponents.components}>{wiki}</MDXProvider>
    ) : (
      wiki
    );

  // R3-315 — the engine's declared assets (the default face set) mint to blob:
  // URLs at boot and emit their @font-face rules in the engine cascade layer.
  // Mounts OUTSIDE the corpus gate deliberately: faces are engine state, not a
  // function of the scanned index, and a slow scan must not delay them.
  const withAssets = (
    <>
      <ThemeAssets declarations={DEFAULT_THEME_ASSETS} />
      {withComponents}
    </>
  );

  if (corpus.status === 'ready' && corpus.metadata) {
    // Provide the scanned corpus as the metadata SOURCE through the supported
    // surface (R3-276), not a wholesale TinkerableContext re-provision: the
    // platform stays free to grow its own state, and the hooks read the nearest
    // MetadataSource — so every consumer works unchanged, and nothing re-states
    // host fields it does not own.
    return (
      <MetadataSource value={corpus.metadata}>{withAssets}</MetadataSource>
    );
  }

  return withAssets;
}
