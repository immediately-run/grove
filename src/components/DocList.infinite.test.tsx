// @vitest-environment jsdom
// The windowed feed (R3-314) — every adversarial exit criterion, driven through
// the real component over a 142-entry fixture:
//   one batch renders, then extends on scroll, append-only (no boundary shift);
//   the sentinel is a button — reachable and actionable by keyboard alone;
//   the end states itself ("that is all N entries"), never merely stops;
//   no IntersectionObserver → the full list renders (proven by removing it).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import type { GroveShell } from '../lib/shell';
import { GroveShellContext } from '../lib/shell';
import { resetContentRoot, setContentRoot } from '../lib/contentRoot';

const { default: DocList } = await import('./DocList');

// ── the fixture: 142 dated entries, frontmatter-shaped exactly as the query reads ──
const N = 142;
const METADATA: Record<string, Record<string, unknown>> = {};
for (let i = 1; i <= N; i++) {
  const day = String((i % 28) + 1).padStart(2, '0');
  METADATA[`/app/content/log/entry-${String(i).padStart(3, '0')}.mdx`] = {
    title: `Entry ${i}.`,
    description: `The ${i}th fixture entry.`,
    date: `2026-01-${day}`,
  };
}

const NAV = {
  outerHref: 'https://example.immediately.run/app/x',
  navigationState: { sandboxPath: '/app/x' },
  filesMetadata: METADATA,
};
const SHELL = { navMode: 'side', vw: 'desktop', navItems: [] } as unknown as GroveShell;

// ── a controllable IntersectionObserver stand-in (the useHeadings pattern,
//    driven from the test instead of by a real scroll) ──────────────────────────
let observerInstances: ControllableObserver[] = [];
class ControllableObserver {
  cb: IntersectionObserverCallback;
  targets: Element[] = [];
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    observerInstances.push(this);
  }
  observe(t: Element) {
    this.targets.push(t);
  }
  disconnect() {
    this.targets = [];
  }
  unobserve() {
    /* unused */
  }
  /** The browser's part: "the sentinel is now intersecting". */
  intersect() {
    for (const t of this.targets) this.cb([{ isIntersecting: true, target: t } as IntersectionObserverEntry], this as never);
  }
}

const rowsOf = (host: HTMLElement): string[] =>
  [...host.querySelectorAll('.gdl-row__t')].map((e) => e.textContent?.trim() ?? '');

const mount = async (props: Record<string, unknown> = {}): Promise<{ host: HTMLElement; root: Root }> => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <TinkerableContext.Provider value={NAV as never}>
        <GroveShellContext.Provider value={SHELL}>
          <DocList paginate="infinite" batch="20" {...props} />
        </GroveShellContext.Provider>
      </TinkerableContext.Provider>,
    );
  });
  return { host, root };
};

describe('the windowed feed (R3-314)', () => {
  beforeEach(() => {
    setContentRoot('/app/content/');
    observerInstances = [];
    (window as unknown as Record<string, unknown>).IntersectionObserver = ControllableObserver as never;
  });
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).IntersectionObserver;
    resetContentRoot();
    document.body.innerHTML = '';
  });

  it('renders ONE batch, not all 142, with the sentinel present', async () => {
    const { host } = await mount();
    expect(rowsOf(host)).toHaveLength(20);
    expect(host.querySelector('.gdl-sentinel')).not.toBeNull();
    expect(host.querySelector('.gdl-end')).toBeNull();
  });

  it('extends on intersect — append-only, so no boundary shift', async () => {
    // "No layout shift, asserted, not eyeballed": the first batch's rows are
    // still mounted, in the same order, and the list only ever APPENDS. Rows
    // re-created (keys changed, order shuffled) is how a windowed list shifts.
    const { host } = await mount();
    const before = rowsOf(host);
    const firstNodes = [...host.querySelectorAll('.gdl-row__t')];
    expect(observerInstances.length).toBeGreaterThan(0);
    await act(async () => {
      observerInstances[0]!.intersect();
    });
    const after = rowsOf(host);
    expect(after).toHaveLength(40);
    expect(after.slice(0, 20)).toEqual(before);
    const stillMounted = [...host.querySelectorAll('.gdl-row__t')].slice(0, 20);
    expect(stillMounted.every((el, i) => el === firstNodes[i])).toBe(true);
  });

  it('the sentinel is a BUTTON — actionable by keyboard alone, to the very end', async () => {
    const { host } = await mount();
    const sentinel = host.querySelector<HTMLButtonElement>('.gdl-sentinel');
    expect(sentinel?.tagName).toBe('BUTTON'); // focusable, Enter/Space actionable
    let rounds = 0;
    while (host.querySelector('.gdl-sentinel') && rounds < 20) {
      await act(async () => {
        host.querySelector<HTMLButtonElement>('.gdl-sentinel')?.click();
      });
      rounds++;
    }
    expect(rowsOf(host)).toHaveLength(N); // a keyboard-only user reaches the end
    expect(host.querySelector('.gdl-sentinel')).toBeNull();
    expect(host.querySelector('.gdl-end')?.textContent).toContain(`all ${N} entries`);
  });

  it('the end states itself — the list never merely stops', async () => {
    const { host } = await mount();
    for (let i = 0; i < 20 && host.querySelector('.gdl-sentinel'); i++) {
      await act(async () => {
        observerInstances[0]?.intersect();
      });
    }
    const end = host.querySelector('.gdl-end');
    expect(end?.getAttribute('role')).toBe('status');
    expect(end?.textContent).toMatch(/^That is all 142 entries\.$/);
  });

  it('with no IntersectionObserver at all, the FULL list renders — proven by removing it', async () => {
    delete (window as unknown as Record<string, unknown>).IntersectionObserver;
    const { host } = await mount();
    expect(rowsOf(host)).toHaveLength(N);
    expect(host.querySelector('.gdl-sentinel')).toBeNull();
    expect(host.querySelector('.gdl-end')).toBeNull(); // nothing was windowed
  });

  it('limit still caps the query — a pinned list is never windowed past its pin', async () => {
    const { host } = await mount({ limit: '35' });
    expect(rowsOf(host)).toHaveLength(20);
    for (let i = 0; i < 3 && host.querySelector('.gdl-sentinel'); i++) {
      await act(async () => {
        observerInstances[0]?.intersect();
      });
    }
    expect(rowsOf(host)).toHaveLength(35);
    expect(host.querySelector('.gdl-end')?.textContent).toContain('all 35 entries');
  });
});
