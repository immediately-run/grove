// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import { MDXProvider } from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { resetContentRoot, setContentRoot } from '../lib/contentRoot';
import { GroveShellContext, type GroveShell } from '../lib/shell';

// `useDirectoryListing` reads the real `fs` module — the one the host supplies inside the
// sandbox. Mocked here so the table is exercised over a known tree, and mocked at the
// MODULE level (not injected through a prop) because the injection point is not part of
// the component's contract: content writes `<DirectoryList path="…"/>` and nothing else.
const readdir = vi.fn();
vi.mock('fs', () => ({ default: { promises: { readdir: (...a: unknown[]) => readdir(...a) } } }));

const { default: DirectoryList } = await import('./DirectoryList');
const { default: DirectoryView } = await import('./DirectoryView');

/** The slice of the shell <DirectoryView> reads, cast in. */
const shell = (entryKey: string): GroveShell =>
  ({ entryKey, siteTitle: 'Meridian handbook' }) as GroveShell;

const dirent = (name: string, isDirectory = false) => ({ name, isDirectory: () => isDirectory });

const METADATA = {
  '/app/content/handbook/onboarding.mdx': {
    title: 'Onboarding, day one.',
    description: 'What every new hire does in their first week.',
    tags: ['handbook', 'ui/nav'],
    date: '2026-06-22',
  },
  '/app/content/handbook/expenses.mdx': { title: 'Expenses.' },
};

function host(children: ReactNode, sandboxPath = '/files/content/handbook/onboarding.mdx') {
  const value = {
    outerHref: 'https://immediately.run/present/github/o/r/main/files/content/handbook/onboarding.mdx',
    navigationState: { mode: 'present', namespace: 'github', provider: 'github', repository: 'o/r', ref: 'main', sandboxPath, hash: '', search: '' },
    routingSpec: { routes: [] },
    filesMetadata: METADATA,
  };
  return <TinkerableContext.Provider value={value as never}>{children}</TinkerableContext.Provider>;
}

async function render(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(node);
  });
  return container;
}

beforeEach(() => {
  readdir.mockReset();
  readdir.mockResolvedValue([
    dirent('archive', true),
    dirent('onboarding.mdx'),
    dirent('expenses.mdx'),
    dirent('policy.pdf'),
    dirent('_layout.mdx'),
  ]);
});
afterEach(() => {
  resetContentRoot();
  document.body.innerHTML = '';
});

