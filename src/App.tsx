// The entry point immediately.run renders — deliberately a GATE, not the wiki.
//
// Grove ships in two packagings and they disagree about one thing: where the corpus is.
// A FORK reads `/app/content/` from its own repo. A DISPATCHED viewer is invoked with
// `open-wiki` and reads a host-minted chroot at someone else's directory (R3-169,
// `docs/specs/REPO_CONTENT_DISPATCH_SPEC.mdx`). Every helper the wiki is built from —
// which keys are entries, what their hrefs are, which layouts wrap them — is a function
// of that root, so it has to be settled BEFORE the wiki mounts. A component that rendered
// against the default and corrected itself later would show the VIEWER's corpus first,
// which is the one outcome dispatch may never produce.
//
// Hence the split: this file resolves, `GroveWiki` renders.

import { useOpenWikiBoot } from './hooks/useOpenWikiBoot';
import GroveWiki from './GroveWiki';

export default function App() {
  const boot = useOpenWikiBoot();

  if (boot.status === 'failed') {
    return (
      <div className="grove-boot">
        <p className="grove-boot__msg">{boot.message}</p>
      </div>
    );
  }

  if (boot.status === 'waiting') {
    return (
      <div className="grove-boot">
        <p className="grove-boot__msg">Opening…</p>
      </div>
    );
  }

  return <GroveWiki readOnly={boot.readOnly} />;
}
