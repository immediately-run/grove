/* eslint-disable @typescript-eslint/no-explicit-any */
// The wiki's metadata queries, as pure functions (R3-276a).
//
// These were inline callbacks in GroveWiki/Search/FamilyTree that had to
// TAB-ENCODE extra fields into fake paths (`[p, label].join('\t')`) because
// `useMetadataQuery` could only return path strings. The SDK now returns
// RECORDS (`{ path, ...extra }`, R3-276) and these are the same selections said
// directly — extracted here so the selection logic is testable without React
// and the three consumers share one definition of "entry", "label", "group".
//
// Every record field is derived data; `path`/`meta` are applied by the hook.

import { isContentEntry } from './content';
import { plainProse } from '@immediately-run/mdx-plugins';

/** A nav item derived from `ui/nav` frontmatter. */
export type NavRecord = {
  path: string;
  /** `nav` if the entry names itself, else its title with the trailing period trimmed. */
  label: string;
};

/** Entries tagged `ui/nav`, ordered by `order` (missing = 999). */
export function navQuery(fm: Record<string, any>): NavRecord[] {
  return Object.keys(fm)
    .filter((p) => isContentEntry(p) && Array.isArray(fm[p]?.tags) && fm[p].tags.includes('ui/nav'))
    .sort((a, b) => (fm[a].order ?? 999) - (fm[b].order ?? 999))
    .map((p) => ({ path: p, label: plainLabel(fm[p]?.nav || fm[p]?.title || '') }));
}

/** A field bound for an attribute, a label, a prompt or an index — the plain
 *  form (R3-531): markers dropped, content kept, then the period trimmed. */
export function plainLabel(s: string): string {
  return plainProse(s).replace(/\.$/, '');
}

/** One searchable entry: the RAW title (the palette renders it as inline prose)
 *  beside the plain form the matcher reads. */
export type SearchEntry = {
  key: string;
  title: string;
  plain: string;
  desc: string;
};

/** The ⌘K index over search records — pure, so the plain/raw split is testable. */
export function toSearchEntries(rows: { path: string; title: string; desc: string }[]): SearchEntry[] {
  return rows.map(({ path, title, desc }) => ({
    key: path,
    title: title || path,
    plain: plainLabel(title || path),
    desc: plainProse(desc || ''),
  }));
}

/** Match an entry against a lowercased query on its PLAIN forms — matching the
 *  raw markdown would miss queries typed over what the reader actually sees. */
export function matchesQuery(e: SearchEntry, ql: string): boolean {
  return e.plain.toLowerCase().includes(ql) || e.desc.toLowerCase().includes(ql) || e.key.toLowerCase().includes(ql);
}

/** One search index row. `tags` excludes the `ui/*` furniture namespace. */
export type SearchRecord = {
  path: string;
  title: string;
  desc: string;
  tags: string[];
};

/** Every content entry, flattened for the ⌘K palette. */
export function searchQuery(fm: Record<string, any>): SearchRecord[] {
  return Object.keys(fm)
    .filter(isContentEntry)
    .map((p) => ({
      path: p,
      title: fm[p]?.title || '',
      desc: fm[p]?.description || '',
      tags: (fm[p]?.tags || []).filter((t: string) => !t.startsWith('ui/')),
    }));
}

/** One sidebar row: the whole entry index with the fields the tree + the
 *  `ui/sidebar` sections derive from. */
export type SidebarRecord = {
  path: string;
  title: string;
  tags: string[];
  nav: string;
};

/** Every content entry, for the sidebar tree + its `ui/sidebar` sections. */
export function sidebarQuery(fm: Record<string, any>): SidebarRecord[] {
  return Object.keys(fm)
    .filter(isContentEntry)
    .map((p) => ({ path: p, title: fm[p]?.title || '', tags: fm[p]?.tags || [], nav: fm[p]?.nav || '' }));
}

/** A node in the relational view: grouped by house/team/parent/manager. */
export type FamilyNodeRecord = {
  path: string;
  label: string;
  group: string;
};

/** Entries with a relationship field and something to call them. */
export function familyTreeQuery(fm: Record<string, any>): FamilyNodeRecord[] {
  const out: FamilyNodeRecord[] = [];
  Object.entries(fm).forEach(([p, m]: [string, any]) => {
    if (!isContentEntry(p)) return;
    const group = m?.house || m?.team || m?.parent || m?.manager;
    if (group && (m?.name || m?.title)) {
      out.push({ path: p, label: (m.name || m.title).replace(/\.$/, ''), group: String(group) });
    }
  });
  return out;
}
