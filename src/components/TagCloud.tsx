/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import { useMetadataQuery } from '@immediately-run/sdk';
import { CONTENT_DIR } from '../lib/content';

// Import-free engine component: every tag across the site, sized by frequency.
// Chrome tags (`ui/*`) are excluded — they drive layout, not classification.
export default function TagCloud() {
  const queryFn = useCallback((filesMetadata: Record<string, any>) => {
    const counts: Record<string, number> = {};
    Object.entries(filesMetadata).forEach(([p, m]) => {
      if (!p.startsWith(CONTENT_DIR)) return;
      if (m && Array.isArray(m.tags)) {
        m.tags.forEach((t: string) => {
          if (t.startsWith('ui/')) return;
          counts[t] = (counts[t] || 0) + 1;
        });
      }
    });
    // Encode counts into the string[] the query contract returns.
    return Object.keys(counts)
      .sort()
      .map((t) => `${t}:${counts[t]}`);
  }, []);

  const result = useMetadataQuery(queryFn);
  const entries: string[] = result && 'result' in result ? (result as any).result : [];

  return (
    <div className="grove-tagcloud">
      {entries.map((e) => {
        const [tag, count] = e.split(':');
        return (
          <span
            key={tag}
            className="grove-tag"
            style={{ fontSize: 11 + Number(count) * 2 + 'px', padding: '4px 12px' }}
          >
            #{tag} <span style={{ opacity: 0.5, marginLeft: 4 }}>{count}</span>
          </span>
        );
      })}
    </div>
  );
}
