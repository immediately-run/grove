import { Link } from '@immediately-run/sdk';
import Sidebar from './Sidebar';
import Icon from './Icon';

interface NavItem {
  href: string;
  label: string;
  cur: boolean;
}

// `.grove-drawer` — the mobile nav drawer: site mark + nav items + the full
// namespace tree, over a dismiss scrim.
export default function Drawer({
  siteTitle,
  nav,
  onClose,
}: {
  siteTitle: string;
  nav: NavItem[];
  onClose: () => void;
}) {
  return (
    <div className="grove-drawer" onClick={onClose}>
      <div className="grove-drawer__panel" onClick={(e) => e.stopPropagation()}>
        <div className="grove-drawer__h">
          <span className="mk" />
          <span className="t">{siteTitle}</span>
          <button className="x" aria-label="Close menu" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {nav.length ? (
          <nav className="grove-drawer__nav">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} data-cur={n.cur ? '1' : '0'} onClick={onClose}>
                {n.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <Sidebar />
      </div>
    </div>
  );
}
