import { useSyncExternalStore } from 'react';
import { onCatalogChange } from '@immediately-run/sdk';

// Has the host actually ANSWERED the grant-filtered method catalog?
//
// `useCatalog()` starts `[]` and an empty catalog is a legitimate answer (a frame granted
// nothing), so the value alone cannot distinguish "granted nothing" from "has not replied
// yet". The reach card needs that distinction: `!chatGranted` is true in both cases, and
// reading it as "not granted" before the host has spoken claims a consent state about a
// frame that may well hold the grant (grove#75 round 1).
//
// It is derivable here with no SDK change, because the push channel has **no
// value-equality check**: every host push notifies subscribers, including one whose value
// equals the initial `[]`. So a notification after the subscribe means the host replied.
//
// THE SUBSCRIBE-TIME CALL. `onCatalogChange` invokes the listener once, SYNCHRONOUSLY,
// with the current value before returning. That call is the subscribe, not an answer — but
// it is not worthless either, and an earlier version of this file threw it away with a
// blanket reset. A NON-EMPTY catalog at subscribe can only have come from the host, so it
// is proof the answer already landed. Reading it that way is what makes this correct when
// the module is evaluated LATE: grove is also published as a pinned library
// (`src/lib.ts`), so "imported before any render" is an assumption about one embedding,
// not a guarantee (grove#75 round 3).
//
// RESIDUALS, stated rather than implied:
//  - a host that answers `[]` BEFORE this module is evaluated is indistinguishable from
//    one that has not answered, and leaves the flag false for the realm's life. The Q&A
//    row then stays neutral rather than naming a cause — the same honest "we have not been
//    told" that the provider channel's `unknown` already renders, but it will not
//    self-correct, because the host does not push again;
//  - a host that never answers at all leaves it false forever, for the same reason;
//  - importing this module is what STARTS the catalog channel and sends
//    `REQUEST_API_CATALOG`. That used to be the first `useCatalog()` render. The channel
//    starts at most once and the poll is idempotent, but the timing moved.
let answered = false;
let subscribing = true;
const waiters = new Set<() => void>();

onCatalogChange((catalog) => {
  if (subscribing) {
    // Synchronous, at subscribe: the current value, not an answer — except that a
    // non-empty catalog could only have come from the host.
    answered = catalog.length > 0;
    return;
  }
  if (answered) return;
  answered = true;
  for (const w of waiters) w();
});
subscribing = false;

const subscribe = (onStoreChange: () => void): (() => void) => {
  waiters.add(onStoreChange);
  return () => {
    waiters.delete(onStoreChange);
  };
};
const getSnapshot = (): boolean => answered;

/**
 * Whether the host has answered the method catalog. Re-renders when it flips.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`, deliberately: the flag is
 * read during render and written outside React, and a passive effect leaves a window
 * between the two. An answer landing in that window used to be lost — the effect saw the
 * flag already set, returned early without registering a waiter, and the component
 * rendered a stale `false` with nothing left to wake it (grove#75 round 3, reproduced).
 * `useSyncExternalStore` re-reads the snapshot after subscribing and re-renders if it
 * moved, which is exactly that hole.
 */
export function useCatalogAnswered(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
