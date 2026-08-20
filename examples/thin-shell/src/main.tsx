// The entry immediately.run runs (`package.json` → `main`), and the reason this shell can
// prove anything about composition.
//
// Without it the platform falls back to the SDK's default route table, which renders
// `src/App.tsx`'s default export through the file router. The shell then renders — but
// `boot()` is never called with the shell's OWN component map, so `./components` is dead
// code and the `Callout` override in it silently does nothing. That is exactly the failure
// R3-280's Drill 3 exists to catch, and it was hiding in the fixture itself.
//
// `mdxComponents: COMPONENTS` is the whole point of the M3 mode: the engine arrives as a
// dependency and the SHELL decides what its vocabulary renders as. `children` rather than a
// `routingSpec` because the SDK installs a catch-all for children, and Grove's own gate
// (`GroveApp`) owns dispatch from there — the same arrangement grove's `src/main.tsx` uses
// for the fork mode, which is what makes the two modes comparable.
import { boot } from '@immediately-run/sdk/boot';
import App from './App';
import { COMPONENTS } from './components';

boot({ mdxComponents: COMPONENTS, children: <App /> });
