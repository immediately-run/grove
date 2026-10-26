// A shell's OWN component — a name the engine's manifest does not declare, added with
// `extendComponents` (R3-1290). It renders in `render: safe` entries as well as compiled
// ones, because it is the viewer's code, not the corpus's.

import type { ReactNode } from 'react';

export default function ShellBadge({ children }: { children?: ReactNode }) {
  return <span className="shell-badge">{children}</span>;
}
