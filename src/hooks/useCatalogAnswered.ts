import { useEffect, useState } from 'react';
import { onCatalogChange } from '@immediately-run/sdk';

// Has the host actually ANSWERED the grant-filtered method catalog?
//
// `useCatalog()` starts `[]` and an empty catalog is a legitimate answer (a frame granted
// nothing), so the value alone cannot distinguish "granted nothing" from "has not replied
// yet". The reach card needs that distinction: `!chatGranted` is true in both cases, and
// reading it as "not granted" before the host has spoken claims a consent state about a
// frame that may well hold the grant (grove#75 round 1).
//
// It is derivable here, with no SDK change, because the push channel has **no
// value-equality check**: every host push notifies subscribers, including one whose value
// equals the initial `[]`. So a second notification means the host replied.
//
// WHY THE SUBSCRIPTION IS AT MODULE SCOPE, AND WHY THE RESET BELOW IS NOT A BUG.
// `onCatalogChange` invokes the listener once, SYNCHRONOUSLY, with the current value
// before returning — that call is the subscribe, not an answer. Clearing the flag on the
// next line therefore discards exactly that call and nothing else. Doing this at module
// load rather than in an effect is what makes it correct: this module is imported before
// any render, so the synchronous call is guaranteed to carry the pre-answer `[]`. From
// inside a `useEffect` the host's reply could already have landed between render and
// effect, and the reset would then swallow a real answer.
//
// Residual, stated rather than hidden: a host that never answers the catalog at all
// leaves this `false` forever, and the reach card's Q&A row stays neutral rather than
// naming a cause. That is the honest reading of "we have not been told", and it matches
// what the provider channel's own `unknown` state already does.
let answered = false;
const waiters = new Set<() => void>();

onCatalogChange(() => {
  if (answered) return;
  answered = true;
  for (const w of waiters) w();
});
answered = false; // discard the synchronous subscribe-time call (see above)

/** Whether the host has pushed a catalog answer. Re-renders when it flips. */
export function useCatalogAnswered(): boolean {
  const [, bump] = useState(0);
  useEffect(() => {
    if (answered) return;
    const w = () => bump((n) => n + 1);
    waiters.add(w);
    return () => {
      waiters.delete(w);
    };
  }, []);
  return answered;
}
