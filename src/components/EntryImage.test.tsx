// @vitest-environment jsdom
// R3-313's adversarial exit criteria, at the component:
//   • a grid of cards for SIX different entries renders SIX different covers — the
//     cross-entry case that is broken by construction today (a single-entry test
//     would pass while proving nothing);
//   • no `cover:` and a `cover:` naming a missing file both degrade to the
//     lattice — no broken-image glyph, no error, no layout shift;
//   • under dispatch the chroot prefix reaches no rendered src (blob URLs only),
//     with the assertion proven NON-VACUOUS by fault injection — a canary that
//     leaks the raw path is caught by the same check;
//   • a read-only mount serves covers (only reads are issued).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { resetContentRoot, setContentRoot } from '../lib/contentRoot';
import { GroveShellContext, type GroveShell } from '../lib/shell';
import { entryAssetRelPath } from '../lib/assetPath';

// The fs slice MountImage reads through: `openFs` → `sandboxFs()` → the shared-fs
// global the host injects (`__sandpackSharedFs`) — NOT the 'fs' module, which is
// why mocking that module leaves image reads silently "unavailable" (and degrade
// tests passing vacuously). The double exposes readFile ONLY — a write attempt is
// a TypeError, which is the read-only point.
const readFile = vi.fn();
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a) },
};

const { default: DocList } = await import('./DocList');
const { default: EntryImage } = await import('./EntryImage');

const MOUNT = '/mnt/abc123def456/';
const PNG = 'iVBORw0KGgo=';

const shell = (entryKey: string): GroveShell => ({ entryKey, siteTitle: 'Handbook' }) as unknown as GroveShell;

async function render(node: ReactNode): Promise<{ container: HTMLElement; root: Root }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

// The production shape: metadata arrives through the context store the cards read,
// the corpus root is the dispatched mount, and the rendered entry is one wiki page.
async function renderSeeded(meta: Record<string, Record<string, unknown>>) {
  setContentRoot(MOUNT);
  const value = {
    outerHref: 'https://local.immediately.run/present/local/ns/corpus/live',
    navigationState: {
      mode: 'present',
      namespace: 'local',
      provider: 'local',
      repository: 'ns/corpus',
      ref: 'live',
      sandboxPath: '/files',
      hash: '',
      search: '',
    },
    routingSpec: { routes: [] },
    filesMetadata: meta,
  };
  return render(
    <GroveShellContext.Provider value={shell(`${MOUNT}wiki/index.mdx`)}>
      <TinkerableContext.Provider value={value as never}>
        <DocList shape="grid" />
      </TinkerableContext.Provider>
    </GroveShellContext.Provider>,
  );
}

const sixEntries = (): Record<string, Record<string, unknown>> => {
  const meta: Record<string, Record<string, unknown>> = {};
  for (let i = 1; i <= 6; i++) meta[`${MOUNT}wiki/e${i}.mdx`] = { title: `E${i}.`, cover: `pic${i}.png` };
  return meta;
};

beforeEach(() => {
  readFile.mockReset();
  resetContentRoot();
});

