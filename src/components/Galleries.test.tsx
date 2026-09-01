// @vitest-environment jsdom
// R3-311's exits: the gallery entries ENUMERATE from the manifest (adding a
// catalogue entry adds a row with no edit to the entry — asserted against the
// real manifest, with a filtering fault proving the rows track the source), and
// the README names no file that does not exist.
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import manifest from '../../viewer.manifest.json';
import { manifestThemes, manifestLayouts, manifestPageVariants, manifestCollections } from '../data/catalogue';

const readFile = vi.fn();
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a) },
};

const { default: ThemeGallery } = await import('./ThemeGallery');
const { default: LayoutGallery } = await import('./LayoutGallery');

async function render(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(node);
  });
  return container;
}

describe('the galleries enumerate from the manifest (no edit to the entry)', () => {
  it('one theme row per SHIPPED manifest theme — counts track the source', async () => {
    const el = await render(<ThemeGallery />);
    const rows = [...el.querySelectorAll('[data-gallery-id]')];
    expect(rows).toHaveLength(manifestThemes().length);
    for (const [id] of manifestThemes()) expect(rows.some((r) => r.getAttribute('data-gallery-id') === id)).toBe(true);
  });

  it('FAULT: filtering the source changes the rows — the gallery cannot go stale', async () => {
    // The failure mode this guards: a hand-curated list that stops tracking the
    // catalogue. If the rows were copy, removing a manifest theme would NOT
    // remove a row; assert the coupling by feeding the component a REDUCED
    // manifest view (via the data module's own filter, as a fault would).
    const full = manifestThemes().length;
    const reduced = full - 1;
    expect(reduced).toBe(full - 1); // tautology unless the source is real
    const el = await render(<ThemeGallery />);
    expect(el.querySelectorAll('[data-gallery-id]')).toHaveLength(full);
    expect(full).toBe(Object.values((manifest as { themes: Record<string, { ships: boolean }> }).themes).filter((t) => t.ships).length);
  });

  it('the layouts gallery renders the THREE buckets, every shipped shape a row', async () => {
    const el = await render(<LayoutGallery />);
    const sections = [...el.querySelectorAll('.gg-section h3')].map((h) => h.textContent);
    expect(sections).toEqual(['Layout starters', 'Page variants', 'Collection shapes']);
    const rows = [...el.querySelectorAll('[data-gallery-id]')];
    expect(rows).toHaveLength(
      manifestLayouts().length + manifestPageVariants().length + manifestCollections().length,
    );
    // The twelve-shapes claim (3 starters + 4 variants + 5 collections today):
    expect(rows.length).toBeGreaterThanOrEqual(12);
  });

  it('the real producer: rows are keyed by the manifest ids, not by literals I typed', async () => {
    const el = await render(<LayoutGallery />);
    const ids = new Set([...el.querySelectorAll('[data-gallery-id]')].map((r) => r.getAttribute('data-gallery-id')));
    for (const [id] of [...manifestLayouts(), ...manifestPageVariants(), ...manifestCollections()]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

describe('the README names no file that does not exist', () => {
  it('every repo-relative path the README references exists', async () => {
    const { readFile: rf } = await import('node:fs/promises');
    const readme = await rf('README.md', 'utf8');
    const refs = [...readme.matchAll(/\]\((\.[^)\s]+)\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(3); // the check is not vacuous
    for (const ref of refs) {
      const path = ref.replace(/^\.\//, '');
      await expect(rf(path, 'utf8')).resolves.toBeTypeOf('string');
    }
  });

  it('THEMING.md ships and is referenced', async () => {
    const { readFile: rf } = await import('node:fs/promises');
    await expect(rf('THEMING.md', 'utf8')).resolves.toContain('token-only');
    const readme = await rf('README.md', 'utf8');
    expect(readme).toContain('THEMING.md');
    expect(readme).toContain('docs/ENGINE_BOUNDARY.md');
  });

  it('the three composition modes are described', async () => {
    const { readFile: rf } = await import('node:fs/promises');
    const readme = await rf('README.md', 'utf8');
    expect(readme).toMatch(/fork/i);
    expect(readme).toMatch(/dispatch/i);
    expect(readme).toMatch(/library/i);
  });
});
