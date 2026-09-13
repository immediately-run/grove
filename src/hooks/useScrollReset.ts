import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useNavigationDirection } from '@immediately-run/sdk';
import { fragmentOf } from '../lib/fragment';

/**
 * Start each navigation at the top of the new entry.
 *
 * A wiki navigation is client-side, and the thing that scrolls is Grove's own container
 * (`.device__scroll` — `.grove-root` is `100dvh` with `overflow: hidden`, so the document
 * never scrolls). A container keeps its `scrollTop` across a React subtree swap, and the
 * browser has no navigation to reset it on. The reader therefore landed wherever they
 * happened to be: clicking a card near the bottom of a long project page opened the work
 * item scrolled to ITS bottom, because the shorter page clamps the inherited offset to
 * its own maximum. Nothing about the destination explained where the reader arrived.
 *
 * **A fragment is the one navigation this must not touch.** `<ScrollToFragment>` lands a
 * deep link on its section, and it does that from an effect inside the entry BODY — a
 * child, so its effect runs before this one. Resetting here would undo the landing a
 * moment after it happened. Skipping instead is also what the reader means: an anchor
 * asks for a place on the page, everything else asks for the page.
 *
 * `scrollTop` rather than `scrollTo({behavior})`: the reset must be instantaneous, or a
 * smooth scroll would animate across a page the reader has not seen. `scrollLeft` is left
 * alone — the container is `overflow-x: hidden`, so there is nothing there to reset.
 *
 * The ref is MINTED here and handed back for the caller to attach, rather than taken as
 * an argument: a hook may not write through something it was passed (the React Compiler's
 * immutability rule), and the element is this hook's own business anyway — the caller's
 * only job is to say which node is the scroller.
 */
export function useScrollReset(
  entryKey: string,
  hash: string | undefined,
): RefObject<HTMLDivElement | null> {
  const container = useRef<HTMLDivElement>(null);
  const frag = fragmentOf(hash);
  // A traversal is the second navigation this must not touch (R3-627). Going back
  // means returning to a page the reader has already read, and the platform now
  // restores where they were on it; resetting here would undo that restoration a
  // moment after it happened — the same shape as the fragment case above. Until the
  // host carried this signal, resetting unconditionally was the only correct
  // behaviour available, which is why this guard did not exist before.
  const direction = useNavigationDirection();
  const traversed = direction !== 'push';
  useEffect(() => {
    if (frag || traversed) return;
    const el = container.current;
    if (el) el.scrollTop = 0;
  }, [entryKey, frag, traversed]);
  return container;
}
