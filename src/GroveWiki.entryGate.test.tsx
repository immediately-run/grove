// @vitest-environment jsdom
// The entry gate and declared stylesheets, rendered (MDX_FROM_MOUNT_SPEC D7, D8):
//   • while a file the entry needs is unread, the body is the boot line and the layers are
//     not rendered — and those files are asked for first;
//   • once they are read, the entry renders in the same mounted shell;
//   • the stylesheets home declares hold the body until they are read, then apply;
//   • a declaration that names no entry is shown to the reader.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { CorpusScanContext } from './lib/corpusScanContext';
import type { CorpusScanGate } from './lib/corpusScan';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null }),
  });
});

// One read double behind both doors: the `fs` module (entry bodies, declared stylesheets)
// and the SDK's shared fs (layouts, theme faces).
const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('fs', () => ({ default: { promises: { readFile: (...a: unknown[]) => readFile(...a) } } }));
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a) },
};

const { default: GroveWiki } = await import('./GroveWiki');

const ENTRY = '/app/content/wiki/a.mdx';
const HOME = '/app/content/home.mdx';
const LAYOUT = '/app/content/_layout.mdx';
const SHEET = '/app/content/themes/paper.mdx';

const NAV = {
  mode: 'github',
  namespace: 'immediately-run',
  provider: 'github',
  repository: 'corpus',
  ref: 'main',
  sandboxPath: ENTRY,
  hash: '',
  search: '',
};

// `render: safe` renders the body through the real safe renderer over the fs double (the
// compiled evaluator exists only inside the sandbox bundler).
function meta(home: Record<string, unknown> = {}) {
  return {
    [ENTRY]: { title: 'Reference entry.', render: 'safe' },
    [HOME]: { title: 'Home', ...home },
    [LAYOUT]: { site: 'Gate fixture' },
    [SHEET]: {},
  };
}

function gate(settled: Set<string> | 'all') {
  return {
    isSettled: (k: string) => settled === 'all' || settled.has(k),
    prioritize: vi.fn<CorpusScanGate['prioritize']>(),
  } satisfies CorpusScanGate;
}

async function render(root: Root, scan: CorpusScanGate, filesMetadata: Record<string, unknown>) {
  await act(async () => {
    root.render(
      <TinkerableContext.Provider
        value={{ outerHref: 'https://immediately.run/x', navigationState: NAV, routingSpec: { routes: [] } as never, filesMetadata } as never}
      >
        <CorpusScanContext value={scan}>
          <GroveWiki />
        </CorpusScanContext>
      </TinkerableContext.Provider>,
    );
  });
  for (let i = 0; i < 6; i++) await act(async () => {});
}

function mount(): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return { container, root: createRoot(container) };
}

const bootLine = (c: HTMLElement) => c.querySelector('.grove-shell .grove-boot__msg')?.textContent ?? null;

beforeEach(() => {
  readFile.mockReset();
  readFile.mockImplementation(async (path: string) =>
    path === SHEET ? '---\ntitle: Paper\n---\n--bg: #123456;\n' : '---\ntitle: Reference entry.\nrender: safe\n---\n\nThe body text.\n',
  );
  localStorage.clear();
});

describe('the entry gate (D8)', () => {
  it('holds the body on the boot line while the entry is unread, and asks for its files first', async () => {
    const { container, root } = mount();
    const scan = gate(new Set([HOME, LAYOUT]));
    await render(root, scan, meta());
    expect(bootLine(container)).toBe('Opening…');
    expect(container.textContent).not.toContain('The body text.');
    expect(container.querySelector('.grove-root')).toBeTruthy(); // the shell is mounted
    expect(scan.prioritize).toHaveBeenCalledWith([HOME, ENTRY, LAYOUT]);
    await act(async () => root.unmount());
  });

  it('renders the entry in the same shell once its files are read', async () => {
    const { container, root } = mount();
    await render(root, gate(new Set([HOME, LAYOUT])), meta());
    const shell = container.querySelector('.grove-root');
    await render(root, gate('all'), meta());
    expect(bootLine(container)).toBeNull();
    expect(container.textContent).toContain('The body text.');
    expect(container.querySelector('.grove-root')).toBe(shell); // not remounted
    await act(async () => root.unmount());
  });

  it('an unread HOME holds the body too — its `render: safe` is not known yet', async () => {
    const { container, root } = mount();
    await render(root, gate(new Set([ENTRY, LAYOUT])), meta());
    expect(bootLine(container)).toBe('Opening…');
    await act(async () => root.unmount());
  });
});

describe('declared stylesheets (D7)', () => {
  it('hold the body until read, then apply into the content layer', async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    readFile.mockImplementation(async (path: string) => {
      if (path === SHEET) {
        await held;
        return '---\ntitle: Paper\n---\n--bg: #123456;\n';
      }
      return '---\ntitle: Reference entry.\nrender: safe\n---\n\nThe body text.\n';
    });
    const { container, root } = mount();
    await render(root, gate('all'), meta({ stylesheets: ['themes/paper.mdx'] }));
    expect(bootLine(container)).toBe('Opening…');
    expect(readFile).toHaveBeenCalledWith(SHEET, 'utf8');
    await act(async () => release());
    for (let i = 0; i < 6; i++) await act(async () => {});
    expect(bootLine(container)).toBeNull();
    expect(container.querySelector('style[data-grove-content-theme]')?.textContent).toContain('--bg: #123456;');
    await act(async () => root.unmount());
  });

  it('a tagged entry that home does not declare is NOT applied — tag discovery is gone', async () => {
    const { container, root } = mount();
    const m = meta();
    m[SHEET] = { tags: ['ui/stylesheet'] };
    await render(root, gate('all'), m);
    expect(container.querySelector('style[data-grove-content-theme]')).toBeNull();
    expect(readFile).not.toHaveBeenCalledWith(SHEET, 'utf8');
    await act(async () => root.unmount());
  });

  it('a declaration that names no entry is shown, and does not hold the page', async () => {
    const { container, root } = mount();
    await render(root, gate('all'), meta({ stylesheets: ['../outside.mdx'] }));
    const error = container.querySelector('.grove-decl-error');
    expect(error?.textContent).toContain('../outside.mdx');
    expect(bootLine(container)).toBeNull();
    await act(async () => root.unmount());
  });

  it('a declared sheet that will not read is shown with its path', async () => {
    // Its own path: `safeSources` is the session-wide source cache, and a sheet an earlier
    // case read successfully stays read.
    const broken = '/app/content/themes/broken.mdx';
    readFile.mockImplementation(async (path: string) => {
      if (path === broken) throw new Error('ENOENT');
      return '---\ntitle: Reference entry.\nrender: safe\n---\n\nThe body text.\n';
    });
    const { container, root } = mount();
    await render(root, gate('all'), { ...meta({ stylesheets: ['themes/broken.mdx'] }), [broken]: {} });
    expect(container.querySelector('.grove-decl-error')?.textContent).toContain(`${broken} — could not be read`);
    expect(container.textContent).toContain('The body text.');
    await act(async () => root.unmount());
  });
});
