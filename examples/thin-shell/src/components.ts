// The composed component map. A separate module because `App.tsx` may export only
// components (the Fast Refresh rule this repo's lint enforces) — and because composing at
// MODULE scope is the point: an override of an undeclared or locked component throws when
// this module loads, not on the first render of whichever page happened to use it.

import { GROVE_MDX, composeComponents } from '@immediately-run/grove';
import ShellCallout from './ShellCallout';

export const COMPONENTS = composeComponents(GROVE_MDX, {
  Callout: ShellCallout,
  // Outlet: ShellCallout,        // ← throws: declared, but overridable: false
  // SafeEntryBody: ShellCallout, // ← throws: not in the manifest at all (engine internal)
});
