/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { Link, useFileMetadata, useMetadataQuery } from '@immediately-run/sdk';
import { CONTENT_DIR, keyToHref } from '../lib/content';

// One dated entry on the axis: mono date · node · card.
function Row({ path }: { path: string }) {
  const m = useFileMetadata(path) as any;
  if (!m) return null;
  const tags: string[] = Array.isArray(m.tags) ? m.tags.filter((t: string) => !t.startsWith('ui/')) : [];
  return (
    <Link href={keyToHref(path)} className="gtl-row">
      <div className="gtl-date">{m.date}</div>
      <div className="gtl-node" />
      <div className="gtl-card">
        <div className="gtl-title">{(m.title || path).replace(/\.$/, '')}</div>
        {m.description && <div className="gtl-desc">{m.description}</div>}
        {tags.length ? (
          <div className="gtl-tags">
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="grove-tag">#{t}</span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

// `<Timeline/>` — an agent-added view: every entry with a `date`, laid on a time
// axis newest-first, with a restrained per-row reveal (CSS `gtlin`).
export default function Timeline() {
  const queryFn = useCallback(
    (fm: Record<string, any>) =>
      Object.keys(fm)
        .filter((p) => p.startsWith(CONTENT_DIR) && /\.mdx?$/.test(p) && fm[p]?.date && !fm[p]?.view)
        .sort((a, b) => String(fm[b].date).localeCompare(String(fm[a].date))),
    []
  );
  const q = useMetadataQuery(queryFn);
  const loaded = !!q && 'result' in q;
  const paths: string[] = loaded ? (q as any).result : [];

  if (loaded && !paths.length) {
    return <p className="grove-search__empty">No dated entries yet.</p>;
  }
  return (
    <div className="grove-timeline">
      {paths.map((p) => (
        <Row key={p} path={p} />
      ))}
    </div>
  );
}
