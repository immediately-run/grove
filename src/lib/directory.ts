// Directory listings — the pure half (ways_of_working §5).
//
// Grove's route space is a filesystem, so a reader can always ask for a path that names a
// FOLDER rather than an entry: a typed URL, a link into a namespace, the host's file
// explorer, a trailing slash on a citation. Before this module every one of those resolved
// to the 404 ("No entry at …"), which is a lie — the entries are right there, one level
// down. A folder is a legitimate destination and this is what it renders.
//
// Everything here is a pure function over (directory listing, frontmatter index) so the
// ordering, classification, and column-selection rules are testable without a filesystem
// and without React. The effectful half is `hooks/useDirectoryListing`; the rendering half
// is `components/DirectoryList`.

import type { Frontmatter } from './frontmatter';
import { contentDir, isContentEntry, keyToHref } from './content';

/** One `readdir` result — the slice of `Dirent` this module needs. */
export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

/** What a row IS, which decides whether it is a link and how it is iconed.
 *  - `dir`   — a subfolder; navigates to its own listing.
 *  - `entry` — a content entry (`isContentEntry`); navigates to the page.
 *  - `file`  — anything else (an asset, a data file). Listed, never linked: the
 *    viewer's route space only renders entries, so a link would land on a 404. */
export type DirRowKind = 'dir' | 'entry' | 'file';

export interface DirRow {
  /** The on-disk name (`onboarding.mdx`, `people`). */
  name: string;
  /** The canonical key — the absolute fs path, the same identifier the metadata
   *  index and `<Include>` use (see lib/content). */
  key: string;
  kind: DirRowKind;
  /** The `<Link>` target, or null for a row that is not navigable. */
  href: string | null;
  /** The entry's frontmatter, when the index has any. `null` for dirs and assets. */
  meta: Frontmatter | null;
}

/** The metadata columns a listing can carry. `name` is structural and always shown;
 *  the rest are *grove-specific frontmatter* and appear only when the corpus supplies
 *  them — a folder of plain markdown gets a plain table rather than four empty columns. */
export type DirColumn = 'name' | 'description' | 'tags' | 'updated' | 'status';

export const ALL_COLUMNS: readonly DirColumn[] = ['name', 'description', 'tags', 'updated', 'status'];

/** Folders that are machinery, never content — hidden even with `hidden` set, because
 *  they are not part of any corpus and walking into one is never what a reader meant.
 *  Mirrors `corpusScan`'s SKIP_DIRS. */
const NEVER_LIST = new Set(['.git', 'node_modules', '.immediately.run']);

/** `_`-prefixed files are STRUCTURE (`_layout.mdx`), dot-prefixed files are hidden by
 *  filesystem convention. Neither is a reader-facing entry, so both stay out of the
 *  default listing — `isContentEntry` already excludes them from every other Grove
 *  enumeration, and a listing that disagreed would offer a row that renders nothing. */
function isHiddenName(name: string): boolean {
  return name.startsWith('.') || name.startsWith('_');
}

/** Strip Grove's headline-ends-on-a-period house style for use as a table label. */
export function rowLabel(row: DirRow): string {
  const title = typeof row.meta?.title === 'string' ? row.meta.title.trim() : '';
  if (title) return title.replace(/\.$/, '');
  return row.kind === 'entry' ? row.name.replace(/\.mdx?$/, '') : row.name;
}

/** The value a metadata column shows for a row, or `null` when the row has none.
 *  `updated` accepts either spelling — corpora in the wild use `updated:` (the docs
 *  wiki) or `date:` (the sample corpus), and a listing that knew only one would show
 *  an empty column over a corpus that dates every entry. */
