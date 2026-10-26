// The composed component map. A separate module because `App.tsx` may export only
// components (the Fast Refresh rule this repo's lint enforces) — and because composing at
// MODULE scope is the point: an override of an undeclared or locked component throws when
// this module loads, not on the first render of whichever page happened to use it.

import { GROVE_MDX, composeComponents, extendComponents } from '@immediately-run/grove';
import ShellCallout from './ShellCallout';
import ShellBadge from './ShellBadge';

// Overrides first, through the manifest; then the shell's OWN components, which the
// manifest does not name (R3-1290). The result renders compiled entries through `boot()`
// AND `render: safe` entries — the shell is the viewer, so its code may render safe content.
export const COMPONENTS = extendComponents(
  composeComponents(GROVE_MDX, {
    Callout: ShellCallout,
    // Outlet: ShellCallout,        // ← throws: declared, but overridable: false
    // SafeEntryBody: ShellCallout, // ← throws: not in the manifest at all (engine internal)
  }),
  {
    ShellBadge,
    // Callout: ShellCallout,       // ← throws: a manifest name — override it above instead
  },
);
