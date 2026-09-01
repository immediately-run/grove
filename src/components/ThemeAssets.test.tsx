// @vitest-environment jsdom
// R3-315's component-level exits: the engine emission renders the minted
// @font-face set inside the engine cascade layer, revokes on unmount (a switch
// leaks nothing), degrades to nothing when the bytes are unreadable, and — the
// offline exit — no shipped stylesheet carries a third-party @import.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

const readFile = vi.fn();
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a) },
};

const { default: ThemeAssets } = await import('./ThemeAssets');
const { DEFAULT_THEME_ASSETS } = await import('../data/themeFonts');

const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

async function renderSwap(nodes: ReactNode[]): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  for (const node of nodes) {
    await act(async () => {
      root.render(node);
    });
  }
  return container;
}

beforeEach(() => {
  readFile.mockReset();
  revokeSpy.mockClear();
});

describe('the engine emission', () => {
  it('renders the minted faces inside the ENGINE cascade layer, blob: srcs only', async () => {
    readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const el = await renderSwap([<ThemeAssets declarations={DEFAULT_THEME_ASSETS} />]);
    const style = el.querySelector('style[data-grove-theme-assets]');
    expect(style).toBeTruthy();
    expect(style?.textContent).toContain('@layer grove.engine{');
    expect(style?.textContent).toContain('"Gabarito"');
    expect(style?.textContent).toContain('"Public Sans"');
    expect(style?.textContent).toContain('"Space Mono"');
    expect((style?.textContent?.match(/src: url\("blob:/g) ?? []).length).toBe(12);
    // The read set is the in-repo face set — no network fetch is involved at all.
    // The read goes through the SDK root-mount (leading slash stripped — the
    // root-anchored relPath, the same key space MountImage reads).
    expect(readFile).toHaveBeenCalledWith('/app/assets/fonts/gabarito-latin-400-normal.woff2');
  });

  it('unmount revokes every minted URL — switching sets leaks nothing', async () => {
    readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: Root | null = createRoot(container);
    await act(async () => {
      root?.render(<ThemeAssets declarations={DEFAULT_THEME_ASSETS} />);
    });
    expect(revokeSpy).not.toHaveBeenCalled(); // live set holds its URLs
    await act(async () => {
      root?.render(<ThemeAssets declarations={{ fonts: [{ family: 'Other', src: './o.woff2' }] }} />);
    });
    // The DEFAULT set (12 URLs) was the OUTGOING set — revoked on the swap.
    expect(revokeSpy).toHaveBeenCalledTimes(12);
    await act(async () => {}); // let the incoming set's mint land (it is now live)
    await act(async () => {
      root?.unmount();
    });
    root = null;
    expect(revokeSpy).toHaveBeenCalledTimes(13); // + the incoming set's 1
  });

  it('unreadable bytes degrade to no style element at all (the fallback stack answers)', async () => {
    readFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    const el = await renderSwap([<ThemeAssets declarations={DEFAULT_THEME_ASSETS} />]);
    expect(el.querySelector('style[data-grove-theme-assets]')).toBeNull();
  });
});

describe('the offline exit — no third-party @import survives in any shipped stylesheet', () => {
  it('grep over the shipped css: no @import names a network location', async () => {
    const { readdir, readFile: rf } = await import('node:fs/promises');
    const walk = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) out.push(...(await walk(p)));
        else if (p.endsWith('.css')) out.push(p);
      }
      return out;
    };
    const files = await walk('src');
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const css = await rf(f, 'utf8');
      for (const line of css.split('\n')) {
        if (line.includes('@import')) {
          // Only same-package/relative imports could ever be acceptable; a URL is
          // the withdrawn exception.
          expect(line).not.toMatch(/https?:\/\//);
        }
      }
    }
  });
});
