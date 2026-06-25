/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useContext, useEffect, useState } from 'react';
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
  keyToHref,
  keyToInclude,
  keyToRepoRel,
  sandboxPathToKey,
} from './lib/content';

// The host injects `module` (the EvaluationContext) into each module's scope;
// Include uses it as the base for resolving the dynamically-imported entry.
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

function NavLink({ entryKey }: { entryKey: string }) {
  const meta = useFileMetadata(entryKey) as any;
  if (!meta) return null;
  return <Link href={keyToHref(entryKey)}>{meta.nav || (meta.title || '').replace(/\.$/, '')}</Link>;
}

function EntryHeader({ entryKey, writable }: { entryKey: string; writable: boolean }) {
  const meta = useFileMetadata(entryKey) as any;
  const [busy, setBusy] = useState(false);
  if (!meta) return null;
  const tags: string[] = Array.isArray(meta.tags) ? meta.tags.filter((t: string) => !t.startsWith('ui/')) : [];
  const crumb = keyToRepoRel(entryKey).replace(/^content\//, '').replace(/\.mdx?$/, '');
  const edit = () => {
    setBusy(true);
    requestEdit({ path: keyToRepoRel(entryKey) })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  return (
    <header className="grove-entry-header">
      {crumb.includes('/') ? <nav className="crumb">{crumb}</nav> : null}
      <h1 className={meta.grad ? 'grad' : ''}>{meta.title || crumb}</h1>
      <div className="grove-meta">
        {meta.date && <span>{meta.date}</span>}
        {tags.length ? <span className="dot">·</span> : null}
        {tags.map((t) => (
          <span key={t} className="grove-tag">#{t}</span>
        ))}
        {writable && (
          <button className="grove-edit-affordance" data-busy={busy ? '1' : '0'} onClick={edit}>
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

  const writable =
    mounts?.some((m) => m.type === 'worktree' && m.mode !== 'ro') ?? false;

  // Which entry are we viewing?
  const entryKey = sandboxPathToKey(sandboxPath) || HOME_KEY;
  const includePath = keyToInclude(entryKey);

  // Top-nav entries (tagged ui/nav, ordered by frontmatter `order`).
  const navQuery = useCallback(
    (fm: Record<string, any>) =>
      Object.keys(fm)
        .filter((p) => p.startsWith(CONTENT_DIR) && Array.isArray(fm[p]?.tags) && fm[p].tags.includes('ui/nav'))
        .sort((a, b) => (fm[a].order ?? 999) - (fm[b].order ?? 999)),
    []
  );
  const navResult = useMetadataQuery(navQuery);
  const navPaths: string[] = navResult && 'result' in navResult ? navResult.result : [];

  return (
    <div
      className="grove-root"
      data-vw={vw}
      data-nav="top"
      data-grove-theme={theme === 'default' ? undefined : theme}
      data-theme={theme === 'default' && light ? 'light' : undefined}
    >
      <div className="device__scroll">
        <div className="grove-shell" data-nav="top">
          <nav className="grove-nav">
            <Link href="/" className="grove-brand">
              Grove
            </Link>
            <div className="grove-nav__links">
              {navPaths.map((p) => (
                <NavLink key={p} entryKey={p} />
              ))}
            </div>
            <div className="grove-nav__cluster">
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
                            {theme === t.id ? <span className="gtm__ck">✓</span> : null}
                          </button>
                        ))}
                      </div>
                      {theme === 'default' ? (
                        <div className="gtm__appearance">
                          <div className="gtm__sub">Appearance</div>
                          <div className="gtm__seg">
                            <button data-on={!light ? '1' : '0'} onClick={() => setLight(false)}>
                              Dark
                            </button>
                            <button data-on={light ? '1' : '0'} onClick={() => setLight(true)}>
                              Light
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

          <div className="grove-content">
            <div className="grove-page" data-layout="doc">
              <div className="gp-main">
                <EntryHeader entryKey={entryKey} writable={writable} />
                <div className="grove-prose">
                  <Include filename={includePath} baseModule={module} />
                </div>
              </div>
            </div>
          </div>

          <footer className="grove-footer">
            <div className="grove-footer__meta">built with grove</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
