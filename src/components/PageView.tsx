/* eslint-disable @typescript-eslint/no-explicit-any */
import { Include, Link } from '@immediately-run/sdk';
import { useShell } from '../lib/shell';
import { keyToHref, keyToRepoRel } from '../lib/content';
import { crumb } from '../lib/wiki';
import { requestEdit } from '@immediately-run/sdk';
import EntryHeader from './EntryHeader';
import Toc from './Toc';
import Backlinks from './Backlinks';
import Icon from './Icon';

declare const module: any;

// `<PageView/>` — the reading view for the current entry: the 404/missing state,
// or the entry header + prose body (+ ToC / backlinks rails). This is what the
// INNERMOST `<Outlet/>` renders at the bottom of the layout chain. It carries no
// site chrome (nav / sidebar / footer) — that's the layout's job — so the page
// stays free of shell concerns.
export default function PageView() {
  const { entryKey, includePath, layout, showRails, mins, missing, suggestion, writable, vw } = useShell();

  if (missing) {
    return (
      <div className="grove-state">
        <div className="grove-state__art" />
        <h2>No entry at <code>{keyToRepoRel(entryKey).replace(/^content/, '')}</code>.</h2>
        <p>
          That link points to an entry that doesn’t exist yet.
          {suggestion ? <> Did you mean <Link className="grove-wikilink" data-state="ok" href={keyToHref(suggestion)}>{crumb(suggestion)}</Link>?</> : null}
        </p>
        <div className="grove-state__actions">
          <Link className="btn-ghost" href="/"><Icon name="chevron-right" /> Back to home</Link>
          {writable ? <button className="btn-primary" onClick={() => requestEdit({ path: keyToRepoRel(entryKey) }).catch(() => undefined)}><Icon name="file-plus" /> Create it</button> : null}
        </div>
      </div>
    );
  }

  return (
    <article className="grove-page" data-layout={layout}>
      <div className="gp-main">
        <EntryHeader entryKey={entryKey} writable={writable} mins={mins} />
        {showRails && vw === 'mobile' ? (
          <details className="grove-toc__disclosure">
            <summary>On this page</summary>
            <Toc entryKey={entryKey} />
          </details>
        ) : null}
        <div className="grove-prose">
          <Include filename={includePath} baseModule={module} />
        </div>
        {showRails ? <Backlinks /> : null}
      </div>
      {showRails && vw === 'desktop' ? <Toc entryKey={entryKey} /> : null}
    </article>
  );
}
