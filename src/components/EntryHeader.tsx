/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { requestEdit, useFileMetadata } from '@immediately-run/sdk';
import { keyToRepoRel } from '../lib/content';
import { crumb } from '../lib/wiki';
import Icon from './Icon';

// The entry's header block: breadcrumb, title (optional gradient), meta row
// (date · reading time · tags) and the unobtrusive edit affordance. Rendered by
// <PageView> at the top of every entry.
export default function EntryHeader({
  entryKey,
  writable,
  mins,
}: {
  entryKey: string;
  writable: boolean;
  mins: number;
}) {
  const meta = useFileMetadata(entryKey) as any;
  const [busy, setBusy] = useState(false);
  if (!meta) return null;
  const tags: string[] = Array.isArray(meta.tags) ? meta.tags.filter((t: string) => !t.startsWith('ui/')) : [];
  const cr = crumb(entryKey);
  const edit = () => {
    setBusy(true);
    requestEdit({ path: keyToRepoRel(entryKey) })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  return (
    <header className="grove-entry-header">
      {cr.includes('/') ? <nav className="crumb">{cr}</nav> : null}
      <h1 className={meta.grad ? 'grad' : ''}>{meta.title || cr}</h1>
      <div className="grove-meta">
        {meta.date && <span>{meta.date}</span>}
        {mins ? <span>→ {mins} min read</span> : null}
        {tags.length ? <span className="dot">·</span> : null}
        {tags.map((t) => (
          <span key={t} className="grove-tag">#{t}</span>
        ))}
        {writable && (
          <button className="grove-edit-affordance" data-busy={busy ? '1' : '0'} onClick={edit}>
            <Icon name="pencil" />
            {busy ? 'Opening editor…' : 'Edit'}
          </button>
        )}
      </div>
    </header>
  );
}
