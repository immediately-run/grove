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
import { useOpenWikiBoot } from './hooks/useOpenWikiBoot';
import { useCorpusMetadata } from './hooks/useCorpusMetadata';
import { getContentRoot } from './lib/contentRoot';
import { viewedDocumentForTarget } from './lib/content';
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

  if (boot.status === 'failed') {
    return (
      <div className="grove-boot">
        <p className="grove-boot__msg">{boot.message}</p>
      </div>
    );
  }

  if (boot.status === 'waiting' || corpus.status === 'scanning') {
    return (
      <div className="grove-boot">
        <p className="grove-boot__msg">Opening…</p>
      </div>
    );
  }

  if (corpus.status === 'ready' && corpus.metadata) {
    // Provide the scanned corpus as the metadata SOURCE through the supported
    // surface (R3-276), not a wholesale TinkerableContext re-provision: the
    // platform stays free to grow its own state, and the hooks read the nearest
    // MetadataSource — so every consumer works unchanged, and nothing re-states
    // host fields it does not own.
    return (
      <MetadataSource value={corpus.metadata}>
        <GroveWiki readOnly={boot.readOnly} />
      </MetadataSource>
    );
  }

  return <GroveWiki readOnly={boot.readOnly} />;
}
