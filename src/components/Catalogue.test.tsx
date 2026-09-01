// @vitest-environment jsdom
// R3-310's catalogue exits at the component:
//   • BYTE-IDENTICAL MARKUP under all four themes — the claim the catalogue is
//     for ("assert it, do not eyeball it"): the same wiki renders the same DOM,
//     the theme being the single root-level attribute that differs;
//   • the webfont looks declare their faces and mint them from LOCAL bytes
//     (network-off rendering is byte-for-byte the same mechanism);
//   • the catalogue exposes exactly the four shippable looks.
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { mintThemeAssets } from '../lib/themeAssets';
import { themeAssetsFor, ARCHIVE_THEME_ASSETS, JOURNAL_THEME_ASSETS } from '../data/themeFonts';
import { THEMES } from '../data/themes';

// GroveWiki reads viewport state at mount; jsdom has no matchMedia.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false, onchange: null }),
  });
});

const readFile = vi.fn();
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a) },
};

const { default: GroveWiki } = await import('../GroveWiki');

const NAV = {
  mode: 'github',
  namespace: 'immediately-run',
  provider: 'github',
  repository: 'corpus',
  ref: 'main',
  sandboxPath: '/app/content/wiki/a.mdx',
  hash: '',
  search: '',
};

// `render: safe` — the interpreter body path, so the render exercises the real
// safe renderer over the fs double instead of the compiled-MDX evaluator, which
// exists only inside the sandbox bundler. (Both paths produce the same DOM shape;
// the compiled one is the bundler's, not the theme's.)
const META = {
  '/app/content/wiki/a.mdx': { title: 'Reference entry.', tags: ['x'], render: 'safe' },
  '/app/content/_layout.mdx': { site: 'Catalogue fixture' },
};

async function renderWiki(): Promise<{ container: HTMLElement; root: Root }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <TinkerableContext.Provider
        value={{
          outerHref: 'https://immediately.run/x',
          navigationState: NAV,
          routingSpec: { routes: [] } as never,
          filesMetadata: META,
        } as never}
      >
        <GroveWiki />
      </TinkerableContext.Provider>,
    );
  });
  // Flush the async bits the wiki mounts (the scan, the asset mint, observers).
  for (let i = 0; i < 6; i++) await act(async () => {});
  return { container, root };
}

/** Serialize the wiki with the THEME ATTRIBUTES MASKED — everything else must be
 *  byte-identical across themes. */
function serialized(container: HTMLElement, maskAttr: string[]): string {
  const clone = container.querySelector('.grove-root')?.cloneNode(true) as HTMLElement | null;
  if (!clone) return '(no .grove-root)';
  // Drop engine-minted style URLs (they are per-mount object URLs by design).
  clone.querySelectorAll('style[data-grove-theme-assets]').forEach((s) => s.remove());
  const rootEl = clone;
  for (const a of maskAttr) rootEl.removeAttribute(a);
  return rootEl.innerHTML;
}

beforeEach(() => {
  readFile.mockReset();
  readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  localStorage.clear();
});

describe('byte-identical markup under all four themes', () => {
  for (const theme of ['default', 'archive', 'journal', 'editorial']) {
    it(`theme=${theme}: the same wiki, the same DOM`, async () => {
      localStorage.setItem('grove:theme', theme);
      const { container, root } = await renderWiki();
      const html = serialized(container, ['data-grove-theme', 'data-theme']);
      expect(container.querySelector('.grove-root')).toBeTruthy();
      // The theme actually applied (the one assertion attr-specific):
      const applied = container.querySelector('.grove-root')?.getAttribute('data-grove-theme');
      expect(applied ?? 'default').toBe(theme);
      (globalThis as unknown as Record<string, string>)[`__wiki_${theme}`] = html;
      await act(async () => {
        root.unmount();
      });
    });
  }

  it('all four serializations are byte-identical', () => {
    const g = globalThis as unknown as Record<string, string>;
    const set = new Set(['default', 'archive', 'journal', 'editorial'].map((t) => g[`__wiki_${t}`]));
    expect(set.size).toBe(1);
  });
});

describe('the webfont looks declare and mint their faces from local bytes', () => {
  it('archive mints Source Serif 4 from the in-repo bytes (network-off by construction)', async () => {
    const m = await mintThemeAssets(ARCHIVE_THEME_ASSETS, '/app/src/index.css', async (p) => {
      // Only the theme's OWN additions resolve here; the default-set faces share
      // the same mechanism (proven in ThemeAssets.test) — assert the serif legs.
      if (!p.includes('source-serif-4')) throw new Error('ENOENT');
      return new Uint8Array([1]);
    });
    expect(m.minted).toBe(4); // 400/500/600/700
    expect(m.fontFaceCss).toContain('"Source Serif 4"');
  });

  it('journal mints Lora the same way', async () => {
    const m = await mintThemeAssets(JOURNAL_THEME_ASSETS, '/app/src/index.css', async (p) => {
      if (!p.includes('lora')) throw new Error('ENOENT');
      return new Uint8Array([1]);
    });
    expect(m.minted).toBe(4);
    expect(m.fontFaceCss).toContain('"Lora"');
  });

  it('editorial keeps the default set — loud through weight and colour, not a new face', () => {
    expect(themeAssetsFor('editorial')).toEqual(themeAssetsFor('default'));
  });

  it('every declared face file actually ships in the repo (the offline guarantee)', async () => {
    const { readdir } = await import('node:fs/promises');
    const shipped = new Set(await readdir('assets/fonts'));
    for (const set of [themeAssetsFor('default'), ARCHIVE_THEME_ASSETS, JOURNAL_THEME_ASSETS]) {
      for (const f of set.fonts ?? []) {
        expect(shipped.has(f.src.split('/').pop() as string)).toBe(true);
      }
    }
  });
});

describe('the catalogue', () => {
  it('is exactly the four shippable looks; the showcase skins are retired', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['default', 'archive', 'journal', 'editorial']);
  });
});
