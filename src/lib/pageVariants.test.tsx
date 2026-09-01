// The bucket-B gate + the value-3 invariant (R3-309): page variants are CSS
// selected by data attributes, so the checks are consistency — every variant the
// CSS implements is reachable, every reachable value has a rule, an undeclared
// value falls back — plus the promise that deleting every `_layout.mdx` still
// yields the full default shell.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import DefaultLayout from '../components/DefaultLayout';
import { resolveNavMode, resolvePageLayout } from './layout';
import { GroveShellContext, OutletContext, type GroveShell } from './shell';

const css = readFileSync(join(process.cwd(), 'src', 'GroveApp.css'), 'utf8');

const dataLayoutRules = new Set([...css.matchAll(/\[data-layout="([^"]+)"\]/g)].map((m) => m[1]!));
const dataNavRules = new Set([...css.matchAll(/\[data-nav="([^"]+)"\]/g)].map((m) => m[1]!));

describe('page variants — every declared value has a rule, every rule is reachable (bucket B)', () => {
  it('the CSS implements exactly the three layout variants the engine can emit', () => {
    // resolvePageLayout is the closed emitter: doc | post | full. A CSS rule for a
    // fourth value would be dead selectors; an emitter value without a rule would
    // be a silently unstyled page. Pinned together so neither can drift alone.
    expect(dataLayoutRules).toEqual(new Set(['doc', 'post', 'full']));
    for (const v of ['doc', 'post', 'full'] as const) {
      expect(resolvePageLayout({ layout: v })).toBe(v);
    }
  });

  it('an undeclared layout value falls back to the reference look, never an unstyled page', () => {
    expect(resolvePageLayout(undefined)).toBe('doc');
    expect(resolvePageLayout({})).toBe('doc');
    expect(resolvePageLayout({ layout: 'wide-but-unimplemented' })).toBe('doc');
    expect(resolvePageLayout({ layout: 7 })).toBe('doc');
  });

  it('`frame: none` is the fourth variant and needs no layout rule — it removes the shell', () => {
    // Bare-by-frontmatter is handled in GroveWiki (frameNone drops the chain); it
    // selects no [data-layout] variant, so its absence from the CSS set is the
    // contract, asserted here so a future "bare" CSS rule is a visible decision.
    expect(dataLayoutRules.has('none')).toBe(false);
  });
});

describe('nav arrangement — selectable, with both polarities real (R3-309)', () => {
  it("'side' carries CSS rules; 'top' is the base .grove-shell grid they override", () => {
    // The top arrangement is what .grove-shell IS (base grid); [data-nav='side'] is
    // the variant. So the consistency check is: side has rules, and the base
    // block exists for top to fall through to.
    expect(dataNavRules.has('side')).toBe(true);
    expect(css).toMatch(/^\.grove-shell\s*\{/m);
  });

  it('resolveNavMode: declared top selects top; anything else falls back to side', () => {
    expect(resolveNavMode({ nav: 'top' })).toBe('top');
    expect(resolveNavMode({ nav: 'side' })).toBe('side');
    expect(resolveNavMode(undefined)).toBe('side');
    expect(resolveNavMode({ nav: 'diagonal' })).toBe('side');
  });
});

describe('deleting every _layout.mdx still yields the full default shell (value 3)', () => {
  it('DefaultLayout renders nav, sidebar, footer AND frames a page at Outlet', () => {
    // Asserted rather than assumed: the whole starter catalogue rests on the
    // promise that starters are a convenience — remove them all and a bare folder
    // of .mdx is still a whole site.
    const SHELL = { navMode: 'side', vw: 'desktop', navItems: [] } as unknown as GroveShell;
    const NAV = {
      outerHref: 'https://example.immediately.run/app/x',
      navigationState: { sandboxPath: '/app/x' },
    };
    const html = renderToStaticMarkup(
      <TinkerableContext.Provider value={NAV as never}>
        <GroveShellContext.Provider value={SHELL}>
          <OutletContext.Provider value={<p>THE-PAGE</p>}>
            <DefaultLayout />
          </OutletContext.Provider>
        </GroveShellContext.Provider>
      </TinkerableContext.Provider>,
    );
    expect(html).toContain('grove-nav');
    expect(html).toContain('grove-sidebar');
    expect(html).toContain('grove-footer');
    expect(html).toContain('THE-PAGE');
  });
});
