// @vitest-environment jsdom
// R3-1289 — the safe gate on corpus-declared components. A corpus whose home entry declares
// `render: safe` runs no author code (MDX_FROM_MOUNT_SPEC §4.1), so `loadDeclared` must
// evaluate NONE of its declared modules; the compiled path keeps loading them.
//
// The marker is a real ticket corpus's (`immediately-run/fieldhouse` `tickets/
// immediately.run.json` at 264c02a, ten declared components), saved as a fixture so the
// declaration parse is the real one.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import MARKER from './__fixtures__/ticket-corpus/immediately.run.json?raw';
const DECLARED = Object.keys(JSON.parse(MARKER).components as Record<string, string>);
const ROOT = '/mnt/corpus/';

const { readFile, evaluate } = vi.hoisted(() => ({ readFile: vi.fn(), evaluate: vi.fn() }));
vi.mock('fs', () => ({ default: { promises: { readFile: (...a: unknown[]) => readFile(...a) } } }));
// The bundler's module evaluation, at its one seam.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('../lib/moduleEvaluation', () => ({ evaluateModule: (p: string) => evaluate(p) }));

import { useContentComponents, type ContentComponents } from './useContentComponents';

function probe(root: string): { current: ContentComponents | null; unmount: () => void } {
  const out: { current: ContentComponents | null; unmount: () => void } = { current: null, unmount: () => {} };
  const Probe = ({ onResult }: { onResult: (r: ContentComponents) => void }) => {
    const result = useContentComponents(root);
    useEffect(() => onResult(result), [onResult, result]);
    return null;
  };
  const onResult = (r: ContentComponents) => {
    out.current = r;
  };
  const container = document.createElement('div');
  const r = createRoot(container);
  act(() => r.render(<Probe onResult={onResult} />));
  out.unmount = () => act(() => r.unmount());
  return out;
}

/** Render the hook against ROOT and wait until it has settled. */
async function load(): Promise<ContentComponents> {
  const out = probe(ROOT);
  for (let i = 0; i < 50 && out.current?.status !== 'ready'; i++) {
    await act(async () => new Promise((r) => setTimeout(r, 0)));
  }
  out.unmount();
  return out.current as ContentComponents;
}

/** fs double: the marker, and a home entry (or a read error when `home` is an Error). */
function corpus(home: string | Error | null) {
  readFile.mockImplementation(async (path: string) => {
    if (path === `${ROOT}immediately.run.json`) {
      if (home === null) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      return MARKER;
    }
    if (path === `${ROOT}home.mdx`) {
      if (home instanceof Error) throw home;
      return home ?? '';
    }
    throw Object.assign(new Error(`ENOENT ${path}`), { code: 'ENOENT' });
  });
}

const Component = () => null;

beforeEach(() => {
  readFile.mockReset();
  evaluate.mockReset();
  evaluate.mockResolvedValue({ default: Component });
});

describe('useContentComponents — the render: safe gate (R3-1289)', () => {
  it('a home entry declaring render: safe evaluates no declared module', async () => {
    corpus('---\ntitle: Tickets\nrender: safe\n---\n\nBody.\n');
    const result = await load();
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.components).toEqual({});
    expect(result.rejected.map((r) => r.name)).toEqual(DECLARED);
    expect(result.rejected.every((r) => r.reason === 'not loaded: this wiki renders safely (render: safe on its home entry)')).toBe(true);
  });

  it('a home entry without render: evaluates every declaration, as before', async () => {
    corpus('---\ntitle: Tickets\n---\n\nBody.\n');
    const result = await load();
    expect(result.rejected).toEqual([]);
    expect(evaluate).toHaveBeenCalledTimes(DECLARED.length);
    expect(Object.keys(result.components).sort()).toEqual([...DECLARED].sort());
  });

  it('a home entry that cannot be read fails closed — nothing is evaluated', async () => {
    corpus(Object.assign(new Error('EIO'), { code: 'EIO' }));
    const result = await load();
    expect(evaluate).not.toHaveBeenCalled();
    expect(result.rejected[0]?.reason).toBe('not loaded: the home entry could not be read');
  });

  it('no marker — the home entry is never read', async () => {
    corpus(null);
    const result = await load();
    expect(result.components).toEqual({});
    expect(readFile.mock.calls.map(([p]) => p)).toEqual([`${ROOT}immediately.run.json`]);
  });
});
