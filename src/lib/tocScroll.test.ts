import { describe, it, expect } from 'vitest';
import { scrollOffsetFor, type ScrollItem, type ScrollView } from './tocScroll';

// A 200px-tall viewport over a 1000px list, currently at the top.
const view = (over: Partial<ScrollView> = {}): ScrollView => ({
  viewHeight: 200,
  scrollTop: 0,
  scrollHeight: 1000,
  ...over,
});
const item = (top: number, height = 20): ScrollItem => ({ top, height });

describe('scrollOffsetFor — the "when necessary" half', () => {
  it('returns null for an entry already comfortably in view', () => {
    expect(scrollOffsetFor(view(), item(100), { margin: 28 })).toBeNull();
  });

  it('returns null when the whole list fits — nothing can scroll', () => {
    // Guarded explicitly: without it the clamp below returns 0 for a top item, which a
    // caller would read as "scroll to 0" and act on, cancelling smooth scrolls forever.
    expect(scrollOffsetFor(view({ scrollHeight: 150 }), item(0))).toBeNull();
    expect(scrollOffsetFor(view({ scrollHeight: 200 }), item(180))).toBeNull();
  });

  it('pulls an entry below the fold UP to the bottom edge, not to the centre', () => {
    // bottom(420) + margin(28) - viewHeight(200) = 248 — one step, not a jump to centre.
    expect(scrollOffsetFor(view(), item(400), { margin: 28 })).toBe(248);
  });

  it('pulls an entry above the fold DOWN to the top edge', () => {
    expect(scrollOffsetFor(view({ scrollTop: 500 }), item(400), { margin: 28 })).toBe(372);
  });

  it('honours the edge margin — an entry flush against the fold still moves', () => {
    // top 210 with viewTop 0 + viewHeight 200: the entry's bottom (230) is past the fold.
    expect(scrollOffsetFor(view(), item(210), { margin: 0 })).toBe(30);
    // With a margin, it is pulled further so the list visibly continues past it.
    expect(scrollOffsetFor(view(), item(210), { margin: 28 })).toBe(58);
  });

  it('never scrolls past either end', () => {
    expect(scrollOffsetFor(view(), item(0), { margin: 28 })).toBeNull(); // no negative
    const atEnd = scrollOffsetFor(view({ scrollTop: 0 }), item(980), { margin: 28 });
    expect(atEnd).toBe(800); // scrollHeight(1000) - viewHeight(200)
  });

  it('returns null when the clamp lands where we already are', () => {
    // An entry inside the top margin while the list is already at 0: the ideal target is
    // negative, clamps to 0, and 0 is the current offset — that is "in view", not a scroll.
    expect(scrollOffsetFor(view({ scrollTop: 0 }), item(10), { margin: 28 })).toBeNull();
    // …and at the far end, likewise.
    expect(scrollOffsetFor(view({ scrollTop: 800 }), item(990), { margin: 28 })).toBeNull();
  });

  it('treats a tall entry that cannot fit by pinning its top', () => {
    // Taller than the viewport: the bottom rule would scroll past the top of the entry and
    // show only its tail. Above-the-fold is tested first, so the top wins.
    expect(scrollOffsetFor(view({ scrollTop: 400 }), item(300, 400), { margin: 0 })).toBe(300);
  });

  it('is stable — applying its own answer twice is a no-op', () => {
    // The property that keeps the list from oscillating: after one correction the entry is
    // in view, so a second call must decline. A margin/edge mix-up breaks exactly this.
    for (const top of [0, 37, 210, 400, 640, 980]) {
      const first = scrollOffsetFor(view(), item(top), { margin: 28 });
      if (first === null) continue;
      const second = scrollOffsetFor(view({ scrollTop: first }), item(top), { margin: 28 });
      expect(second).toBeNull();
    }
  });
});
