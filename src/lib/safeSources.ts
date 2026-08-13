import { openAppFs } from '@immediately-run/sdk';
import { createSourceCache } from './sourceCache';

// The ONE raw-source cache the interpreter path reads through — entry bodies
// (`SafeEntryBody`) and layout files (`SafeLayout`) alike. (R3-263)
//
// Shared rather than one-per-component for two reasons. React `use()` needs a STABLE
// promise across renders, so the cache must outlive any single component; and a layout is
// re-read on every navigation while the layout file itself rarely changes, so one cache
// turns the whole chain into a single read per file per session instead of a read per page.
//
// The failure behaviour lives in `sourceCache` and is the interesting part: a rejected read
// is EVICTED rather than memoised, because the host↔sandbox RPC drops requests during a
// navigation and a rejected promise left in the cache is returned to every later render —
// which made an entry permanently blank for the rest of the session.
export const safeSources = createSourceCache(
  (repoRel) => openAppFs().readFile(repoRel, 'utf8') as Promise<string>
);