describe('<DirectoryList/>', () => {
  it('lists the folder of the current entry when given no path', async () => {
    const el = await render(host(<DirectoryList />));
    expect(readdir).toHaveBeenCalledWith('/app/content/handbook', { withFileTypes: true });
    const names = [...el.querySelectorAll('.gdir__labels')].map((n) => n.textContent);
    // Directory first; the structural `_layout.mdx` is not a reader-facing row.
    expect(names).toEqual([
      'archive',
      'Expensesexpenses.mdx',
      'Onboarding, day oneonboarding.mdx',
      'policy.pdf',
    ]);
  });

  it('links entries and subfolders, and leaves an asset unlinked', async () => {
    const el = await render(host(<DirectoryList />));
    const hrefs = [...el.querySelectorAll('tbody a')].map((a) => a.getAttribute('href'));
    expect(hrefs.some((h) => h?.endsWith('/files/content/handbook/archive'))).toBe(true);
    expect(hrefs.some((h) => h?.endsWith('/files/content/handbook/onboarding.mdx'))).toBe(true);
    expect(hrefs.some((h) => h?.includes('policy.pdf'))).toBe(false);
    expect(el.querySelector('tr[data-kind="file"] .gdir__plain')?.textContent).toBe('policy.pdf');
  });

  it('shows only the metadata columns the corpus supplies, and drops `ui/` tags', async () => {
    const el = await render(host(<DirectoryList />));
    expect([...el.querySelectorAll('th')].map((t) => t.textContent)).toEqual([
      'Name',
      'Description',
      'Tags',
      'Updated',
    ]);
    expect([...el.querySelectorAll('.grove-tag')].map((t) => t.textContent)).toEqual(['#handbook']);
  });

  it('renders a plain table over a corpus with no frontmatter at all', async () => {
    readdir.mockResolvedValue([dirent('a.md'), dirent('b.md')]);
    const el = await render(host(<DirectoryList path="/plain" />));
    expect([...el.querySelectorAll('th')].map((t) => t.textContent)).toEqual(['Name']);
  });

  it('resolves `path` corpus-relative with a leading slash, entry-relative without', async () => {
    await render(host(<DirectoryList path="/teams" />));
    expect(readdir).toHaveBeenCalledWith('/app/content/teams', { withFileTypes: true });
    readdir.mockClear();
    await render(host(<DirectoryList path="archive" />));
    expect(readdir).toHaveBeenCalledWith('/app/content/handbook/archive', { withFileTypes: true });
  });

  it('says so when the folder is empty rather than rendering an empty table', async () => {
    readdir.mockResolvedValue([]);
    const el = await render(host(<DirectoryList />));
    expect(el.textContent).toContain('This folder is empty.');
    expect(el.textContent).toContain('No entries, subfolders or files here yet.');
    expect(el.querySelector('table')).toBeNull();
  });

  it('distinguishes an EMPTY folder from one whose every child is hidden', async () => {
    // Both produce zero rows. "This folder is empty." is false for the second, and a
    // reader who knows `_layout.mdx` is in there goes looking for a bug that is not one.
    readdir.mockResolvedValue([dirent('_layout.mdx'), dirent('.DS_Store')]);
    const el = await render(host(<DirectoryList />));
    expect(el.textContent).toContain('Nothing to show in this folder.');
    expect(el.textContent).toContain('2 files skipped');
    expect(el.textContent).not.toContain('This folder is empty.');
  });

  it('survives an unreadable path without throwing', async () => {
    readdir.mockRejectedValue(new Error('ENOTDIR'));
    const el = await render(host(<DirectoryList path="/nope" />));
    expect(el.querySelector('table')).toBeNull();
  });

  it('reads `hidden` as a STRING attribute — the safe renderer passes literals only', async () => {
    // Under the interpreter every attribute arrives as a string, so `hidden="false"`
    // would switch the flag ON if truthiness were the test.
    const off = await render(host(<DirectoryList hidden="false" />));
    expect(off.textContent).not.toContain('_layout.mdx');
    const on = await render(host(<DirectoryList hidden="true" />));
    expect(on.textContent).toContain('_layout.mdx');
  });

  it('is overridable through the MDX provider — the FOLDER ROUTE included', async () => {
    // The override contract in one assertion, driven through the real <DirectoryView>:
    // whatever the provider resolves for the name `DirectoryList` is what the folder
    // route renders. The view LOOKS THE COMPONENT UP rather than importing it, so a
    // replacement reaches the route too — not only MDX bodies that spell the tag out.
    const Replacement = ({ path }: { path?: string }) => <p className="mine">listing of {path}</p>;
    const el = await render(
      host(
        <MDXProvider components={{ DirectoryList: Replacement }}>
          <GroveShellContext.Provider value={shell('/app/content/handbook')}>
            <DirectoryView />
          </GroveShellContext.Provider>
        </MDXProvider>,
        '/files/content/handbook'
      )
    );
    expect(el.querySelector('.mine')?.textContent).toBe('listing of /handbook');
    // …and the stock table is genuinely gone, not merely joined.
    expect(el.querySelector('.grove-dirlist__table')).toBeNull();
  });

  it('falls back to the built-in table when nothing overrides the name', async () => {
    const el = await render(
      host(
        <GroveShellContext.Provider value={shell('/app/content/handbook')}>
          <DirectoryView />
        </GroveShellContext.Provider>,
        '/files/content/handbook'
      )
    );
    expect(el.querySelector('.grove-dirlist__table')).not.toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('handbook');
  });
});

