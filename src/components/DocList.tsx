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

function tagsOf(meta: any): string[] {
  return Array.isArray(meta?.tags) ? meta.tags.filter((t: string) => !t.startsWith('ui/')) : [];
}

// One entry as a feed row — reads its own frontmatter so the hook count is stable.
function Row({ path }: { path: string }) {
  const meta = useFileMetadata(path) as any;
  if (!meta) return <div className="gdl-row"><div className="sk sk-line" style={{ width: '50%' }} /></div>;
  return (
    <Link href={keyToHref(path)} className="gdl-row">
      <div>
        <div className="gdl-row__t">{(meta.title || path).replace(/\.$/, '')}</div>
        {meta.description && <div className="gdl-row__d">{meta.description}</div>}
        <div className="gdl-row__tags">
          {tagsOf(meta).slice(0, 3).map((t) => (
            <span key={t} className="grove-tag">#{t}</span>
          ))}
        </div>
      </div>
      <div className="gdl-row__meta">{meta.date}</div>
    </Link>
  );
}

// One entry as a grid card — link-graph placeholder pic + a footer of meta.
function CardTile({ path }: { path: string }) {
  const meta = useFileMetadata(path) as any;
  if (!meta) return <div className="gdl-card"><div className="gdl-card__pic" /></div>;
  return (
    <Link href={keyToHref(path)} className="gdl-card">
      <div className="gdl-card__pic" />
      <div className="gdl-card__foot">
        <div className="gdl-card__t">{(meta.title || path).replace(/\.$/, '')}</div>
        {meta.description && <div className="gdl-card__d">{meta.description}</div>}
        <div className="gdl-card__tags">
          {tagsOf(meta).slice(0, 3).map((t) => (
            <span key={t} className="grove-tag">#{t}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

// Import-free engine component: a frontmatter-driven index of entries, in a feed
// or grid shape. `slugs` pins an explicit ordered set; otherwise it queries the
// whole content space (optionally filtered by `tag`), excluding view/index pages.
export default function DocList({ shape = 'feed', title, slugs, tag, limit, sort = 'date' }: Props) {
  const queryFn = useCallback(
    (fm: Record<string, any>) => {
      const keys = Object.keys(fm).filter((p) => {
        if (!p.startsWith(CONTENT_DIR) || !/\.mdx?$/.test(p)) return false;
        const m = fm[p] || {};
        if (m.view) return false;
        if (tag && !(Array.isArray(m.tags) && m.tags.includes(tag))) return false;
        return true;
      });
      keys.sort((a, b) => {
        if (sort === 'title') return (fm[a].title || a) < (fm[b].title || b) ? -1 : 1;
        return String(fm[b].date || '').localeCompare(String(fm[a].date || ''));
      });
      return keys;
    },
    [tag, sort]
  );
  const queried = useMetadataQuery(queryFn);
  const loaded = !!queried && 'result' in queried;

  let paths = slugs
    ? slugs.split(',').map((s) => slugToKey(s.trim())).filter(Boolean)
    : loaded ? (queried as any).result : [];
  const n = limit ? Number(limit) : undefined;
  if (n && paths.length > n) paths = paths.slice(0, n);

  return (
    <div className="grove-doclist-wrap">
      {title ? (
        <div className="grove-doclist__head">
          <h2>{title}</h2>
          <span className="n">{paths.length} {paths.length === 1 ? 'entry' : 'entries'}</span>
        </div>
      ) : null}
      {!slugs && loaded && paths.length === 0 ? (
        <p className="grove-search__empty">No entries yet.</p>
      ) : (
        <div className="grove-doclist" data-shape={shape}>
          {paths.map((p: string) =>
            shape === 'grid' ? <CardTile key={p} path={p} /> : <Row key={p} path={p} />
          )}
        </div>
      )}
    </div>
  );
}
