/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useContext, useEffect, useState } from 'react';
import fs from 'fs';
import {
  Include,
  Link,
  requestEdit,
  useFileMetadata,
  useMetadataQuery,
  useMounts,
} from '@immediately-run/sdk';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import {
  CONTENT_DIR,
  HOME_KEY,
  keyToFsPath,
  keyToHref,
  keyToInclude,
  keyToRepoRel,
  sandboxPathToKey,
} from './lib/content';
import { crumb, queryPaths, readingTime, stripFrontmatter } from './lib/wiki';
import Icon from './components/Icon';
import Toc from './components/Toc';
import Backlinks from './components/Backlinks';
import Sidebar from './components/Sidebar';
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

const THEMES = [
  { id: 'default', label: 'immediately.run', swatch: 'linear-gradient(96deg,#f6f1fb,#f49ad4 46%,#b285f2)' },
  { id: 'pixies', label: 'Pixies', swatch: 'linear-gradient(96deg,#ffe14d,#ff2d8e 50%,#9d29ff)' },
  { id: 'family', label: 'Family journal', swatch: 'linear-gradient(96deg,#f3cf9a,#e09a6a 50%,#c8744f)' },
  { id: 'lotr', label: 'Middle-earth', swatch: 'linear-gradient(96deg,#b89a56,#8a6a36 50%,#4a5a38)' },
];