export function columnValue(row: DirRow, col: DirColumn): string | string[] | null {
  if (col === 'name') return rowLabel(row);
  const m = row.meta;
  if (!m) return null;
  if (col === 'tags') {
    const tags = Array.isArray(m.tags) ? m.tags.filter((t): t is string => typeof t === 'string') : [];
    // `ui/…` tags are wiring (nav placement), not subject matter — the same filter
    // <DocList> applies, so the two surfaces describe an entry the same way.
    const visible = tags.filter((t) => !t.startsWith('ui/'));
    return visible.length ? visible : null;
  }
  const raw = col === 'updated' ? (m.updated ?? m.date) : m[col];
  // Scalars only. A frontmatter key can hold a map (`owns:`) or a list, and
  // `String()`-ing one into a table cell prints `[object Object]` — worse than an
  // empty cell, because it looks like data.
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    const text = String(raw).trim();
    return text ? text : null;
  }
  return null;
}

/** The columns to render: `name`, plus every requested metadata column that at least
 *  one row actually carries. Adaptive rather than fixed so the table describes the
 *  corpus it is over instead of the corpus its author imagined. */
export function visibleColumns(rows: DirRow[], requested: readonly DirColumn[] = ALL_COLUMNS): DirColumn[] {
  const out: DirColumn[] = ['name'];
  for (const col of requested) {
    if (col === 'name') continue;
    if (rows.some((r) => columnValue(r, col) !== null)) out.push(col);
  }
  return out;
}

/** Parse a `columns="description,tags"` attribute into a validated column list.
 *  Unknown names are dropped rather than thrown: the attribute is author input in
 *  content, and one typo must not take the page down. */
export function parseColumns(spec: string | undefined): readonly DirColumn[] {
  if (!spec) return ALL_COLUMNS;
  const named = spec
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is DirColumn => (ALL_COLUMNS as readonly string[]).includes(s));
  return named.length ? named : ALL_COLUMNS;
}

export interface BuildOptions {
  /** Include dot- and `_`-prefixed names (default false). */
  hidden?: boolean;
  /** `name` (default) sorts on the on-disk name; `title` on the rendered label;
   *  `updated` puts the most recently updated first. Directories always sort first —
   *  they are the navigational skeleton and a reader scans for them. */
  sort?: 'name' | 'title' | 'updated';
}

/**
 * Turn a directory listing plus the frontmatter index into display rows.
 *
 * `dirKey` is the absolute key of the folder (no trailing slash needed); `metadata` is
 * the same `Record<absolutePath, frontmatter>` every other Grove surface reads, so a
 * dispatched corpus (scanned) and a fork (bundler-fed) behave identically here.
 */
export function buildDirectoryRows(
  dirKey: string,
  entries: readonly DirEntry[],
  metadata: Record<string, Frontmatter> = {},
  opts: BuildOptions = {}
): DirRow[] {
  const base = dirKey.replace(/\/+$/, '');
  const rows: DirRow[] = [];
  for (const e of entries) {
    if (NEVER_LIST.has(e.name)) continue;
    if (!opts.hidden && isHiddenName(e.name)) continue;
    const key = `${base}/${e.name}`;
    if (e.isDirectory) {
      rows.push({ name: e.name, key, kind: 'dir', href: keyToHref(key), meta: null });
      continue;
    }
    const entry = isContentEntry(key);
    rows.push({
      name: e.name,
      key,
      kind: entry ? 'entry' : 'file',
      href: entry ? keyToHref(key) : null,
      meta: metadata[key] ?? null,
    });
  }
  return sortRows(rows, opts.sort ?? 'name');
}

// Three tiers, always, whatever the sort key: subfolders, then entries, then assets.
// Interleaving assets with entries by name buries the content — measured on a dispatched
// corpus where `diagram.svg` sorted above every page in the folder purely on its initial.
// Folders lead because they are the navigational skeleton a reader scans for.
const KIND_RANK: Record<DirRowKind, number> = { dir: 0, entry: 1, file: 2 };

