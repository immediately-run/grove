import { describe, it, expect, afterEach } from 'vitest';
import {
  ALL_COLUMNS,
  buildDirectoryRows,
  columnValue,
  dirCrumbs,
  dirKeyToPath,
  folderIndexKey,
  isFolderKey,
  parseColumns,
  resolveDirKey,
  rowLabel,
  visibleColumns,
  type DirEntry,
  type DirRow,
} from './directory';
import { resetContentRoot, setContentRoot } from './contentRoot';
import type { Frontmatter } from './frontmatter';

afterEach(() => resetContentRoot());

const dir = (name: string): DirEntry => ({ name, isDirectory: true });
const file = (name: string): DirEntry => ({ name, isDirectory: false });

const ROOT = '/app/content';

describe('buildDirectoryRows', () => {
  it('classifies subfolders, entries and assets — and links only the navigable ones', () => {
    const rows = buildDirectoryRows(`${ROOT}/reports`, [
      file('q2-2026.mdx'),
      file('revenue.svg'),
      dir('archive'),
    ]);
    expect(rows.map((r) => [r.name, r.kind, r.href])).toEqual([
      ['archive', 'dir', '/content/reports/archive'],
      ['q2-2026.mdx', 'entry', '/content/reports/q2-2026.mdx'],
      // An asset is listed but NOT linked: the route space renders entries, so a link
      // would land on the very 404 this feature exists to replace.
      ['revenue.svg', 'file', null],
    ]);
  });

  it('hides dot- and underscore-prefixed names by default, and shows them on request', () => {
    const entries = [file('_layout.mdx'), file('.keep'), file('a.mdx')];
    expect(buildDirectoryRows(ROOT, entries).map((r) => r.name)).toEqual(['a.mdx']);
    // Asserted as a set: the relative order of `.`- and `_`-prefixed names is
    // `localeCompare`'s business and varies by locale, which is not what this pins.
    expect(new Set(buildDirectoryRows(ROOT, entries, {}, { hidden: true }).map((r) => r.name))).toEqual(
      new Set(['.keep', '_layout.mdx', 'a.mdx'])
    );
  });

  it('never lists repo machinery, even with hidden set', () => {
    const rows = buildDirectoryRows(ROOT, [dir('node_modules'), dir('.git'), dir('teams')], {}, { hidden: true });
    expect(rows.map((r) => r.name)).toEqual(['teams']);
  });

  it('attaches frontmatter from the index, keyed by the absolute path', () => {
    const meta: Record<string, Frontmatter> = {
      [`${ROOT}/handbook/onboarding.mdx`]: { title: 'Onboarding, day one.', description: 'First week.' },
    };
    const rows = buildDirectoryRows(`${ROOT}/handbook`, [file('onboarding.mdx'), file('expenses.mdx')], meta);
    expect(rowLabel(rows[1])).toBe('Onboarding, day one'); // trailing period is house style
    expect(rowLabel(rows[0])).toBe('expenses'); // no frontmatter → the bare filename
    expect(rows[0].meta).toBeNull();
  });

  it('sorts directories first, then by the chosen key', () => {
    const meta: Record<string, Frontmatter> = {
      [`${ROOT}/a.mdx`]: { title: 'Zulu.', updated: '2026-01-01' },
      [`${ROOT}/b.mdx`]: { title: 'Alpha.', updated: '2026-06-01' },
    };
    const entries = [file('b.mdx'), file('a.mdx'), dir('sub')];
    expect(buildDirectoryRows(ROOT, entries, meta, { sort: 'name' }).map((r) => r.name)).toEqual([
      'sub',
      'a.mdx',
      'b.mdx',
    ]);
    expect(buildDirectoryRows(ROOT, entries, meta, { sort: 'title' }).map((r) => r.name)).toEqual([
      'sub',
      'b.mdx',
      'a.mdx',
    ]);
    expect(buildDirectoryRows(ROOT, entries, meta, { sort: 'updated' }).map((r) => r.name)).toEqual([
      'sub',
      'b.mdx',
      'a.mdx',
    ]);
  });

  it('builds corpus-relative hrefs under dispatch, where the mount root IS the corpus root', () => {
    setContentRoot('/mnt/abc123/');
    const rows = buildDirectoryRows('/mnt/abc123/context', [file('threat_model.mdx')]);
    // Corpus-relative — the mount root IS the corpus root under dispatch, so the
    // subfolder stays in the href and `/app` never appears.
    expect(rows[0].href).toBe('/context/threat_model.mdx');
  });
});

