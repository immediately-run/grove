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

const fullShell = (shell: Partial<GroveShell>): GroveShell =>
  ({
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
  }) as unknown as GroveShell;

const mount = async (shell: Partial<GroveShell>) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const full: GroveShell = fullShell(shell);
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

describe('the theme menu contract (R3-608)', () => {
  const openMenu = async (over: Partial<GroveShell>) => {
    const host = await mount({ menuOpen: true, theme: 'default', light: false, ...over });
    return host;
  };

  it('Escape returns focus to the theme button (and closes, via the shell state it drives)', async () => {
    // The shell's setMenuOpen drives the re-render like the real one would:
    // focus-return rides the hook's cleanup when the menu actually closes.
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const shell = { menuOpen: false, theme: 'default', light: false, setMenuOpen: vi.fn() } as Parameters<typeof fullShell>[0];
    await act(async () => {
      root.render(
        <TinkerableContext.Provider value={NAV as never}>
          <GroveShellContext.Provider value={fullShell(shell)}>
            <GroveNav />
          </GroveShellContext.Provider>
        </TinkerableContext.Provider>,
      );
    });
    const themeButton = host.querySelector('.grove-theme-control') as HTMLButtonElement;
    themeButton.focus();
    const renderWith = (menuOpen: boolean) =>
      act(async () => {
        root.render(
          <TinkerableContext.Provider value={NAV as never}>
            <GroveShellContext.Provider value={fullShell({ ...shell, menuOpen })}>
              <GroveNav />
            </GroveShellContext.Provider>
          </TinkerableContext.Provider>,
        );
      });
    shell.setMenuOpen = vi.fn(((v: boolean) => {
      if (v === false) void renderWith(false);
    }) as GroveShell['setMenuOpen']);
    await renderWith(true);
    // focus-in: the menu's first control holds focus.
    const first = host.querySelector('[role="menuitemradio"]') as HTMLElement;
    expect(document.activeElement).toBe(first);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(shell.setMenuOpen).toHaveBeenCalledWith(false);
    expect(host.querySelector('.grove-theme-menu')).toBeNull(); // the menu closed
    expect(document.activeElement).toBe(themeButton);
  });

  it('arrows move among the menuitems and SELECT the radio they land on', async () => {
    const setTheme = vi.fn();
    const host = await openMenu({ setTheme });
    const items = [...host.querySelectorAll('[role^="menuitem"]')] as HTMLElement[];
    expect(items.length).toBeGreaterThanOrEqual(3); // themes + dark/light
    items[0].focus();
    await act(async () => {
      items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(items[1]);
    // The landed radio is selected when it was not already checked.
    expect(setTheme).toHaveBeenCalledTimes(items[1].getAttribute('aria-checked') === 'true' ? 0 : 1);
  });
});

describe('the theme menu Tab contract (R3-608 round 2)', () => {
  it('Tab LEAVES the menu and closes it — never stranded over the scrim', async () => {
    let renderWith: (menuOpen: boolean) => Promise<void> = async () => undefined;
    const shell = { menuOpen: false, theme: 'default', light: false, setMenuOpen: vi.fn() } as Parameters<typeof fullShell>[0];
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    renderWith = (menuOpen: boolean) =>
      act(async () => {
        root.render(
          <TinkerableContext.Provider value={NAV as never}>
            <GroveShellContext.Provider value={fullShell({ ...shell, menuOpen })}>
              <GroveNav />
            </GroveShellContext.Provider>
          </TinkerableContext.Provider>,
        );
      });
    shell.setMenuOpen = vi.fn(((v: boolean) => {
      if (v === false) void renderWith(false);
    }) as GroveShell['setMenuOpen']);
    await renderWith(true);
    expect(host.querySelector('.grove-theme-menu')).toBeTruthy();
    const first = host.querySelector('[role="menuitemradio"]') as HTMLElement;
    await act(async () => {
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(shell.setMenuOpen).toHaveBeenCalledWith(false);
    expect(host.querySelector('.grove-theme-menu')).toBeNull(); // closed, not stranded
  });
});
