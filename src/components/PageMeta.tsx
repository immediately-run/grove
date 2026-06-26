/* eslint-disable @typescript-eslint/no-explicit-any */
import { useContext } from 'react';
import { useFileMetadata } from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { sandboxPathToKey } from '../lib/content';

// `<PageMeta/>` — the current entry's date + tags as a styled strip, for authors
// who want the meta inside the body (the entry header already renders one).
export default function PageMeta() {
  const ctx = useContext(TinkerableContext) as any;
  const key = sandboxPathToKey(ctx?.navigationState?.sandboxPath || '/');
  const meta = useFileMetadata(key) as any;
  if (!meta) return null;
  const tags: string[] = Array.isArray(meta.tags) ? meta.tags.filter((t: string) => !t.startsWith('ui/')) : [];
  return (
    <div className="grove-meta">
      {meta.date && <span>{meta.date}</span>}
      {tags.length ? <span className="dot">·</span> : null}
      {tags.map((t) => (
        <span key={t} className="grove-tag">#{t}</span>
      ))}
    </div>
  );
}
