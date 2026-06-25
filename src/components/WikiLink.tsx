/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useContext } from 'react';
import { Link, useMetadataQuery } from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { APP_PREFIX, CONTENT_DIR, isEntryKey, sandboxPathToKey } from '../lib/content';
import { queryPaths } from '../lib/wiki';
import Icon from './Icon';

interface Props {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

// The MDX `a` override. A link into the content space renders as a wiki-link with
// one of three states (brief 00) — resolved / broken / self; everything else
// (http, mailto, #anchor) renders as an ordinary markdown link so the two are
// distinguishable at a glance.
export default function WikiLink({ href = '', children, ...rest }: Props) {
  const ctx = useContext(TinkerableContext) as any;
  const currentKey = sandboxPathToKey(ctx?.navigationState?.sandboxPath || '/');

  // Normalize an in-app content href (`/content/x.mdx` or `/files/content/x.mdx`)
  // to its canonical metadata key; null for external/anchor links.
  const targetKey = (() => {
    if (!href) return null;
    if (/^(https?:|mailto:|tel:|#)/.test(href)) return null;
    const path = href.replace(/^\/files/, '');
    const key = path.startsWith('/content/') ? APP_PREFIX + path : null;
    return key && isEntryKey(key) ? key : null;
  })();

  // Resolve existence against the whole in-memory index (so a missing target is
  // *definitively* broken, not a load-time flash).
  const allKeysQuery = useCallback(
    (fm: Record<string, any>) => Object.keys(fm).filter((p) => p.startsWith(CONTENT_DIR) && /\.mdx?$/.test(p)),
    []
  );
  const q = useMetadataQuery(allKeysQuery);
  const keys: string[] = queryPaths(q);
  const loaded = keys.length > 0;

  if (!targetKey) {
    const external = /^https?:/.test(href);
    return (
      <a
        className="mdlink"
        href={href}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
        {...rest}
      >
        {children}
      </a>
    );
  }

  if (targetKey === currentKey) {
    return (
      <span className="grove-wikilink" data-state="self">
        {children}
      </span>
    );
  }

  const exists = !loaded || keys.includes(targetKey); // optimistic until loaded
  if (!exists) {
    return (
      <span className="grove-wikilink" data-state="broken" title={`No entry at ${href}`}>
        <Icon name="unlink" />
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className="grove-wikilink" data-state="ok" {...rest}>
      {children}
    </Link>
  );
}
