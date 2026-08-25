/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import fs from 'fs';
import type { Metadata } from '@immediately-run/sdk';
import {
  Include,
  useAllMetadata,
  useFileMetadata,
  useMetadataQuery,
  useMounts,
} from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { LinkSpaceContext } from '@immediately-run/sdk/linkSpace';
import {
  contentDir,
  homeKey,
  isContentEntry,
  keyToFsPath,
  keyToHref,
  keyToInclude,
  sandboxPathToKey,
} from './lib/content';
import { queryPaths, queryRecords, readingTime, stripFrontmatter } from './lib/wiki';
import { navQuery } from './lib/queries';
import type { NavRecord } from './lib/queries';
import { layoutChainForKey } from './lib/layout';
import { folderIndexKey } from './lib/directory';
import { useDirectoryListing } from './hooks/useDirectoryListing';
import { getContentRoot, isDispatched } from './lib/contentRoot';
import { GroveShellContext, OutletContext } from './lib/shell';
import type { GroveShell, NavItem } from './lib/shell';
import PageView from './components/PageView';
import SafeLayout from './components/SafeLayout';
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
//
// `safe` picks the RENDERER for each layer, exactly as it does for entry bodies in
// <PageView/> (R3-263). Before this, every layer went through <Include> whatever the wiki
// declared — so an interpreter-mode wiki still EXECUTED author JavaScript out of its
// `_layout.mdx`, and the non-executable guarantee had a hole in the shell rather than in
// the entries. It is also what makes the chain work at all under dispatch: <Include>
// evaluates an app-source module, which a layout resident in a content mount is not.
function renderLayers(chain: string[], useDefault: boolean, safe: boolean): ReactNode {
  let node: ReactNode = <PageView />;
  if (useDefault) {
    return <OutletContext.Provider value={node}><DefaultLayout /></OutletContext.Provider>;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    const inner = node;
    node = (
      <OutletContext.Provider value={inner} key={chain[i]}>
        {safe ? <SafeLayout layoutKey={chain[i]} /> : <Include filename={chain[i]} baseModule={module} />}
      </OutletContext.Provider>
    );
  }
  return node;
}

/**
 * The wiki itself: routing, chrome, and the entry render. Everything here reads the
 * content root, so it may only mount once that root is settled — which is why the
 * default export of `App.tsx` is a gate in front of it rather than this component
 * (R3-169: under dispatch the root is a runtime value, not `/app/content/`).
 */
export default function GroveWiki({ readOnly = false }: { readOnly?: boolean }) {
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

  // ⚠ TEMPORARY, and not a design: dispatched content IS writable — R3-266.
  //
  // The affordance below calls `requestEdit`, which is **self-scoped by contract** ("v1
  // supports only a repo-relative path in the CURRENT repo … editing a file in one of your
  // mounts is the `edit-file` task, not this"). Under dispatch the corpus is a mount, so
  // that call would edit GROVE rather than the corpus on screen. Offering it would be
  // wrong; withholding it *as a design* is also wrong, and this comment exists so the next
  // reader does not conclude the second from the first.
  //
  // The fix is a verb swap, not a withheld capability: delegate the entry to
  // `invokeTask('edit-file', { file: capFile({ mountId, relPath }, { mode: 'rw' }) })`,
  // declare `invokes: edit-file`, and gate on the CORPUS MOUNT's mode rather than on the
  // packaging. A task callee already holds the minted delegated grant, so nothing new has
  // to be minted. Tracked in R3-266; `docs/specs/REPO_CONTENT_DISPATCH_SPEC.mdx` §5.
  const writable =
    !isDispatched() && !readOnly && (mounts?.some((m) => m.type === 'worktree' && m.mode !== 'ro') ?? false);

  const routeKey = sandboxPathToKey(sandboxPath) || homeKey();
  // The site brand is a wiki-wide constant, so read it from the home entry's
  // `site` frontmatter — not the current entry's (which only home would carry),
  // else the brand flips to the 'Grove' fallback on every sub-page.
  const homeMeta = useFileMetadata(homeKey()) as any;
  // Existence / 404: the whole index tells us if a followed link is dead. Layout
  // files are structure, not entries, so they're excluded here (and everywhere).
  const allKeysQuery = useCallback((fm: Record<string, any>) => Object.keys(fm).filter(isContentEntry), []);
  const idx = useMetadataQuery(allKeysQuery);
  const keys: string[] = queryPaths(idx);
  const indexLoaded = keys.length > 0;

  // A URL that names a FOLDER is a legitimate address, and there are two right answers
  // to it — in this order:
  //
  //   1. the folder's own `index.mdx`, if the author wrote one. Curation beats
  //      generation, and it is how a corpus overrides the listing per folder without
  //      touching the engine;
  //   2. otherwise the generated <DirectoryView> — the entries and assets that are
  //      actually there.
  //
  // Both used to be "No entry at …", which is the one answer that is false.
  const folderIndex = indexLoaded && !keys.includes(routeKey) ? folderIndexKey(routeKey, keys) : null;
  const entryKey = folderIndex ?? routeKey;
  const includePath = keyToInclude(entryKey);
  const meta = useFileMetadata(entryKey) as any;

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


  // Ask the filesystem only about a key the ENTRY index already missed: an ordinary page
  // render performs no extra I/O, and this readdir replaces a 404 that was about to
  // render anyway. The index cannot answer it — it holds `.md`/`.mdx` only, so a folder
  // of assets is invisible to it.
  const unresolved = indexLoaded && !keys.includes(entryKey);
  const directory = useDirectoryListing(unresolved ? entryKey : null);
  const missing = unresolved && directory.status === 'none';

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

  // Records, not tab-encoded paths (R3-276a): the query selects `{ path, label }`
  // and the hook returns them as-is — no fake-path encoding round-trip.
  const navResult = useMetadataQuery<Metadata, NavRecord>(navQuery);
  const navItems: NavItem[] = queryRecords<NavRecord>(navResult).map(({ path, label }) => ({
    key: path,
    href: keyToHref(path),
    label,
  }));

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
    directory,
  };

  return (
    // R3-277b: declare the enclosing corpus for the platform's link-space consumers
    // (the shared resolver's corpus-anchored absolute + `$fs:` handling read this).
    <LinkSpaceContext.Provider value={{ corpusRoot: getContentRoot() }}>
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
            {renderLayers(chain, useDefault, safe)}
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
    </LinkSpaceContext.Provider>
  );
}

// Crude closest-match score for the 404 suggestion: shared namespace + name chars.
function overlap(a: string, b: string): number {
  const an = a.replace(contentDir(), '').replace(/\.mdx?$/, '');
  const bn = b.replace(contentDir(), '').replace(/\.mdx?$/, '');
  const aNs = an.split('/').slice(0, -1).join('/');
  const bNs = bn.split('/').slice(0, -1).join('/');
  let score = aNs && aNs === bNs ? 5 : 0;
  const aName = an.split('/').pop() || '';
  const bName = bn.split('/').pop() || '';
  for (const ch of new Set(aName)) if (bName.includes(ch)) score++;
  return score;
}
