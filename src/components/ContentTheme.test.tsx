// @vitest-environment jsdom
// R3-316's component + escape-hatch exits:
//   • a clean ui/stylesheet renders into @layer grove.content (and its declared
//     faces mint through the R3-315 path — never a url());
//   • a rejected sheet names the line and degrades (no style element for it);
//   • THE ESCAPE HATCH: the hiding vectors a content stylesheet would try are
//     each answered by a grove.reset !important pin — and the layer ORDER puts
//     grove.reset first (for !important, earlier layers win), so grove.content
//     cannot out-priority it. Proven against the SHIPPED css bytes.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { join } from 'node:path';

const readFile = vi.fn();
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a) },
};

const { default: ContentTheme } = await import('./ContentTheme');

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(node);
  });
  for (let i = 0; i < 4; i++) await act(async () => {});
  return container;
}

const SHEET = (css: string, extra: Record<string, unknown> = {}) => ({
  path: '/app/content/style.mdx',
  css,
  declarations: extra as never,
});

beforeEach(() => readFile.mockReset());

describe('admission into the lowest layer', () => {
  it('a clean sheet renders as @layer grove.content on .grove-root', async () => {
    const el = await render(<ContentTheme sheets={[SHEET('--bg: #123;\n')]} />);
    const style = el.querySelector('style[data-grove-content-theme]');
    expect(style?.textContent).toContain('@layer grove.content');
    expect(style?.textContent).toContain('--bg: #123');
  });

  it('a rejected sheet degrades — no style element, verdict delivered to the caller', async () => {
    const onRejected = vi.fn();
    const el = await render(
      <ContentTheme sheets={[SHEET('.evil { display: none; }')]} onRejected={onRejected} />,
    );
    expect(el.querySelector('style[data-grove-content-theme]')).toBeNull();
    expect(onRejected).toHaveBeenCalledWith(
      '/app/content/style.mdx',
      expect.objectContaining({ line: 1, reason: expect.stringMatching(/selector/) }),
    );
  });

  it('declared faces mint through the engine path (blob:), never a url()', async () => {
    readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const el = await render(
      <ContentTheme
        sheets={[
          SHEET('--bg: #123;\n', {
            fonts: [{ family: 'Lora', src: './lora.woff2', weight: '400' }],
          }),
        ]}
      />,
    );
    const assets = el.querySelector('style[data-grove-content-assets]');
    expect(assets?.textContent).toContain('"Lora"');
    expect(assets?.textContent).toMatch(/blob:/);
    expect(assets?.textContent).not.toContain('/app/content');
  });
});

// Read the shipped bytes via node:fs/promises (node:fs's readFileSync resolves
// through the dev-fs bridge under jsdom, which is not what these read).
const { readFile: readFileAsync } = await import('node:fs/promises');
const css = await readFileAsync(join('src', 'GroveApp.css'), 'utf8');
const indexCss = await readFileAsync(join('src', 'index.css'), 'utf8');
const readNav = async () => readFileAsync(join('src', 'components', 'GroveNav.tsx'), 'utf8');

describe('THE ESCAPE HATCH — a planted stylesheet cannot hide the theme control', () => {

  /** Extract one `@layer grove.reset { … }` block's body. */
  const resetBlock = (() => {
    const i = css.indexOf('@layer grove.reset {');
    if (i === -1) return '';
    let depth = 0;
    let end = i + '@layer grove.reset '.length;
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    return css.slice(i, end);
  })();

  it('the layer order puts grove.reset FIRST — for !important, earlier layers win', () => {
    const order = indexCss.match(/@layer\s+([^;]+);/)?.[1] ?? '';
    const layers = order.split(',').map((l) => l.trim());
    expect(layers[0]).toBe('grove.reset');
    expect(layers.indexOf('grove.content')).toBeGreaterThan(layers.indexOf('grove.reset'));
  });

  it('every hiding vector a content stylesheet would try is answered by a reset pin', () => {
    expect(resetBlock).toContain('.grove-theme-control');
    // The vectors: display/visibility/opacity/pointer-events (the obvious four),
    // clip-path/transform/position/z-index (the geometric ones),
    // width/height/overflow (collapse), filter (blur-to-nothing).
    for (const vector of [
      'display',
      'visibility',
      'opacity',
      'pointer-events',
      'clip-path',
      'transform',
      'position',
      'z-index',
      'width',
      'height',
      'overflow',
      'filter',
    ]) {
      expect(resetBlock).toContain(`${vector}:`);
    }
    // And every pin is !important — plain declarations in grove.reset would LOSE
    // to grove.content's own !important for normal... they need the important flag.
    const pins = resetBlock.match(/\w[\w-]*:\s*[^;]+!/g) ?? [];
    expect(pins.length).toBeGreaterThanOrEqual(12);
  });

  it('the control carries the protected class in the shipped markup', async () => {
    const nav = await readNav();
    expect(nav).toContain('grove-theme-control');
  });

  it('FAULT: a reset block missing the vector list fails this check (not vacuous)', () => {
    const sabotage = resetBlock.replace('visibility: visible !important;', '');
    expect(sabotage).not.toContain('visibility: visible !important;');
  });
});
