/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { useMetadataQuery } from '@immediately-run/sdk';
import { CONTENT_DIR } from '../lib/content';
import { queryPaths } from '../lib/wiki';

// `<TagList/>` — every content tag, sorted, as plain chips (the "related tags"
// strip on a tag page). Reserved `ui/*` chrome tags are excluded.
export default function TagList() {
  const queryFn = useCallback((fm: Record<string, any>) => {
    const set = new Set<string>();
    Object.entries(fm).forEach(([p, m]: [string, any]) => {
      if (!p.startsWith(CONTENT_DIR)) return;
      (Array.isArray(m?.tags) ? m.tags : []).forEach((t: string) => {
        if (!t.startsWith('ui/')) set.add(t);
      });
    });
    return Array.from(set).sort();
  }, []);
  const q = useMetadataQuery(queryFn);
  const tags: string[] = queryPaths(q);

  if (!tags.length) return null;
  return (
    <div className="grove-tagcloud">
      {tags.map((t) => (
        <span key={t} className="grove-tag">#{t}</span>
      ))}
    </div>
  );
}
