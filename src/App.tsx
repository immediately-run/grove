/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import fs from 'fs';
import {
  Include,
  useAllMetadata,
  useFileMetadata,
  useMetadataQuery,
  useMounts,
} from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import {
  CONTENT_DIR,
  HOME_KEY,
  isContentEntry,
  keyToFsPath,
  keyToHref,
  keyToInclude,
  sandboxPathToKey,
} from './lib/content';
import { queryPaths, readingTime, stripFrontmatter } from './lib/wiki';
import { layoutChainForKey } from './lib/layout';
import { GroveShellContext, OutletContext } from './lib/shell';
import type { GroveShell, NavItem } from './lib/shell';
import PageView from './components/PageView';
import DefaultLayout from './components/DefaultLayout';
import Search from './components/Search';
import Drawer from './components/Drawer';
import GroveAgent from './components/GroveAgent';

declare const module: any;

function readPref(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function writePref(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

// Build the nested render for a layout chain (outermost first). Each layer wraps
// its `_layout.mdx` (or the built-in <DefaultLayout/>) in an OutletContext whose
// value is the node one level inward — so `<Outlet/>` inside a layer renders the
// next layer, and the innermost <Outlet/> renders the page (<PageView/>).
function renderLayers(chain: string[], useDefault: boolean): ReactNode {
  let node: ReactNode = <PageView />;
  if (useDefault) {
    return <OutletContext.Provider value={node}><DefaultLayout /></OutletContext.Provider>;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    const inner = node;
    node = (
      <OutletContext.Provider value={inner} key={chain[i]}>
        <Include filename={chain[i]} baseModule={module} />
      </OutletContext.Provider>
    );
  }
  return node;
}

export default function App() {
  const ctx = useContext(TinkerableContext) as any;
  const sandboxPath: string = ctx?.navigationState?.sandboxPath || '/';
  const mounts = useMounts() as any[];

  const [theme, setTheme] = useState(() => readPref('grove:theme') || 'default');
  const [light, setLight] = useState(() => readPref('grove:appearance') === 'light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mins, setMins] = useState(0);
  const [vw, setVw] = useState<'mobile' | 'desktop'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches ? 'mobile' : 'desktop'
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const on = () => setVw(mq.matches ? 'mobile' : 'desktop');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  useEffect(() => writePref('grove:theme', theme), [theme]);
  useEffect(() => writePref('grove:appearance', light ? 'light' : 'dark'), [light]);

  // ⌘K / Ctrl-K opens search.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const writable = mounts?.some((m) => m.type === 'worktree' && m.mode !== 'ro') ?? false;

  const entryKey = sandboxPathToKey(sandboxPath) || HOME_KEY;
  const includePath = keyToInclude(entryKey);
  const meta = useFileMetadata(entryKey) as any;
  // The site brand is a wiki-wide constant, so read it from the home entry's
  // `site` frontmatter — not the current entry's (which only home would carry),
  // else the brand flips to the 'Grove' fallback on every sub-page.
  const homeMeta = useFileMetadata(HOME_KEY) as any;
  const layout: string = meta?.layout || 'doc';
  const navMode: 'top' | 'side' = 'side';
  const siteTitle: string = meta?.site || homeMeta?.site || 'Grove';
  // Interpreter mode (TRUST_MODES §5 / R3-213): render this entry's body through the
  // non-executable safe renderer instead of the compiled `<Include>` path.
  //
  // Read from the HOME entry (wiki-wide) OR this entry (per-entry), because the two
  // answer different questions. Wiki-wide is the interpreter declaration — a Grove
  // rendering foreign content sets it there. Per-entry exists because this corpus has
  // one document, the non-executable proof page, whose whole point is planted code that
  // must NOT execute: on the compiled path that page doesn't just look wrong, it runs
  // (R3-252). A document that is only correct as data says so itself.
  const safe: boolean = homeMeta?.render === 'safe' || meta?.render === 'safe';
  const showRails = layout === 'doc' && !meta?.view;

  // Existence / 404: the whole index tells us if a followed link is dead. Layout
  // files are structure, not entries, so they're excluded here (and everywhere).
  const allKeysQuery = useCallback((fm: Record<string, any>) => Object.keys(fm).filter(isContentEntry), []);
  const idx = useMetadataQuery(allKeysQuery);
  const keys: string[] = queryPaths(idx);
  const indexLoaded = keys.length > 0;
  const missing = indexLoaded && !keys.includes(entryKey);

  // The layout chain wrapping this entry (outermost first). Needs the full
  // frontmatter map (folder convention + `frame` override), so it reads the whole
  // metadata store and re-derives when the content set or the entry changes.
  const allMeta = useAllMetadata() as Record<string, Record<string, unknown>>;
  const chain: string[] = layoutChainForKey(entryKey, allMeta);
  const frameNone = meta?.frame === 'none' || meta?.frame === false;
  const useDefault = chain.length === 0 && !frameNone;

  // Reading time: read the entry body once per entry.
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMins(0);
    fs.promises
      .readFile(keyToFsPath(entryKey), 'utf8')
      .then((b: unknown) => {
        if (active) setMins(readingTime(stripFrontmatter(String(b))));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [entryKey]);

  const navQuery = useCallback(
    (fm: Record<string, any>) =>
      Object.keys(fm)
        .filter((p) => isContentEntry(p) && Array.isArray(fm[p]?.tags) && fm[p].tags.includes('ui/nav'))
        .sort((a, b) => (fm[a].order ?? 999) - (fm[b].order ?? 999))
        .map((p) => [p, fm[p]?.nav || (fm[p]?.title || '').replace(/\.$/, '')].join('\t')),
    []
  );
  const navResult = useMetadataQuery(navQuery);
  const navRows: string[] = queryPaths(navResult);
  const navItems: NavItem[] = navRows.map((r) => {
    const [key, label] = r.split('\t');
    return { key, href: keyToHref(key), label };
  });

  // Closest-match suggestion for a 404 (shared namespace or name overlap).
  const suggestion = missing
    ? keys
        .map((k) => ({ k, score: overlap(k, entryKey) }))
        .sort((a, b) => b.score - a.score)[0]?.k
    : undefined;

  const shell: GroveShell = {
    theme,
    setTheme,
    light,
    setLight,
    menuOpen,
    setMenuOpen,
    searchOpen,
    setSearchOpen,
    drawerOpen,
    setDrawerOpen,
    vw,
    navMode,
    writable,
    siteTitle,
    safe,
    navItems,
    entryKey,
    includePath,
    layout,
    showRails,
    mins,
    missing,
    suggestion,
  };

  return (
    <GroveShellContext.Provider value={shell}>
      <div
        className="grove-root"
        data-vw={vw}
        data-nav={navMode}
        data-grove-theme={theme === 'default' ? undefined : theme}
        data-theme={theme === 'default' && light ? 'light' : undefined}
      >
        <div className="device__scroll">
          <div className="grove-shell" data-nav={frameNone ? undefined : navMode}>
            {renderLayers(chain, useDefault)}
          </div>
        </div>

        {searchOpen ? <Search onClose={() => setSearchOpen(false)} /> : null}
        {drawerOpen ? (
          <Drawer
            siteTitle={siteTitle}
            nav={navItems.map((n) => ({ href: n.href, label: n.label, cur: n.key === entryKey }))}
            onClose={() => setDrawerOpen(false)}
          />
        ) : null}
        <GroveAgent writable={writable} entryKey={entryKey} entryTitle={(meta?.title || 'this entry').replace(/\.$/, '')} />
      </div>
    </GroveShellContext.Provider>
  );
}

// Crude closest-match score for the 404 suggestion: shared namespace + name chars.
function overlap(a: string, b: string): number {
  const an = a.replace(CONTENT_DIR, '').replace(/\.mdx?$/, '');
  const bn = b.replace(CONTENT_DIR, '').replace(/\.mdx?$/, '');
  const aNs = an.split('/').slice(0, -1).join('/');
  const bNs = bn.split('/').slice(0, -1).join('/');
  let score = aNs && aNs === bNs ? 5 : 0;
  const aName = an.split('/').pop() || '';
  const bName = bn.split('/').pop() || '';
  for (const ch of new Set(aName)) if (bName.includes(ch)) score++;
  return score;
}
