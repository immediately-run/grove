// @vitest-environment jsdom
// R3-1373 — a watch event on the corpus root re-reads the changed entry into the index
// the hook hands on, without a remount (the DIB-26 report: a title edit never reached
// the dibber board).
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useBundleMetadata, type BundleIndex } from './useBundleMetadata';

const h = vi.hoisted(() => {
  const files: Record<string, string> = {};
  const listeners = new Set<(name: string) => void>();
  const watch = () => {
    const queue: string[] = [];
    let wake: (() => void) | null = null;
    let ended = false;
    const onName = (n: string) => {
      queue.push(n);
      wake?.();
    };
    listeners.add(onName);
    const iterator = {
      async next() {
        while (!queue.length && !ended) await new Promise<void>((r) => (wake = r));
        if (ended) return { done: true, value: undefined };
        return { done: false, value: { eventType: 'change', filename: queue.shift() } };
      },
      async return() {
        ended = true;
        listeners.delete(onName);
        wake?.();
        return { done: true, value: undefined };
      },
    };
    return { [Symbol.asyncIterator]: () => iterator, return: iterator.return };
  };
  const promises = {
    readFile: async (p: string) => {
      if (files[p] === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return files[p];
    },
    readdir: async (dir: string) => {
      const names = new Set<string>();
      for (const p of Object.keys(files)) if (p.startsWith(dir)) names.add(p.slice(dir.length).split('/')[0]);
      return [...names].map((name) => ({ name, isDirectory: () => false }));
    },
    watch,
  };
  return { files, listeners, promises };
});
vi.mock('fs', () => ({ default: { promises: h.promises } }));
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = { promises: h.promises };

const entry = (title: string) => `---\ntitle: "${title}"\n---\n\nbody\n`;
const waitFor = async (cond: () => boolean) => {
  for (let i = 0; i < 100 && !cond(); i++) await act(async () => new Promise((r) => setTimeout(r, 10)));
};

describe('useBundleMetadata follows a live edit (R3-1373)', () => {
  it('a watch event for a corpus file re-renders the hook with the new row', async () => {
    h.files['/mnt/c/DIB-26.md'] = entry('Accept random ids');
    const out: { current: BundleIndex | null } = { current: null };
    const Probe = () => {
      out.current = useBundleMetadata('/mnt/c');
      return null;
    };
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<Probe />));
    await waitFor(() => out.current?.status === 'complete');
    expect(out.current?.metadata?.['/mnt/c/DIB-26.md']).toMatchObject({ title: 'Accept random ids' });
    await waitFor(() => h.listeners.size === 1);

    h.files['/mnt/c/DIB-26.md'] = entry('Accept random ids XYZZY');
    for (const l of h.listeners) l('DIB-26.md');
    await waitFor(() => (out.current?.metadata?.['/mnt/c/DIB-26.md'] as { title?: string })?.title !== 'Accept random ids');
    expect(out.current?.metadata?.['/mnt/c/DIB-26.md']).toMatchObject({ title: 'Accept random ids XYZZY' });

    act(() => root.unmount());
    expect(h.listeners.size).toBe(0); // the watch stops with the hook
  });
});