function sortRows(rows: DirRow[], sort: NonNullable<BuildOptions['sort']>): DirRow[] {
  const rank = (r: DirRow): number => KIND_RANK[r.kind];
  return rows.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (sort === 'title') return rowLabel(a).localeCompare(rowLabel(b));
    if (sort === 'updated') {
      const av = String(columnValue(a, 'updated') ?? '');
      const bv = String(columnValue(b, 'updated') ?? '');
      if (av !== bv) return bv.localeCompare(av); // newest first; undated sinks
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * The folder a listing is FOR, given a `path` attribute and the route's own directory.
 *
 * A leading `/` means corpus-relative (`/handbook`); anything else resolves against
 * `fromDir`, exactly the rule `hrefKeyCandidates` applies to author-written links — an
 * author writes paths relative to the entry they are in. Traversal is resolved, then the
 * result is confined to the corpus: a `path` is author (or reader) input, and under
 * dispatch it is foreign, so `../../..` must not become a readdir of somebody's mount.
 * Out-of-corpus resolves to the corpus root rather than erroring — the same
 * fail-to-home posture `sandboxPathToKey` takes.
 */
export function resolveDirKey(path: string | undefined, fromDir: string): string {
  const root = contentDir().replace(/\/+$/, '');
  const from = fromDir.replace(/\/+$/, '') || root;
  const raw = !path ? from : path.startsWith('/') ? `${root}${path}` : `${from}/${path}`;
  const out: string[] = [];
  for (const seg of raw.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  const abs = `/${out.join('/')}`;
  return abs === root || abs.startsWith(`${root}/`) ? abs : root;
}

/** The breadcrumb segments of a directory key, corpus-root first. */
export function dirCrumbs(dirKey: string): Array<{ label: string; key: string }> {
  const root = contentDir().replace(/\/+$/, '');
  const rel = dirKey.replace(/\/+$/, '').slice(root.length).replace(/^\//, '');
  const out: Array<{ label: string; key: string }> = [];
  let acc = root;
  for (const seg of rel.split('/').filter(Boolean)) {
    acc = `${acc}/${seg}`;
    out.push({ label: seg, key: acc });
  }
  return out;
}

/**
 * The entry a folder URL should render INSTEAD of a generated listing — the folder-index
 * convention. This is the corpus's own override: an author who wants `handbook/` to be a
 * curated page writes `handbook/index.mdx` and gets it, with no engine change and no
 * component registration. Absent one, the listing is the answer.
 */
const INDEX_NAMES = ['index.mdx', 'index.md'];

export function folderIndexKey(dirKey: string, keys: readonly string[]): string | null {
  const base = dirKey.replace(/\/+$/, '');
  for (const name of INDEX_NAMES) {
    const candidate = `${base}/${name}`;
    if (keys.includes(candidate)) return candidate;
  }
  return null;
}

/** A directory key → the corpus-relative `path` attribute that names it
 *  (`/app/content/handbook` → `/handbook`; the corpus root → `/`). The inverse of
 *  {@link resolveDirKey}'s leading-slash form, so the router can hand a folder to the
 *  overridable `<DirectoryList/>` through its PUBLIC prop rather than a private one. */
export function dirKeyToPath(dirKey: string): string {
  const root = contentDir().replace(/\/+$/, '');
  const rel = dirKey.replace(/\/+$/, '').slice(root.length);
  return rel || '/';
}

/**
 * Does this key name a FOLDER that contains entries, judged from the frontmatter index
 * alone?
 *
 * Index-only on purpose: this answers a question asked once per link in a rendered body,
 * and a `readdir` per link would turn a page of prose into a burst of host RPCs. The
 * blind spot is a folder holding nothing but assets — which no author links to as a
 * destination, and which the ROUTE still resolves correctly because that path does ask
 * the filesystem.
 */
export function isFolderKey(key: string, keys: readonly string[]): boolean {
  const prefix = `${key.replace(/\/+$/, '')}/`;
  return keys.some((k) => k.startsWith(prefix));
}
