// @vitest-environment jsdom
// The `logo:` key through the real nav: no logo keeps the gradient tile; a readable
// logo replaces it with the image, read at the path beside the DECLARING entry (home),
// with no corpus path in the markup. A missing or unreadable logo falls back to the
// tile through EntryImage's own degrade contract, pinned in EntryImage.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { GroveShellContext, type GroveShell } from '../lib/shell';
import { resolveSiteLogo } from '../lib/siteLogo';

// The fs slice MountImage reads through (see EntryImage.test.tsx): the shared-fs global.
const readFile = vi.fn();
(globalThis as { __sandpackSharedFs?: unknown }).__sandpackSharedFs = {
  promises: { readFile: (...a: unknown[]) => readFile(...a) },
};

const { default: GroveNav } = await import('./GroveNav');

const NAV = { outerHref: 'https://example.immediately.run/app/x', navigationState: { sandboxPath: '/app/x' } };
const HOME = '/mnt/abc123def456/tickets/home.mdx';
const TICKET = '/mnt/abc123def456/tickets/DIB-1.md';
const PNG = 'iVBORw0KGgo=';

const shell = (siteLogo: GroveShell['siteLogo']): GroveShell =>
  ({
    siteTitle: 'Dibber',
    siteLogo,
    navItems: [],
    entryKey: TICKET,
    writable: false,
    menuOpen: false,
    setMenuOpen: vi.fn(),
    setSearchOpen: vi.fn(),
    setDrawerOpen: vi.fn(),
  }) as unknown as GroveShell;

async function renderNav(siteLogo: GroveShell['siteLogo']) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host).render(
      <TinkerableContext.Provider value={NAV as never}>
        <GroveShellContext.Provider value={shell(siteLogo)}>
          <GroveNav />
        </GroveShellContext.Provider>
      </TinkerableContext.Provider>,
    );
  });
  return host.querySelector('.grove-brand')!;
}

beforeEach(() => readFile.mockReset());


describe('the site mark', () => {
  it('is the gradient tile when the corpus declares no logo', async () => {
    const brand = await renderNav(null);
    expect(brand.querySelector('span.tile')).not.toBeNull();
    expect(brand.querySelector('img')).toBeNull();
    expect(brand.textContent).toBe('Dibber');
    expect(readFile).not.toHaveBeenCalled();
  });

  it("is home's logo, read beside home, with no corpus path in the markup", async () => {
    readFile.mockResolvedValue(PNG);
    const brand = await renderNav(resolveSiteLogo(TICKET, {}, HOME, { logo: 'icon.webp' }));
    expect(readFile.mock.calls.map((c) => String(c[0]))).toEqual(['/mnt/abc123def456/tickets/icon.webp']);
    const img = brand.querySelector('img.tile');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('alt')).toBe('');
    expect(brand.querySelector('span.tile')).toBeNull();
    expect(brand.innerHTML).not.toContain('abc123def456');
  });
});
