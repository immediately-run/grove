import { describe, expect, it } from 'vitest';
import { familyTreeQuery, navQuery, searchQuery, sidebarQuery } from './queries';

// The metadata queries select records (R3-276a). These tests pin the selections
// themselves; the components are thin wiring around them. The store shape is the
// real one the hooks hand a query: absolute paths → frontmatter maps.

const fm = {
  '/app/content/index.mdx': { title: 'Home.', nav: 'Start', tags: ['ui/nav'], order: 2 },
  '/app/content/docs.mdx': { title: 'Docs', tags: ['ui/nav'], order: 1 },
  '/app/content/people/ada.mdx': { title: 'Ada Lovelace', team: 'Engineering', tags: ['person'] },
  '/app/content/people/jobs.mdx': { name: 'Steve Jobs', parent: 'Home', tags: ['ui/hidden'] },
  '/app/content/_layout.mdx': { title: 'Not an entry', tags: ['ui/nav'], team: 'X' },
  '/app/src/App.tsx': { title: 'not content', tags: ['ui/nav'] },
};

describe('navQuery', () => {
  it('selects ui/nav entries ordered by `order` (missing = 999), label from nav else title', () => {
    expect(navQuery(fm)).toEqual([
      { path: '/app/content/docs.mdx', label: 'Docs' },
      { path: '/app/content/index.mdx', label: 'Start' },
    ]);
  });

  it('trims a trailing period from a title-derived label', () => {
    expect(navQuery({ '/app/content/a.mdx': { title: 'A.', tags: ['ui/nav'] } })[0].label).toBe('A');
  });

  it('never tab-encodes (the R3-276a regression: fake paths are gone)', () => {
    for (const r of navQuery(fm)) expect(JSON.stringify(r)).not.toContain('\t');
  });
});

describe('searchQuery', () => {
  it('indexes every content entry with title/desc and non-ui tags', () => {
    const rows = searchQuery(fm);
    expect(rows).toHaveLength(4); // entries only: no _layout.mdx, no src/
    const ada = rows.find((r) => r.path.endsWith('ada.mdx'))!;
    expect(ada.title).toBe('Ada Lovelace');
    expect(ada.tags).toEqual(['person']);
  });

  it('drops the ui/* furniture namespace from tags', () => {
    expect(searchQuery(fm).find((r) => r.path.endsWith('jobs.mdx'))!.tags).toEqual([]);
  });
});

describe('sidebarQuery', () => {
  it('indexes every entry with title, raw tags (ui/* kept), and nav', () => {
    const rows = sidebarQuery(fm);
    expect(rows).toHaveLength(4);
    const home = rows.find((r) => r.path.endsWith('index.mdx'))!;
    expect(home.title).toBe('Home.');
    expect(home.nav).toBe('Start');
    expect(home.tags).toEqual(['ui/nav']);
  });
});

describe('familyTreeQuery', () => {
  it('groups by house/team/parent/manager in that fallback order', () => {
    expect(familyTreeQuery(fm)).toEqual([
      { path: '/app/content/people/ada.mdx', label: 'Ada Lovelace', group: 'Engineering' },
      { path: '/app/content/people/jobs.mdx', label: 'Steve Jobs', group: 'Home' },
    ]);
  });

  it('needs both a group and a name/title; layout files are not entries', () => {
    const out = familyTreeQuery({
      '/app/content/x.mdx': { team: 'Engineering' }, // no name/title
      '/app/content/_layout.mdx': { team: 'X', title: 'L' }, // not an entry
    });
    expect(out).toEqual([]);
  });
});
