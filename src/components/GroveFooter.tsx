import { Link } from '@immediately-run/sdk';
import { useShell } from '../lib/shell';

// `<GroveFooter/>` — the site footer. Import-free in MDX; reads the nav items from
// the shell context so a layout just places `<GroveFooter/>`.
export default function GroveFooter() {
  const { navItems } = useShell();
  return (
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
  );
}
