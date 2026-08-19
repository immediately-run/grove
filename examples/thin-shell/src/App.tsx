// The M3 proof shell (PLATFORM_LAYERING_SPEC §1.1, R3-280).
//
// This is an ORDINARY immediately.run app — the default export the platform renders. It
// does not fork the engine and it is not dispatched to; it imports the engine as a pinned
// git dependency (`package.json` → `github:immediately-run/grove#<ref>`), which the
// LIBRARY_MOUNTS rail mounts at `/node_modules/@immediately-run/grove` before the first
// compile, and arranges it.
//
// Two things this shell exists to demonstrate, both of them R3-280 exit criteria:
//
//   1. **Composition without forking.** The whole wiki arrives as one component and the
//      shell keeps ownership of what wraps it.
//   2. **Overriding through the manifest, and only through it.** See `./components` — the
//      commented lines there are what a mistake looks like: a throw at module load naming
//      the offending component and the surface that WAS available, never a silent fall
//      back to stock.
//
// Note what the package.json declares: `content: ["content"]` with `render: "app"`. A repo
// holding corpora stays an app by default, but saying so explicitly is what makes the
// intent readable to the next person.

import { GroveApp } from '@immediately-run/grove';
import '@immediately-run/grove/styles.css';
import './shell.css';

export default function App() {
  return <GroveApp />;
}
