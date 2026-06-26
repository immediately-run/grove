/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useContext } from 'react';
import { Link, useMetadataQuery } from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { CONTENT_DIR, keyToHref, sandboxPathToKey } from '../lib/content';
import { namespaceOf, queryPaths } from '../lib/wiki';

// `<ChildPages/>` — the entries that live under the current entry's namespace, as
// a compact nested list (e.g. everything in `handbook/` from the handbook index).
export default function ChildPages() {
  const ctx = useContext(TinkerableContext) as any;
  const currentKey = sandboxPathToKey(ctx?.navigationState?.sandboxPath || '/');
  const rel = currentKey.replace(CONTENT_DIR, '').replace(/\.mdx?$/, '');
  // The folder this entry indexes: its own slug if it's a section index, else its namespace.
  const scope = rel.replace(/\/?(index|home)$/, '');

  const queryFn = useCallback(
    (fm: Record<string, any>) =>
      Object.keys(fm)
        .filter((p) => {
          if (!p.startsWith(CONTENT_DIR) || !/\.mdx?$/.test(p) || p === currentKey) return false;
          return namespaceOf(p) === scope;
        })
        .sort(),
    [currentKey, scope]
  );
  const q = useMetadataQuery(queryFn);
  const paths: string[] = queryPaths(q);

  if (!paths.length) return null;
  return (
    <div className="grove-doclist" data-shape="feed">
      {paths.map((p) => (
        <Link key={p} href={keyToHref(p)} className="gdl-row">
          <div className="gdl-row__t">{p.replace(CONTENT_DIR, '').replace(/\.mdx?$/, '').split('/').pop()}</div>
        </Link>
      ))}
    </div>
  );
}
