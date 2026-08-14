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

import { use } from 'react';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { useOpenWikiBoot } from './hooks/useOpenWikiBoot';
import { useCorpusMetadata } from './hooks/useCorpusMetadata';
import { getContentRoot } from './lib/contentRoot';
import GroveWiki from './GroveWiki';

export default function App() {
  const host = use(TinkerableContext);
  const boot = useOpenWikiBoot();
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
    // Swap the SOURCE of the index, not the index: the SDK's metadata hooks read
    // `filesMetadata` off this context, so re-providing it with the scanned corpus makes
    // every consumer work unchanged. Everything else in the host's state — navigation,
    // routing, the outer href — passes through untouched.
    return (
      <TinkerableContext.Provider value={{ ...host, filesMetadata: corpus.metadata }}>
        <GroveWiki readOnly={boot.readOnly} />
      </TinkerableContext.Provider>
    );
  }

  return <GroveWiki readOnly={boot.readOnly} />;
}
