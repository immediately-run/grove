// @vitest-environment jsdom
// The appearance control is offered for EVERY theme (R3-308) — the bug this pins
// is "single-polarity by construction": the control used to render only when
// `theme === 'default'`, which is precisely how the alternates stayed
// light/dark-or-nothing. Rendered for a NON-default theme through the real
// component, so the gate cannot quietly come back.
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { GroveShellContext, type GroveShell } from '../lib/shell';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';

const { default: GroveNav } = await import('./GroveNav');

// The SDK's <Link> resolves hrefs against the host navigation state; without a
// provider `outerHref` is undefined and URL construction throws before any
// assertion runs. A minimal provider stands in for the host, exactly as the
// sandbox would supply it.
const NAV = {
  outerHref: 'https://example.immediately.run/app/x',
  navigationState: { sandboxPath: '/app/x' },
};

const mount = async (shell: Partial<GroveShell>) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const full: GroveShell = {
    theme: 'default',
    setTheme: vi.fn(),
    light: false,
    setLight: vi.fn(),
    menuOpen: false,
    setMenuOpen: vi.fn(),
    searchOpen: false,
    setSearchOpen: vi.fn(),
    drawerOpen: false,
    setDrawerOpen: vi.fn(),
    vw: 'desktop',
    navMode: 'top',
    writable: false,
    openEditor: vi.fn(),
    editBusy: false,
    editHint: '',
    siteTitle: 'Grove',
    safe: false,
    navItems: [{ key: 'a', href: '/a', label: 'A' }],
    entryKey: '/a',
    includePath: 'a.mdx',
    layout: 'doc',
    showRails: false,
    mins: 0,
    missing: false,
    directory: { status: 'idle' },
    ...shell,
  } as unknown as GroveShell;
  await act(async () => {
    createRoot(host).render(
      <TinkerableContext.Provider value={NAV as never}>
        <GroveShellContext.Provider value={full}>
          <GroveNav />
        </GroveShellContext.Provider>
      </TinkerableContext.Provider>,
    );
  });
  return host;
};

describe('the theme menu (R3-308 — two independent axes)', () => {
  it('offers the appearance control for a NON-default theme', async () => {
    const host = await mount({ theme: 'pixies', menuOpen: true, light: false });
    const seg = host.querySelector('.gtm__seg');
    expect(seg).not.toBeNull();
    expect(seg!.querySelectorAll('button')).toHaveLength(2);
  });

  it('marks the RESOLVED polarity, not only a reader override', async () => {
    // `light` is the resolved value the shell hands down (lib/themeSelection) —
    // the control must reflect whatever the resolution produced, including the
    // host-driven or preferred cases where no reader override exists.
    const host = await mount({ theme: 'family', menuOpen: true, light: true });
    const on = [...host.querySelectorAll('.gtm__seg button')].find((b) => b.getAttribute('data-on') === '1');
    expect(on?.textContent).toMatch(/Light/);
  });

  it('lists every catalogue theme — the menu is how a reader reaches them', async () => {
    const host = await mount({ menuOpen: true });
    expect(host.querySelectorAll('.gtm__row').length).toBeGreaterThan(1);
  });
});
