/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { Link, useFileMetadata, useMetadataQuery } from '@immediately-run/sdk';
import { CONTENT_DIR, keyToHref, slugToKey } from '../lib/content';

interface Props {
  shape?: 'feed' | 'grid';
  title?: string | null;
  slugs?: string;
  tag?: string;
  limit?: string | number;
  sort?: 'date' | 'title';
}

function asPaths(q: any): string[] {
  if (!q) return [];
  if (Array.isArray(q)) return q;
  if (q.result && Array.isArray(q.result)) return q.result;
  return [];
}

// A single entry card — reads its own frontmatter so the hook count is stable.
function Card({ path }: { path: string }) {
  const meta = useFileMetadata(path) as any;
  if (!meta) return null;
  const href = keyToHref(path);
  const tags: string[] = Array.isArray(meta.tags) ? meta.tags.filter((t: string) => !t.startsWith('ui/')) : [];
  return (
    <Link href={href} className="gdl-row">
      <div>
        <div className="gdl-row__t">{meta.title || path}</div>
        {meta.description && <div className="gdl-row__d">{meta.description}</div>}
        <div className="gdl-row__tags">
          {tags.slice(0, 3).map((t) => (
            <span key={t} className="grove-tag">#{t}</span>
          ))}
        </div>
      </div>
      <div className="gdl-row__meta">{meta.date}</div>
    </Link>
  );
}

// Import-free engine component: a frontmatter-driven index of entries.
export default function DocList({ shape = 'feed', title, slugs, tag }: Props) {
  const queryFn = useCallback(
    (filesMetadata: Record<string, any>) =>
      Object.keys(filesMetadata).filter((p) => {
        if (!p.startsWith(CONTENT_DIR) || !p.endsWith('.mdx')) return false;
        const m = filesMetadata[p] || {};
        if (m.view) return false;
        if (tag && !(Array.isArray(m.tags) && m.tags.includes(tag))) return false;
        return true;
      }),
    [tag]
  );
  const queried = useMetadataQuery(queryFn);

  const paths = slugs
    ? slugs.split(',').map((s) => slugToKey(s.trim())).filter(Boolean)
    : asPaths(queried).sort();

  return (
    <div className="grove-doclist-wrap">
      {title ? (
        <div className="grove-doclist__head">
          <h2>{title}</h2>
          <span className="n">{paths.length} entries</span>
        </div>
      ) : null}
      <div className="grove-doclist" data-shape={shape}>
        {paths.map((p) => (
          <Card key={p} path={p} />
        ))}
      </div>
    </div>
  );
}
