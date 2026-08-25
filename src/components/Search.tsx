import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useMetadataQuery } from '@immediately-run/sdk';
import type { Metadata } from '@immediately-run/sdk';
import { keyToHref } from '../lib/content';
import { crumb } from '../lib/wiki';
import { searchQuery } from '../lib/queries';
import type { SearchRecord } from '../lib/queries';
import Icon from './Icon';

interface Hit {
  key: string;
  title: string;
  ns: string;
}

// `.grove-search` — the ⌘K command palette: client-side fuzzy filter over the
// in-memory index, grouped into entries + tags, keyboard-navigable.
export default function Search({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Records, not tab-encoded paths (R3-276a): `tags` is the array itself, so the
  // join/split round-trip is gone.
  const q = useMetadataQuery<Metadata, SearchRecord>(searchQuery);
  const rows: SearchRecord[] = Array.isArray(q) ? q : [];

  const rowsKey = rows.map((r) => r.path).join('|');
  const { entries, tags } = useMemo(() => {
    const es = rows.map(({ path, title, desc, tags: entryTags }) => ({
      key: path,
      title: (title || path).replace(/\.$/, ''),
      desc: desc || '',
      tags: entryTags.join(','),
    }));
    const tagSet = new Set<string>();
    es.forEach((e) => e.tags.split(',').filter(Boolean).forEach((t) => tagSet.add(t)));
    return { entries: es, tags: Array.from(tagSet).sort() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey]);

  const ql = query.trim().toLowerCase();
  const matchedEntries: Hit[] = (ql
    ? entries.filter(
        (e) => e.title.toLowerCase().includes(ql) || e.desc.toLowerCase().includes(ql) || e.key.toLowerCase().includes(ql)
      )
    : entries.slice(0, 6)
  ).map((e) => ({ key: e.key, title: e.title, ns: crumb(e.key) }));
  const matchedTags = ql ? tags.filter((t) => t.toLowerCase().includes(ql)) : [];
  const total = matchedEntries.length + matchedTags.length;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, Math.max(0, total - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      (boxRef.current?.querySelector('.grove-search__row[data-sel="1"]') as HTMLElement | null)?.click();
    }
  };

  return (
    <div className="grove-search" onClick={onClose}>
      <div className="grove-search__box" ref={boxRef} onClick={(e) => e.stopPropagation()}>
        <div className="grove-search__in">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search entries and tags…"
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
          />
          <kbd>esc</kbd>
        </div>
        <div className="grove-search__res">
          {total === 0 ? (
            <div className="grove-search__empty">
              No entry matches <code>{query}</code>.
            </div>
          ) : (
            <>
              {matchedEntries.length ? <div className="grove-search__grp">{ql ? 'Entries' : 'Recent'}</div> : null}
              {matchedEntries.map((h, i) => (
                <Link
                  key={h.key}
                  href={keyToHref(h.key)}
                  className="grove-search__row"
                  data-sel={sel === i ? '1' : '0'}
                  onClick={onClose}
                >
                  <Icon name="file" />
                  <span className="t">{h.title}</span>
                  <span className="c">/{h.ns}</span>
                </Link>
              ))}
              {matchedTags.length ? <div className="grove-search__grp">Tags</div> : null}
              {matchedTags.map((t, i) => (
                <div
                  key={t}
                  className="grove-search__row"
                  data-sel={sel === matchedEntries.length + i ? '1' : '0'}
                  onClick={onClose}
                >
                  <Icon name="list" />
                  <span className="t">#{t}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
