// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { receiveNavigation, resetEntryState } from '@immediately-run/sdk';
import { useScrollReset } from './useScrollReset';

// A stand-in for `<GroveWiki>`'s `.device__scroll`: the hook's whole job is what it does
// to that element across a navigation, so the probe renders one and the assertions read
// its `scrollTop` — the property the reader experiences — rather than a call count.
function Probe({ entryKey, hash }: { entryKey: string; hash: string }) {
  const ref = useScrollReset(entryKey, hash);
  return <div ref={ref} data-testid="scroller" />;
}

/** Mount the probe and hand back a `navigate` that re-renders it, plus the container. */
function mount(entryKey: string, hash = '') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<Probe entryKey={entryKey} hash={hash} />));
  const el = host.querySelector<HTMLDivElement>('[data-testid="scroller"]')!;
  return {
    el,
    navigate: (nextKey: string, nextHash = '') =>
      act(() => root.render(<Probe entryKey={nextKey} hash={nextHash} />)),
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe('useScrollReset', () => {
  it('puts the reader at the top of the entry they navigated to', () => {
    const { el, navigate, unmount } = mount('/app/content/projects/directory-as-content.mdx');
    // What a long list page leaves behind: the offset the reader had reached on it.
    el.scrollTop = 4200;
    navigate('/app/content/roadmap/R3-170.mdx');
    expect(el.scrollTop).toBe(0);
    unmount();
  });

  it('leaves a fragment navigation alone — that landing belongs to ScrollToFragment', () => {
    const { el, navigate, unmount } = mount('/app/content/a.mdx');
    el.scrollTop = 900;
    navigate('/app/content/b.mdx', '#sec-4');
    expect(el.scrollTop).toBe(900);
    unmount();
  });

  it('reads the fragment the same way the deep-link path does', () => {
    // The dev provider glues its `#ir-endpoint=…` locator onto the fragment, and
    // `fragmentOf` takes the leading component. A hash that is ONLY the locator names no
    // section, so it is an ordinary navigation and must reset; one that names a section
    // must not, locator or no locator.
    const only = mount('/app/content/a.mdx');
    only.el.scrollTop = 300;
    only.navigate('/app/content/b.mdx', '#&ir-endpoint=x&ir-token=y');
    expect(only.el.scrollTop).toBe(0);
    only.unmount();

    const named = mount('/app/content/a.mdx');
    named.el.scrollTop = 300;
    named.navigate('/app/content/b.mdx', '#sec-2&ir-endpoint=x');
    expect(named.el.scrollTop).toBe(300);
    named.unmount();
  });

  it('does not fight the reader on a re-render that is not a navigation', () => {
    // The entry re-renders for reasons of its own — reading time arriving, a theme
    // change, the metadata store settling. Resetting on any of those would yank the page
    // out from under someone mid-read.
    const { el, navigate, unmount } = mount('/app/content/a.mdx');
    el.scrollTop = 1500;
    navigate('/app/content/a.mdx');
    expect(el.scrollTop).toBe(1500);
    unmount();
  });

  it('resets when a reader leaves a section for the page it is in', () => {
    // `/a#sec-4` → `/a` is a navigation even though the entry did not change: the reader
    // asked for the entry, not the section they were on.
    const { el, navigate, unmount } = mount('/app/content/a.mdx', '#sec-4');
    el.scrollTop = 700;
    navigate('/app/content/a.mdx', '');
    expect(el.scrollTop).toBe(0);
    unmount();
  });
});

describe('useScrollReset on a history traversal (R3-627)', () => {
  // The platform now restores where the reader was on a page they return to. This
  // hook runs on the same arrival, so if it still zeroed the container it would undo
  // that restoration a moment after it happened — the feature would look like it had
  // never shipped.
  afterEach(() => resetEntryState());

  it('stands down on Back, leaving the restored position alone', () => {
    const { el, navigate, unmount } = mount('/app/content/a.mdx');
    act(() => receiveNavigation({ state: { 'ir.scroll': 640 }, direction: 'back' }));
    // What ScrollRestoration will have put back by the time this effect runs.
    el.scrollTop = 640;
    navigate('/app/content/projects/directory-as-content.mdx');
    expect(el.scrollTop).toBe(640);
    unmount();
  });

  it('stands down on Forward too — a traversal either way is a page already seen', () => {
    const { el, navigate, unmount } = mount('/app/content/a.mdx');
    act(() => receiveNavigation({ state: { 'ir.scroll': 120 }, direction: 'forward' }));
    el.scrollTop = 120;
    navigate('/app/content/b.mdx');
    expect(el.scrollTop).toBe(120);
    unmount();
  });

  it('still resets on an ordinary navigation after a traversal', () => {
    // The guard must follow the CURRENT arrival, not latch on the first traversal.
    const { el, navigate, unmount } = mount('/app/content/a.mdx');
    act(() => receiveNavigation({ state: { 'ir.scroll': 640 }, direction: 'back' }));
    el.scrollTop = 640;
    navigate('/app/content/b.mdx');
    expect(el.scrollTop).toBe(640);

    act(() => receiveNavigation({ state: undefined, direction: 'push' }));
    el.scrollTop = 900;
    navigate('/app/content/c.mdx');
    expect(el.scrollTop).toBe(0);
    unmount();
  });
});
