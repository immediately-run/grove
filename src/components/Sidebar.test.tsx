// @vitest-environment jsdom
// Sidebar tree navigation (R3-608, APG Tree View): exactly ONE tabbable row
// over a real filesMetadata fixture (the producers `lib/directory.test.ts`
// exercises build this same map), Down walks the rendered rows, and Right
// expands a collapsed folder through the SAME handler #63's toggle button
// uses.
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';

const { default: Sidebar } = await import('./Sidebar');

// A real corpus shape: home + a wiki folder holding a leaf and a nested
// (initially collapsed) guide folder.
const FILES = {
  '/app/content/home.mdx': { title: 'Home.' },
  '/app/content/wiki/security.mdx': { title: 'Security.' },
  '/app/content/wiki/guide/api.mdx': { title: 'API guide.' },
  '/app/content/wiki/guide/deploy.mdx': { title: 'Deploying.' },
};

const NAV = {
  outerHref: 'https://example.immediately.run/app/x',
  navigationState: { sandboxPath: '/app/x', provider: 'github', namespace: 'immediately-run', repository: 'docs', ref: 'main', hash: '', search: '' },
  routingSpec: {} as never,
  filesMetadata: FILES,
};

async function mountSidebar(): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <TinkerableContext.Provider value={NAV as never}>
        <Sidebar />
      </TinkerableContext.Provider>,
    );
  });
  return { root, container };
}

const rows = (container: HTMLElement): HTMLElement[] =>
  [...container.querySelectorAll('[data-tree-row]')] as HTMLElement[];

describe('Sidebar tree navigation (R3-608)', () => {
  it('exposes exactly ONE tabbable row — the roving stop', async () => {
    const { container } = await mountSidebar();
    const stops = container.querySelectorAll('.gs-tree [tabindex="0"]');
    expect(stops.length).toBe(1);
  });

  it('Down moves focus through the rendered rows in order', async () => {
    const { container } = await mountSidebar();
    const list = rows(container);
    expect(list.length).toBeGreaterThanOrEqual(3); // home, wiki folder, security
    list[0].focus();
    await act(async () => {
      list[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(list[1]);
    await act(async () => {
      list[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(list[2]);
    // Home returns to the first row.
    await act(async () => {
      list[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(list[0]);
  });

  it('Right expands a collapsed folder through the #63 toggle handler', async () => {
    const { container } = await mountSidebar();
    // Rows: home, [wiki folder], security, [guide folder — depth 1, collapsed].
    const guide = rows(container).find((r) => r.getAttribute('aria-expanded') === 'false');
    expect(guide).toBeTruthy();
    const before = rows(container).length;
    guide!.focus();
    await act(async () => {
      guide!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    // The folder opened: its two leaf rows joined the rendered set, and the
    // same row now announces expanded.
    expect(rows(container).length).toBe(before + 2);
    expect(guide!.getAttribute('aria-expanded')).toBe('true');
    // Left collapses it again.
    await act(async () => {
      guide!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    });
    expect(rows(container).length).toBe(before);
    expect(guide!.getAttribute('aria-expanded')).toBe('false');
  });

  it('the rows carry treeitem semantics under a tree', async () => {
    const { container } = await mountSidebar();
    const tree = container.querySelector('[role="tree"]');
    expect(tree).toBeTruthy();
    expect(container.querySelectorAll('[role="treeitem"]').length).toBe(rows(container).length);
  });
});
