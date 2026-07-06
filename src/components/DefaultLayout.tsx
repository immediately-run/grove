import { useShell } from '../lib/shell';
import GroveNav from './GroveNav';
import Sidebar from './Sidebar';
import GroveFooter from './GroveFooter';
import Outlet from './Outlet';

// The built-in root layout: the standard Grove shell, used when a repo ships no
// `content/_layout.mdx` of its own — so even a bare folder of `.mdx` files gets
// full chrome (product value 3, "a bare folder is a usable site"). A repo makes
// the shell its own by dropping in `content/_layout.mdx`, which overrides this.
//
// This is intentionally the SAME arrangement a content `_layout.mdx` would write
// by hand (`<GroveNav/> <GroveSidebar/> <main><Outlet/></main> <GroveFooter/>`),
// so the default and a custom shell are structurally identical.
export default function DefaultLayout() {
  const { navMode } = useShell();
  return (
    <>
      <GroveNav />
      {navMode === 'side' ? <Sidebar /> : null}
      <main className="grove-content">
        <Outlet />
      </main>
      <GroveFooter />
    </>
  );
}
