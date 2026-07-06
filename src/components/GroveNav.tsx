import { Link, requestEdit } from '@immediately-run/sdk';
import { useShell } from '../lib/shell';
import { THEMES } from '../data/themes';
import Icon from './Icon';

// `<GroveNav/>` — the top navigation bar. Import-free in MDX, so a layout places
// it with `<GroveNav/>`. Its interactive state (drawer / search / theme menu)
// lives in the shell context; this component only arranges and drives it.
export default function GroveNav() {
  const {
    siteTitle,
    navItems,
    entryKey,
    writable,
    theme,
    setTheme,
    light,
    setLight,
    menuOpen,
    setMenuOpen,
    setSearchOpen,
    setDrawerOpen,
  } = useShell();

  const askGrove = () => {
    const el = (document.querySelector('.ga-foot input') || document.querySelector('.ga-line input')) as HTMLElement | null;
    el?.focus();
  };
  const newEntry = () => requestEdit({ path: 'content/untitled.mdx' }).catch(() => undefined);

  return (
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
  );
}
