import fs from 'fs';
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
// Keyed by the ABSOLUTE path, not a repo-relative one (R3-265). `openAppFs()` is scoped to
// the APP's repo, which is right for a fork and wrong for a dispatched viewer — the corpus
// then lives at a host-minted chroot, and an app-scoped read would either miss it or find
// the viewer's own entry of the same name. The unified `fs` namespace addresses both: a
// fork's `/app/content/x.mdx` and a dispatched `/task/<slot>/dir/x.mdx` are the same kind of
// path, which is also the key the metadata index uses, so one identifier now reads a body
// and its metadata.
export const safeSources = createSourceCache(
  (absPath) => fs.promises.readFile(absPath, 'utf8') as Promise<string>
);
