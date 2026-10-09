// @vitest-environment jsdom
// R3-1090 — the hook hands the LIVE, partial map on during the listing (a
// priority-read row publishes mid-walk), where before it answered null until the
// listing completed. The entry gate, not the wiki, waits.
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useBundleMetadata, type BundleIndex } from './useBundleMetadata';

// readdir holds forever: the walk never finishes, so the listing stays open.
// (Declared inside the hoisted factory — vi.mock hoists above top-level consts.)
const { readFile, neverList } = vi.hoisted(() => ({
  readFile: vi.fn(),
  neverList: () => new Promise<never>(() => {}),
}));
vi.mock('fs', () => ({
  default: { promises: { readFile: (...a: unknown[]) => readFile(...a), readdir: neverList } },
}));
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a), readdir: neverList },
};

function probe(root: string | null): { current: BundleIndex | null; unmount: () => void } {
  const out: { current: BundleIndex | null; unmount: () => void } = { current: null, unmount: () => {} };
  const Probe = () => {
    out.current = useBundleMetadata(root);
    return null;
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const r = createRoot(container);
  act(() => r.render(<Probe />));
  out.unmount = () => act(() => r.unmount());
  return out;
}

describe('useBundleMetadata during the listing (R3-1090)', () => {
  it('hands the partial map on while the walk runs — a priority-read row is visible mid-listing', async () => {
    // The walk never finishes in this test (readdir holds); the entry's read is
    // started by prioritize and publishes into the live map.
    readFile.mockImplementation(async (path: string) =>
      path === '/mnt/c/entry.mdx' ? '---\ntitle: "Early"\n---\n\nbody\n' : '---\ntitle: "Other"\n---\n\nbody\n',
    );
    const p = probe('/mnt/c');
    await act(async () => {});
    expect(p.current?.status).toBe('listing');
    expect(p.current?.scan).toBeTruthy();
    act(() => p.current?.scan?.prioritize(['/mnt/c/entry.mdx']));
    await act(async () => {});
    expect(p.current?.status).toBe('listing'); // the walk is still open
    expect(p.current?.metadata?.['/mnt/c/entry.mdx']).toMatchObject({ title: 'Early' });
    p.unmount();
  });

  it('a fork (null root) stays idle with no map and no scan', async () => {
    const p = probe(null);
    await act(async () => {});
    expect(p.current).toEqual({ status: 'idle', metadata: null, scan: null });
    p.unmount();
  });
});