// ── The DISPATCH packaging ────────────────────────────────────────────────────────────
//
// A dispatched Grove renders SOMEBODY ELSE'S corpus, mounted at a host-minted chroot
// (`/mnt/<hash>/`), while the engine itself is loaded from Grove's own repo. Every path
// helper is a function of that root — which is why `contentRoot.ts` warns "call it, don't
// capture it": a helper that froze `/app/content/` at module scope renders the VIEWER's
// corpus while claiming to render yours, and corrects itself never.
//
// Directory listings touch both path spaces at once — they READ through the mount and
// LINK through the URL space — so they are exactly where the two can be got backwards.
// Verified live against a dispatched corpus on the local host (2026-08-18); these pin it.
describe('<DirectoryList/> under dispatch', () => {
  const MOUNT = '/mnt/abc123def456/';
  const CORPUS_META = {
    '/mnt/abc123def456/context/ways_of_working.mdx': {
      title: 'Ways of working.',
      description: 'The engineering practices behind the product values.',
      updated: '2026-07-11',
    },
  };

  function dispatched(children: ReactNode, sandboxPath: string) {
    setContentRoot(MOUNT);
    const value = {
      outerHref: `https://local.immediately.run/present/local/ns/corpus/live${sandboxPath}`,
      navigationState: { mode: 'present', namespace: 'local', provider: 'local', repository: 'ns/corpus', ref: 'live', sandboxPath, hash: '', search: '' },
      routingSpec: { routes: [] },
      filesMetadata: CORPUS_META,
    };
    return <TinkerableContext.Provider value={value as never}>{children}</TinkerableContext.Provider>;
  }

  beforeEach(() => {
    readdir.mockReset();
    readdir.mockResolvedValue([dirent('ways_of_working.mdx'), dirent('diagram.svg')]);
  });

  it('reads through the MOUNT, not the fork root', async () => {
    await render(dispatched(<DirectoryList />, '/files/context'));
    // `/app/content/context` here would be the viewer rendering its own corpus.
    expect(readdir).toHaveBeenCalledWith('/mnt/abc123def456/context', { withFileTypes: true });
  });

  it('links in CORPUS-relative URL space — the mount path never reaches the DOM', async () => {
    const el = await render(
      dispatched(
        <GroveShellContext.Provider value={shell('/mnt/abc123def456/context')}>
          <DirectoryView />
        </GroveShellContext.Provider>,
        '/files/context'
      )
    );
    const hrefs = [...el.querySelectorAll('tbody a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toHaveLength(1); // the asset is listed, not linked
    expect(hrefs[0]?.endsWith('/files/context/ways_of_working.mdx')).toBe(true);

    // The load-bearing assertion, and the one that would have caught the R3-268 bug this
    // same mapping already had once: the chroot prefix is HOST knowledge. Grove can read
    // through it but must never publish it — a `/mnt/<hash>/…` href is a URL no router
    // resolves and a path the host's existence check misses.
    expect(el.innerHTML).not.toContain('mnt');
    expect(el.innerHTML).not.toContain('abc123def456');
    expect(el.innerHTML).not.toContain('/app/');
  });

  it('measures breadcrumbs from the corpus root, not from `/`', async () => {
    const el = await render(
      dispatched(
        <GroveShellContext.Provider value={shell('/mnt/abc123def456/plans/ui-as-apps')}>
          <DirectoryView />
        </GroveShellContext.Provider>,
        '/files/plans/ui-as-apps'
      )
    );
    const crumb = el.querySelector('.crumb')?.textContent ?? '';
    expect(crumb).toContain('plans');
    expect(crumb).not.toContain('mnt');
    expect(el.querySelector('h1')?.textContent).toContain('ui-as-apps');
  });

  it('resolves `path` against the mounted corpus, and confines traversal to it', async () => {
    await render(dispatched(<DirectoryList path="/specs" />, '/files/context'));
    expect(readdir).toHaveBeenCalledWith('/mnt/abc123def456/specs', { withFileTypes: true });
    readdir.mockClear();
    // Foreign content authored the href; `..` must not become a readdir of the host's fs.
    await render(dispatched(<DirectoryList path="../../.." />, '/files/context'));
    expect(readdir).toHaveBeenCalledWith('/mnt/abc123def456', { withFileTypes: true });
  });
});
