// The layout-starter gate (R3-309, bucket A) — every starter under
// `content/_layouts/` rendered through the REAL published safe renderer with
// Grove's own SAFE_MDX map, exactly what SafeLayout sends a `_layout.mdx` through
// in interpreter mode. Proven by fault injection on all quiet failure modes.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSafeMdast, renderMdast } from '@immediately-run/sdk/safeContent/index';
import { renderToStaticMarkup } from 'react-dom/server';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { SAFE_MDX } from '../mdxComponents';
import { GroveShellContext, OutletContext, type GroveShell } from './shell';
import {
  starterViolations,
  STARTER_MARKERS,
  stripStarterFrontmatter,
} from './starterSweep';

const LAYOUTS = join(process.cwd(), 'content', '_layouts');

/** A complete-enough shell for the chrome primitives to render statically (they
 *  read state through useShell; a bare render throws in the provider check, which
 *  is correct — the sweep must run them the way the wiki does, with state). */
const SHELL: GroveShell = {
  theme: 'default',
  setTheme: () => {},
  light: false,
  setLight: () => {},
  menuOpen: false,
  setMenuOpen: () => {},
  searchOpen: false,
  setSearchOpen: () => {},
  drawerOpen: false,
  setDrawerOpen: () => {},
  vw: 'desktop',
  navMode: 'side',
  writable: false,
  openEditor: () => {},
  editBusy: false,
  editHint: '',
  siteTitle: 'Grove',
  safe: false,
  navItems: [],
  entryKey: '/app/content/index.mdx',
  includePath: 'index.mdx',
  layout: 'doc',
  showRails: true,
  mins: 0,
  missing: false,
  directory: { status: 'idle' },
} as unknown as GroveShell;

/** The real interpreter render, with the Outlet sentinel a starter's `<Outlet/>`
 *  renders — a static render has no inner page, so the sentinel is how presence
 *  is distinguished from a tag that quietly collapsed to nothing. The host
 *  navigation provider stands in for the sandbox, exactly as it would supply it. */
const NAV = {
  outerHref: 'https://example.immediately.run/app/x',
  navigationState: { sandboxPath: '/app/x' },
};

const renderBody = async (body: string): Promise<string> => {
  const tree = await parseSafeMdast(body);
  const el = renderMdast(tree, { components: SAFE_MDX as never });
  return renderToStaticMarkup(
    <TinkerableContext.Provider value={NAV as never}>
      <GroveShellContext.Provider value={SHELL}>
        <OutletContext.Provider value={<p>OUTLET-SENTINEL</p>}>{el as never}</OutletContext.Provider>
      </GroveShellContext.Provider>
    </TinkerableContext.Provider>,
  );
};

const knownTags = new Set(Object.keys(SAFE_MDX) as string[]);

describe('the layout-starter sweep (R3-309 bucket A)', () => {
  const starters = readdirSync(LAYOUTS).filter((f) => f.endsWith('.mdx'));

  it('found the starters — a sweep that examines nothing defends nothing (checked > 0)', () => {
    expect(starters.length).toBe(3);
    expect(new Set(starters.map((f) => f.replace(/\.mdx$/, '')))).toEqual(
      new Set(['shell', 'section', 'hero']),
    );
  });

  it.each(starters)('%s survives the real safe renderer', async (file) => {
    const src = readFileSync(join(LAYOUTS, file), 'utf8');
    const violations = await starterViolations(src, { render: renderBody, knownTags });
    expect(violations).toEqual([]);
    // And the Outlet sentinel came through: the starter actually frames a page.
    expect(await renderBody(stripStarterFrontmatter(src))).toContain('OUTLET-SENTINEL');
  });

  it('the hero starter selects the top arrangement and omits the sidebar', async () => {
    // Exit criterion: a shell starter selecting `top` renders without the sidebar.
    // The hero IS that starter — `nav: top` in frontmatter, no `<GroveSidebar/>`
    // in the body.
    const src = readFileSync(join(LAYOUTS, 'hero.mdx'), 'utf8');
    expect(src).toMatch(/^nav:\s*top$/m);
    expect(stripStarterFrontmatter(src)).not.toContain('<GroveSidebar');
    const markup = await renderBody(stripStarterFrontmatter(src));
    expect(markup).not.toContain('grove-sidebar');
  });

  // ── fault injection: each quiet failure mode, planted and caught ────────────
  const GOOD = readFileSync(join(LAYOUTS, 'shell.mdx'), 'utf8');

  it('baseline passes, so the injections below mean the PLANT', async () => {
    expect(await starterViolations(GOOD, { render: renderBody, knownTags })).toEqual([]);
  });

  it('a planted raw-HTML block is caught (it renders as literal angle brackets, never markup)', async () => {
    // The shape safeRender.test.ts proved: a raw `<script>` survives as ESCAPED TEXT.
    // Starters carry no raw HTML, so ANY '<' in the visible text is this failure —
    // and the script must not have executed, either.
    const planted = stripStarterFrontmatter(GOOD).replace(
      '<GroveFooter />',
      '<script>globalThis.__pwnedByStarter = 1</script>',
    );
    const v = await starterViolations(planted, { render: renderBody, knownTags });
    expect(v.some((x) => /angle brackets/.test(x))).toBe(true);
    expect((globalThis as Record<string, unknown>).__pwnedByStarter).toBeUndefined();
  });

  it('a planted import line is caught (it renders as visible prose)', async () => {
    const planted = stripStarterFrontmatter(GOOD).replace(
      '<GroveNav />',
      'import GroveNav from "./components/GroveNav"\n\n<GroveNav />',
    );
    const v = await starterViolations(planted, { render: renderBody, knownTags });
    expect(v.some((x) => /import\/export line/.test(x))).toBe(true);
  });

  it('a planted off-vocabulary wrapper is caught (it collapses to its children)', async () => {
    const planted = stripStarterFrontmatter(GOOD).replace(
      '<GroveFooter />',
      '<NotARealWrapper className="x">\n\nTrapped text.\n\n</NotARealWrapper>',
    );
    const v = await starterViolations(planted, { render: renderBody, knownTags });
    expect(v.some((x) => /not in the component map/.test(x))).toBe(true);
  });

  it('a planted JSX comment is caught — under the interpreter its braces are prose', async () => {
    // The shipped sample layouts carry `{/* … */}` teaching comments, which the
    // COMPILED path drops and the interpreter renders as literal text. Starters
    // must not teach that: their teaching lives in frontmatter, which never renders.
    const planted = stripStarterFrontmatter(GOOD).replace(
      '<GroveNav />',
      '{/* a teaching comment */}\n\n<GroveNav />',
    );
    const v = await starterViolations(planted, { render: renderBody, knownTags });
    expect(v.some((x) => /braces render as visible text/.test(x))).toBe(true);
  });

  it('every marker the sweep keys on exists in the vocabulary it checks', () => {
    for (const tag of Object.keys(STARTER_MARKERS)) {
      expect(knownTags.has(tag)).toBe(true);
    }
  });
});
