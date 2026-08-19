// "Scroll the selected entry into view — when necessary."
//
// The arithmetic is here, as a pure function, for two reasons.
//
// **It is the part that is easy to get subtly wrong**, and the failure is invisible in a
// screenshot: scrolling when the entry was already visible (the list twitches on every
// heading the reader passes), or leaving it just under the fold because the margin was
// measured against the wrong edge.
//
// **The obvious API is a trap.** `element.scrollIntoView()` — even with
// `block: 'nearest'` — walks EVERY scrollable ancestor, so calling it on a table-of-
// contents link also scrolls the document that contains it. The reader passes a heading,
// the page jumps: the exact opposite of the feature. So this returns a `scrollTop` for ONE
// container and the caller assigns it, and no ancestor can move.

/** The measurements this needs, in one object — so it can be called from a real DOM
 *  (`clientHeight`/`scrollTop`/`offsetTop`) and from a test with plain numbers. */
export interface ScrollView {
  /** The scroll container's visible height. */
  viewHeight: number;
  /** Its current scroll offset. */
  scrollTop: number;
  /** Its total scrollable height. */
  scrollHeight: number;
}

export interface ScrollItem {
  /** The item's offset from the top of the container's content. */
  top: number;
  height: number;
}

export interface ScrollOptions {
  /** Breathing room kept between the item and the edge it is being pulled away from.
   *  An item flush against the fold reads as "the last one" — the margin is what tells
   *  the reader there is more list in that direction. */
  margin?: number;
}

/**
 * The `scrollTop` that brings `item` into view inside `view`, or **null when no scroll is
 * needed** — the "when necessary" half, and the reason this returns null rather than the
 * current offset: a caller that assigned an unchanged value would still cancel a smooth
 * scroll already in flight and re-fire scroll events.
 *
 * Nearest-edge, not centred: an entry one line below the fold should rise one line, not
 * jump to the middle. Centring would move the list on almost every step and destroy the
 * reader's sense of place in it.
 */
export function scrollOffsetFor(
  view: ScrollView,
  item: ScrollItem,
  opts: ScrollOptions = {}
): number | null {
  const margin = opts.margin ?? 0;
  const maxScroll = Math.max(0, view.scrollHeight - view.viewHeight);
  // Nothing to scroll: the whole list fits. Every item is already in view by definition,
  // and clamping below would otherwise return 0 for an item at the top and read as "scroll".
  if (maxScroll <= 0) return null;

  const top = item.top;
  const bottom = item.top + item.height;
  const viewTop = view.scrollTop;
  const viewBottom = view.scrollTop + view.viewHeight;

  let target: number;
  if (top - margin < viewTop) {
    target = top - margin; // above the fold — pull it down to the top edge
  } else if (bottom + margin > viewBottom) {
    target = bottom + margin - view.viewHeight; // below — pull it up to the bottom edge
  } else {
    return null; // already visible with room to spare
  }

  const clamped = Math.max(0, Math.min(target, maxScroll));
  // The clamp can land exactly where we already are — an item inside the top margin when
  // the list is already scrolled to 0. That is "already in view", not a scroll.
  return clamped === view.scrollTop ? null : clamped;
}

/** Read a live element pair into the shapes above. `offsetTop` is relative to the nearest
 *  positioned ancestor, so the container must be a positioning context (the stylesheet
 *  gives it `position: relative`) or the arithmetic is measured from the wrong origin. */
export function measure(container: HTMLElement, item: HTMLElement): [ScrollView, ScrollItem] {
  return [
    {
      viewHeight: container.clientHeight,
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
    },
    { top: item.offsetTop, height: item.offsetHeight },
  ];
}