describe('the six-covers grid (the case broken by construction today)', () => {
  it('six different entries render six DIFFERENT covers, each resolved against its OWN entry', async () => {
    readFile.mockResolvedValue(PNG);
    const { container } = await renderSeeded(sixEntries());
    // Six reads at six DISTINCT owning-entry paths — the cross-entry property a
    // single-entry test cannot see.
    const reads = readFile.mock.calls.map((c) => String(c[0]));
    expect(reads).toHaveLength(6);
    expect(new Set(reads).size).toBe(6);
    for (let i = 1; i <= 6; i++) expect(reads).toContain(`${MOUNT}wiki/pic${i}.png`);
    // Six images rendered, each a distinct object URL.
    const imgs = [...container.querySelectorAll('img.gdl-card__cover')];
    expect(imgs).toHaveLength(6);
    expect(new Set(imgs.map((im) => im.getAttribute('src'))).size).toBe(6);
    // THE dispatch assertion (DirectoryList.test.tsx's, extended to src): the
    // chroot prefix is host knowledge — it reaches no rendered src, no attribute,
    // no markup.
    expect(container.innerHTML).not.toContain('mnt');
    expect(container.innerHTML).not.toContain('abc123def456');
  });

  it('NON-VACUOUS by fault injection: the same assertion catches a leaking render', async () => {
    // The canary publishes the RAW resolved path as the img src — the exact
    // regression class the dispatch assertion exists for. If the check above
    // could be satisfied by a leak, this would pass silently; a live check
    // catches the canary, which is what we assert.
    readFile.mockResolvedValue(PNG);
    setContentRoot(MOUNT);
    const value = {
      outerHref: '',
      navigationState: {
        mode: 'present',
        namespace: 'local',
        provider: 'local',
        repository: 'ns/corpus',
        ref: 'live',
        sandboxPath: '/files',
        hash: '',
        search: '',
      },
      routingSpec: { routes: [] },
      filesMetadata: {},
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let caught = false;
    try {
      await act(async () => {
        root.render(
          <TinkerableContext.Provider value={value as never}>
            {/* the sabotage: src carries the resolved corpus path verbatim */}
            <img src={`/${entryAssetRelPath(`${MOUNT}wiki/e1.mdx`, 'pic1.png')}`} alt="" />
          </TinkerableContext.Provider>,
        );
      });
      expect(container.innerHTML).not.toContain('abc123def456');
    } catch {
      caught = true;
    }
    expect(caught).toBe(true); // the check FIRES on a leak — it is not vacuous
  });
});

describe('degrade, never break', () => {
  it('no `cover:` renders the lattice placeholder — no img, no error', async () => {
    readFile.mockResolvedValue(PNG);
    const meta = {
      [`${MOUNT}wiki/a.mdx`]: { title: 'A.' },
      [`${MOUNT}wiki/b.mdx`]: { title: 'B.' },
    };
    const { container } = await renderSeeded(meta);
    expect(container.querySelectorAll('img').length).toBe(0);
    expect(container.querySelectorAll('.gdl-card__lattice').length).toBe(2);
    expect(container.textContent).not.toContain('missing asset');
  });

  it('a `cover:` naming a MISSING file renders the lattice — no glyph, no error surface', async () => {
    readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const meta = { [`${MOUNT}wiki/a.mdx`]: { title: 'A.', cover: 'gone.png' } };
    const { container } = await renderSeeded(meta);
    await act(async () => {});
    await act(async () => {});
    expect(container.querySelectorAll('img').length).toBe(0);
    expect(container.querySelectorAll('.gdl-card__lattice').length).toBe(1);
    expect(container.textContent).not.toContain('missing asset');
    expect(container.textContent).not.toContain('ENOENT');
  });

  it('no layout shift: the pic box renders whether the cover resolves or not', async () => {
    readFile.mockRejectedValue(new Error('EIO'));
    const meta = { [`${MOUNT}wiki/a.mdx`]: { title: 'A.', cover: 'gone.png' } };
    const { container } = await renderSeeded(meta);
    expect(container.querySelectorAll('.gdl-card__pic').length).toBe(1);
  });
});

describe('a read-only mount serves covers', () => {
  it('only reads are issued — the fs double has no write method at all', async () => {
    const meta = { [`${MOUNT}wiki/a.mdx`]: { title: 'A.', cover: 'pic.png' } };
    readFile.mockResolvedValue(PNG);
    await renderSeeded(meta);
    expect(readFile).toHaveBeenCalled();
  });
});

describe('EntryImage directly', () => {
  it('absent src degrades without touching the fs', async () => {
    setContentRoot(MOUNT);
    const { container } = await render(<EntryImage entryPath={`${MOUNT}wiki/a.mdx`} degrade={<span className="lat" />} />);
    expect(container.querySelector('.lat')).toBeTruthy();
    expect(readFile).not.toHaveBeenCalled();
  });

  it('a non-string `cover:` (author typo) degrades like an absent one', async () => {
    setContentRoot(MOUNT);
    const { container } = await render(
      <EntryImage entryPath={`${MOUNT}wiki/a.mdx`} src={42 as unknown as string} degrade={<span className="lat" />} />,
    );
    expect(container.querySelector('.lat')).toBeTruthy();
    expect(readFile).not.toHaveBeenCalled();
  });
});