function EntryHeader({ entryKey, writable, mins }: { entryKey: string; writable: boolean; mins: number }) {
  const meta = useFileMetadata(entryKey) as any;
  const [busy, setBusy] = useState(false);
  if (!meta) return null;
  const tags: string[] = Array.isArray(meta.tags) ? meta.tags.filter((t: string) => !t.startsWith('ui/')) : [];
  const cr = crumb(entryKey);
  const edit = () => {
    setBusy(true);
    requestEdit({ path: keyToRepoRel(entryKey) })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  return (
    <header className="grove-entry-header">
      {cr.includes('/') ? <nav className="crumb">{cr}</nav> : null}
      <h1 className={meta.grad ? 'grad' : ''}>{meta.title || cr}</h1>
      <div className="grove-meta">
        {meta.date && <span>{meta.date}</span>}
        {mins ? <span>→ {mins} min read</span> : null}
        {tags.length ? <span className="dot">·</span> : null}
        {tags.map((t) => (
          <span key={t} className="grove-tag">#{t}</span>
        ))}
        {writable && (
          <button className="grove-edit-affordance" data-busy={busy ? '1' : '0'} onClick={edit}>
            <Icon name="pencil" />
            {busy ? 'Opening editor…' : 'Edit'}
          </button>
        )}
      </div>
    </header>
  );
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
  const layout: string = meta?.layout || 'doc';
  const navMode: 'top' | 'side' = 'side';
  const siteTitle: string = meta?.site || 'Grove';
  const showRails = layout === 'doc' && !meta?.view;

  // Existence / 404: the whole index tells us if a followed link is dead.
  const allKeysQuery = useCallback(
    (fm: Record<string, any>) => Object.keys(fm).filter((p) => p.startsWith(CONTENT_DIR) && /\.mdx?$/.test(p)),
    []
  );
  const idx = useMetadataQuery(allKeysQuery);
  const keys: string[] = queryPaths(idx);
  const indexLoaded = keys.length > 0;
  const missing = indexLoaded && !keys.includes(entryKey);

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
        .filter((p) => p.startsWith(CONTENT_DIR) && Array.isArray(fm[p]?.tags) && fm[p].tags.includes('ui/nav'))
        .sort((a, b) => (fm[a].order ?? 999) - (fm[b].order ?? 999))
        .map((p) => [p, fm[p]?.nav || (fm[p]?.title || '').replace(/\.$/, '')].join('\t')),
    []
  );
  const navResult = useMetadataQuery(navQuery);
  const navRows: string[] = queryPaths(navResult);
  const navItems = navRows.map((r) => {
    const [key, label] = r.split('\t');
    return { key, href: keyToHref(key), label };
  });

  // Closest-match suggestion for a 404 (shared namespace or name overlap).
  const suggestion = missing
    ? keys
        .map((k) => ({ k, score: overlap(k, entryKey) }))
        .sort((a, b) => b.score - a.score)[0]?.k
    : undefined;

  const askGrove = () => {
    const el = (document.querySelector('.ga-foot input') || document.querySelector('.ga-line input')) as HTMLElement | null;
    el?.focus();
  };
  const newEntry = () => requestEdit({ path: 'content/untitled.mdx' }).catch(() => undefined);

  return (
    <div
      className="grove-root"
      data-vw={vw}
      data-nav={navMode}
      data-grove-theme={theme === 'default' ? undefined : theme}
      data-theme={theme === 'default' && light ? 'light' : undefined}
    >
      <div className="device__scroll">
        <div className="grove-shell" data-nav={navMode}>
          <nav className="grove-nav">
            <button className="grove-hamburger icbtn" aria-label="Menu" onClick={() => setDrawerOpen(true)}>
              <Icon name="list" />
            </button>
            <Link href="/" className="grove-brand">
              <span className="tile" style={{ background: 'var(--grad)' }} />
              {siteTitle}
            </Link>
            <div className="grove-nav__links">
              {navItems.map((n) => (
                <Link key={n.key} href={n.href} data-cur={n.key === entryKey ? '1' : '0'}>
                  {n.label}
                </Link>
              ))}
            </div>
            <div className="grove-nav__cluster">
              <button className="icbtn" aria-label="Search" onClick={() => setSearchOpen(true)}>
                <Icon name="search" />
              </button>
              {writable && (
                <button className="icbtn" aria-label="New entry" onClick={newEntry}>
                  <Icon name="plus" />
                </button>
              )}
              <button className="icbtn" aria-label="Ask Grove" onClick={askGrove}>
                <Icon name="message" />
              </button>
              <div className="grove-nav__more">
                <button className="icbtn" title="Theme" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                  ☀
                </button>
                {menuOpen ? (
                  <>
                    <div className="gtm__scrim" onClick={() => setMenuOpen(false)} />
                    <div className="grove-theme-menu" role="menu">
                      <div className="gtm__h">Theme</div>
                      <div className="gtm__list">
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            className="gtm__row"
                            data-cur={theme === t.id ? '1' : '0'}
                            onClick={() => setTheme(t.id)}
                          >
                            <span className="gtm__sw" style={{ background: t.swatch }} />
                            <span className="gtm__name">{t.label}</span>
                            {theme === t.id ? <span className="gtm__ck"><Icon name="check" /></span> : null}
                          </button>
                        ))}
                      </div>
                      {theme === 'default' ? (
                        <div className="gtm__appearance">
                          <div className="gtm__sub">Appearance</div>
                          <div className="gtm__seg">
                            <button data-on={!light ? '1' : '0'} onClick={() => setLight(false)}>
                              <Icon name="moon" /> Dark
                            </button>
                            <button data-on={light ? '1' : '0'} onClick={() => setLight(true)}>
                              <Icon name="sun" /> Light
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </nav>

          {navMode === 'side' ? <Sidebar /> : null}

          <main className="grove-content">
            {missing ? (
              <div className="grove-state">
                <div className="grove-state__art" />
                <h2>No entry at <code>{keyToRepoRel(entryKey).replace(/^content/, '')}</code>.</h2>
                <p>
                  That link points to an entry that doesn’t exist yet.
                  {suggestion ? <> Did you mean <Link className="grove-wikilink" data-state="ok" href={keyToHref(suggestion)}>{crumb(suggestion)}</Link>?</> : null}
                </p>
                <div className="grove-state__actions">
                  <Link className="btn-ghost" href="/"><Icon name="chevron-right" /> Back to home</Link>
                  {writable ? <button className="btn-primary" onClick={() => requestEdit({ path: keyToRepoRel(entryKey) }).catch(() => undefined)}><Icon name="file-plus" /> Create it</button> : null}
                </div>
              </div>
            ) : (
              <article className="grove-page" data-layout={layout}>
                <div className="gp-main">
                  <EntryHeader entryKey={entryKey} writable={writable} mins={mins} />
                  {showRails && vw === 'mobile' ? (
                    <details className="grove-toc__disclosure">
                      <summary>On this page</summary>
                      <Toc entryKey={entryKey} />
                    </details>
                  ) : null}
                  <div className="grove-prose">
                    <Include filename={includePath} baseModule={module} />
                  </div>
                  {showRails ? <Backlinks /> : null}
                </div>
                {showRails && vw === 'desktop' ? <Toc entryKey={entryKey} /> : null}
              </article>
            )}
          </main>

          <footer className="grove-footer">
            <div className="grove-footer__links">
              {navItems.slice(0, 4).map((n) => (
                <Link key={n.key} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </div>
            <div className="grove-footer__meta">built with grove</div>
          </footer>
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
