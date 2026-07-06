import { useContext } from 'react';
import { OutletContext } from '../lib/shell';

// `<Outlet/>` — the injection point inside a layout (`_layout.mdx`). It renders
// whatever the engine placed one level inward: the next nested layout, or — at
// the bottom of the chain — the page itself. Import-free in MDX (registered in
// GROVE_MDX), so a layout author just writes `<Outlet/>` where the page goes.
// The React Router analogue, adapted to Grove's content-is-chrome model.
export default function Outlet() {
  return <>{useContext(OutletContext)}</>;
}
