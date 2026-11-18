// @vitest-environment jsdom
// R3-1350 review round 3 (3-r3-0): every reader that renders a frontmatter field takes
// the TYPED value the YAML parser hands over. A `date:` written as a map (or a list)
// reached `{meta.date}` raw and React threw "Objects are not valid as a React child",
// taking the page down; these renders go through the real parser and the real query
// functions, with only the SDK's two metadata hooks and `Link` stubbed.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { parseFrontmatter } from '../lib/frontmatter';
import { resetContentRoot } from '../lib/contentRoot';

const { FM } = vi.hoisted(() => ({ FM: {} as Record<string, Record<string, unknown>> }));
vi.mock('@immediately-run/sdk', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  Link: ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) =>
    createElement('a', { href, className }, children),
  useFileMetadata: (key: string) => FM[key] ?? null,
  // The SDK turns a query's returned keys into records; the query function itself is Grove's.
  useMetadataQuery: (fn: (fm: Record<string, unknown>) => unknown[]) =>
    fn(FM).map((p) => (typeof p === 'string' ? { path: p } : p)),
}));

const { default: PageMeta } = await import('./PageMeta');
const { default: EntryHeader } = await import('./EntryHeader');
const { default: DocList } = await import('./DocList');
const { default: Timeline } = await import('./Timeline');
const { default: Directory } = await import('./Directory');
const { EntryContext } = await import('../hooks/useEntryKey');

// Every field a reader shows, written as something other than a string.
const PAGE = [
  '---',
  'title: 1984',
  'date: {year: 2026, month: 11}',
  'name: {first: Ada}',
  'role: 7',
  'team: [platform]',
  'phone: 5551234',
  'email: {at: example}',
  'tags: [2026, notes]',
  '---',
  'Body.',
].join('\n');

let KEY = '';
beforeEach(() => {
  resetContentRoot();
  const { data, error } = parseFrontmatter(PAGE);
  expect(error).toBeUndefined();
  // The parser's own reading is the premise: these really are a map, a number, a list.
  expect(data.date).toEqual({ year: 2026, month: 11 });
  expect(data.role).toBe(7);
  for (const k of Object.keys(FM)) delete FM[k];
  KEY = '/app/content/typed.mdx';
  FM[KEY] = data as Record<string, unknown>;
});

const inEntry = (el: ReactNode) => renderToStaticMarkup(createElement(EntryContext.Provider, { value: { entryKey: KEY } }, el));

describe('typed frontmatter values render, never throw (3-r3-0)', () => {
  it('PageMeta: a map-valued date shows nothing; the tags still show', () => {
    const html = inEntry(createElement(PageMeta));
    expect(html).toContain('#2026');
    expect(html).not.toContain('[object Object]');
  });

  it('EntryHeader: a numeric title shows; a map-valued date shows nothing', () => {
    const affordance = { openEditor: () => {}, busy: false, refused: false, hint: null };
    const html = inEntry(createElement(EntryHeader, { entryKey: KEY, writable: false, mins: 1, affordance } as never));
    expect(html).toContain('1984');
    expect(html).not.toContain('[object Object]');
  });

  it('DocList (sorted by date) and Timeline list the entry', () => {
    expect(inEntry(createElement(DocList))).toContain('1984');
    expect(inEntry(createElement(Timeline))).toContain('1984');
  });

  it('Directory: a numeric role and phone show as text; map and list fields show nothing', () => {
    const html = inEntry(createElement(Directory));
    expect(html).toContain('<td>7</td>');
    expect(html).toContain('5551234');
    expect(html).not.toContain('[object Object]');
  });
});