describe('columnValue / visibleColumns', () => {
  const row = (meta: Frontmatter | null): DirRow => ({
    name: 'x.mdx',
    key: `${ROOT}/x.mdx`,
    kind: 'entry',
    href: '/content/x.mdx',
    meta,
  });

  it('reads `updated` under either spelling — corpora in the wild use both', () => {
    expect(columnValue(row({ updated: '2026-08-18' }), 'updated')).toBe('2026-08-18');
    expect(columnValue(row({ date: '2026-06-22' }), 'updated')).toBe('2026-06-22');
    expect(columnValue(row({}), 'updated')).toBeNull();
  });

  it('drops `ui/…` wiring tags, exactly as <DocList> does', () => {
    expect(columnValue(row({ tags: ['handbook', 'ui/nav'] }), 'tags')).toEqual(['handbook']);
    expect(columnValue(row({ tags: ['ui/nav'] }), 'tags')).toBeNull();
  });

  it('refuses to print a non-scalar into a cell', () => {
    // `owns:` is a map; String()-ing it renders "[object Object]", which looks like data.
    expect(columnValue(row({ description: { concepts: ['a'] } }), 'description')).toBeNull();
  });

  it('shows only the metadata columns the corpus actually supplies', () => {
    const bare = [row({}), row(null)];
    expect(visibleColumns(bare)).toEqual(['name']);
    const rich = [row({ description: 'd' }), row({ tags: ['t'], status: 'draft' })];
    expect(visibleColumns(rich)).toEqual(['name', 'description', 'tags', 'status']);
  });

  it('narrows to a requested subset, but still never pads', () => {
    const rows = [row({ description: 'd', tags: ['t'] })];
    expect(visibleColumns(rows, parseColumns('tags'))).toEqual(['name', 'tags']);
    expect(visibleColumns(rows, parseColumns('status'))).toEqual(['name']);
  });

  it('ignores unknown column names rather than throwing on author input', () => {
    expect(parseColumns('description,nonsense')).toEqual(['description']);
    expect(parseColumns('nonsense')).toEqual(ALL_COLUMNS);
    expect(parseColumns(undefined)).toEqual(ALL_COLUMNS);
  });
});

describe('resolveDirKey', () => {
  it('treats a leading slash as corpus-relative and everything else as entry-relative', () => {
    expect(resolveDirKey('/handbook', `${ROOT}/reports`)).toBe(`${ROOT}/handbook`);
    expect(resolveDirKey('archive', `${ROOT}/reports`)).toBe(`${ROOT}/reports/archive`);
    expect(resolveDirKey(undefined, `${ROOT}/reports`)).toBe(`${ROOT}/reports`);
  });

  it('confines traversal to the corpus — a `path` is untrusted input', () => {
    // Under dispatch the corpus is foreign content and the address bar is user-typed,
    // so `..` must not become a readdir of somebody else's mount.
    expect(resolveDirKey('../../..', `${ROOT}/reports`)).toBe(ROOT);
    expect(resolveDirKey('/../../app/src', ROOT)).toBe(ROOT);
    expect(resolveDirKey('a/../b', ROOT)).toBe(`${ROOT}/b`);
  });

  it('round-trips through dirKeyToPath', () => {
    expect(dirKeyToPath(`${ROOT}/handbook`)).toBe('/handbook');
    expect(dirKeyToPath(ROOT)).toBe('/');
    expect(resolveDirKey(dirKeyToPath(`${ROOT}/a/b`), ROOT)).toBe(`${ROOT}/a/b`);
  });
});

describe('dirCrumbs', () => {
  it('names every ancestor between the corpus root and the folder', () => {
    expect(dirCrumbs(`${ROOT}/plans/ui-as-apps`)).toEqual([
      { label: 'plans', key: `${ROOT}/plans` },
      { label: 'ui-as-apps', key: `${ROOT}/plans/ui-as-apps` },
    ]);
    expect(dirCrumbs(ROOT)).toEqual([]);
  });
});

describe('folderIndexKey', () => {
  it("prefers the author's curated folder index over a generated listing", () => {
    const keys = [`${ROOT}/roadmap/index.mdx`, `${ROOT}/roadmap/R3-1.mdx`];
    expect(folderIndexKey(`${ROOT}/roadmap`, keys)).toBe(`${ROOT}/roadmap/index.mdx`);
    expect(folderIndexKey(`${ROOT}/roadmap/`, keys)).toBe(`${ROOT}/roadmap/index.mdx`);
  });

  it('returns null when there is none, so the listing is the answer', () => {
    expect(folderIndexKey(`${ROOT}/people`, [`${ROOT}/people/ada.mdx`])).toBeNull();
  });
});

describe('isFolderKey', () => {
  const keys = [`${ROOT}/handbook/onboarding.mdx`, `${ROOT}/about.mdx`];

  it('recognises a folder from the entry index alone — no fs call per link', () => {
    expect(isFolderKey(`${ROOT}/handbook`, keys)).toBe(true);
    expect(isFolderKey(`${ROOT}/handbook/`, keys)).toBe(true);
  });

  it('is false for an entry, for a non-existent path, and for a prefix that is not a segment', () => {
    expect(isFolderKey(`${ROOT}/about.mdx`, keys)).toBe(false);
    expect(isFolderKey(`${ROOT}/nope`, keys)).toBe(false);
    // `handbo` is a string prefix of `handbook/…` but not a path segment of it.
    expect(isFolderKey(`${ROOT}/handbo`, keys)).toBe(false);
  });
});
