/* eslint-disable @typescript-eslint/no-explicit-any */
import { useFileMetadata } from '@immediately-run/sdk';
import { useShell } from '../lib/shell';
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
  const { openEditor, editBusy, editHint } = useShell();
  const meta = useFileMetadata(entryKey) as any;
  if (!meta) return null;
  const tags: string[] = Array.isArray(meta.tags) ? meta.tags.filter((t: string) => !t.startsWith('ui/')) : [];
  const cr = crumb(entryKey);
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
          <button
            className="grove-edit-affordance"
            data-busy={editBusy ? '1' : '0'}
            title={editHint}
            onClick={() => openEditor(entryKey)}
          >
            <Icon name="pencil" />
            {editBusy ? 'Opening editor…' : 'Edit'}
          </button>
        )}
      </div>
    </header>
  );
}
