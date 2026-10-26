// @vitest-environment jsdom
// R3-1290 — under `render: safe`, entry bodies AND layouts render with the SHELL's vocabulary
// (what App captures above the corpus provider and hands down through ShellVocabularyContext),
// never with a nearer provider's map, which may hold a corpus's declared components.
//
// Its own file because the SDK's interpreted include keeps a module-level source cache that
// a test cannot reset: a fresh file is a fresh module graph, so the layout read is this
// fixture's, not an earlier case's. The harness is the entry-gate test's.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { MDXProvider } from '@immediately-run/sdk/MDXProvider';
import { CorpusScanContext } from './lib/corpusScanContext';
import type { CorpusScanGate } from './lib/corpusScan';
import { ShellVocabularyContext } from './lib/shell';
import { GROVE_MDX } from './mdxComponents';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null }),
  });
});

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('fs', () => ({ default: { promises: { readFile: (...a: unknown[]) => readFile(...a) } } }));
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a) },
};

const { default: GroveWiki } = await import('./GroveWiki');

const ENTRY = '/app/content/wiki/a.mdx';
const HOME = '/app/content/home.mdx';
const LAYOUT = '/app/content/_layout.mdx';

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

const allRead: CorpusScanGate = {
  isSettled: () => true,
  prioritize: vi.fn<CorpusScanGate['prioritize']>(),
  readFailure: () => null,
};

describe('the shell vocabulary under render: safe (R3-1290)', () => {
  const Probe = () => <span className="probe-shell">shell probe</span>;
  const Probe2 = () => <span className="probe-corpus">corpus probe</span>;
  it("renders a shell component in safe content and leaves a nearer provider's inert", async () => {
    // Wiki-wide safe (home), so the layout renders through SafeLayout and the entry through
    // SafeEntryBody — both must take the shell's map, never the nearer provider's.
    readFile.mockImplementation(async (path: string) => {
      if (path === HOME) return '---\ntitle: Home\nrender: safe\n---\n\nHome.\n';
      if (path === LAYOUT) return '---\nsite: Gate fixture\n---\n\n<Probe2 />\n\n<Outlet />\n';
      return '---\ntitle: Reference entry.\nrender: safe\n---\n\nThe body text.\n\n<Probe />\n\n<Probe2 />\n';
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TinkerableContext.Provider
          value={{ outerHref: 'https://immediately.run/x', navigationState: NAV, routingSpec: { routes: [] } as never, filesMetadata: { [ENTRY]: { title: 'Reference entry.', render: 'safe' }, [HOME]: { title: 'Home', render: 'safe' }, [LAYOUT]: { site: 'Gate fixture' } } } as never}
        >
          <CorpusScanContext value={allRead}>
            <ShellVocabularyContext value={{ ...GROVE_MDX, Probe }}>
              <MDXProvider components={{ Probe2 }}>
                <GroveWiki />
              </MDXProvider>
            </ShellVocabularyContext>
          </CorpusScanContext>
        </TinkerableContext.Provider>,
      );
    });
    // The safe body parses asynchronously: wait for it, bounded, instead of a fixed tick count.
    for (let i = 0; i < 50 && !container.querySelector('.grove-entry-body .probe-shell'); i++) {
      await act(async () => new Promise((r) => setTimeout(r, 5)));
    }
    const body = container.querySelector('.grove-entry-body');
    expect(body?.textContent).toContain('The body text.');
    expect(body?.querySelector('.probe-shell')?.textContent).toBe('shell probe');
    // Neither the entry body nor the safe layout (which names <Probe2/> too) renders it.
    expect(container.querySelector('.probe-corpus')).toBeNull();
    await act(async () => root.unmount());
  });
});
