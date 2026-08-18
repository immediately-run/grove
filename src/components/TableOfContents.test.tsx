// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import TableOfContents from './TableOfContents';

// jsdom performs no layout, so every geometry property this component reads is 0. The
// numbers are planted instead — which is fine, because the arithmetic itself is proven in
// `lib/tocScroll.test.ts`. What THIS file proves is the wiring: that the component reads
// the right elements, moves the right one, and declines when it should.

let ioCallback: ((entries: unknown[]) => void) | null = null;
class FakeIO {
  constructor(cb: (entries: unknown[]) => void) {
    ioCallback = cb;
  }
  observe() {}
  disconnect() {
    ioCallback = null;
  }
}

/** Report a heading as the one the reader is currently in. */
async function spyTo(id: string) {
  await act(async () => {
    ioCallback?.([{ isIntersecting: true, target: document.getElementById(id) }]);
  });
}

function plantProse(ids: string[]) {
  const prose = document.createElement('div');
  prose.className = 'grove-prose';
  prose.innerHTML = ids.map((id) => `<h2 id="${id}">${id}</h2>`).join('');
  document.body.appendChild(prose);
}

/** Give the rendered list a fake layout: 200px tall over 1000px of content, each row
 *  20px starting at 40px (below the "On this page" header). */
function layout(nav: HTMLElement, opts: { viewHeight?: number; scrollHeight?: number } = {}) {
  Object.defineProperty(nav, 'clientHeight', { value: opts.viewHeight ?? 200, configurable: true });
  Object.defineProperty(nav, 'scrollHeight', { value: opts.scrollHeight ?? 1000, configurable: true });
  let top = 0;
  Object.defineProperty(nav, 'scrollTop', {
    get: () => top,
    set: (v) => { top = v; },
    configurable: true,
  });
  nav.querySelectorAll('a').forEach((a, i) => {
    Object.defineProperty(a, 'offsetTop', { value: 40 + i * 20, configurable: true });
    Object.defineProperty(a, 'offsetHeight', { value: 20, configurable: true });
  });
  return nav;
}

const IDS = Array.from({ length: 40 }, (_, i) => `sec-${i + 1}`);

let scrollTo: ReturnType<typeof vi.fn>;
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  ioCallback = null;
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeIO;
  scrollTo = vi.fn();
  scrollIntoView = vi.fn();
  Element.prototype.scrollTo = scrollTo as never;
  Element.prototype.scrollIntoView = scrollIntoView as never;
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

async function mount(): Promise<HTMLElement> {
  plantProse(IDS);
  const host = document.createElement('div');
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host).render(<TableOfContents entryKey="/app/content/x.mdx" />);
  });
  return layout(host.querySelector('nav')!);
}

describe('<TableOfContents/>', () => {
  it('lists the rendered entry’s headings', async () => {
    const nav = await mount();
    expect(nav.querySelectorAll('a')).toHaveLength(40);
    expect(nav.querySelector('.grove-toc__h')?.textContent).toBe('On this page');
  });

  it('scrolls its OWN container when the active entry is below the fold', async () => {
    const nav = await mount();
    await spyTo('sec-30'); // offsetTop 620, bottom 640 — far past a 200px view
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.calls[0][0]).toMatchObject({ top: 640 + 28 - 200 });
    // …and on the LIST, not on some ancestor. The whole claim is "its own container".
    expect(scrollTo.mock.instances[0]).toBe(nav);
  });

  it('never calls scrollIntoView on a list entry — that would scroll the PAGE', async () => {
    // The trap this component exists to avoid: `scrollIntoView` walks every scrollable
    // ancestor, so using it here moves the document and the article jumps under the reader.
    await mount();
    await spyTo('sec-30');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('does nothing when the active entry is already in view', async () => {
    await mount();
    await spyTo('sec-3'); // offsetTop 80 — comfortably inside a 200px view at scrollTop 0
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does nothing when the whole list fits', async () => {
    plantProse(IDS);
    const host = document.createElement('div');
    document.body.appendChild(host);
    await act(async () => {
      createRoot(host).render(<TableOfContents entryKey="/app/content/x.mdx" />);
    });
    layout(host.querySelector('nav')!, { viewHeight: 1000, scrollHeight: 1000 });
    await spyTo('sec-30');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not fight a reader who just scrolled the list by hand', async () => {
    const nav = await mount();
    await act(async () => {
      nav.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    });
    await spyTo('sec-30');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('marks the active entry for styling and for assistive tech', async () => {
    const nav = await mount();
    await spyTo('sec-12');
    const active = nav.querySelector('a[data-cur="1"]');
    expect(active?.getAttribute('href')).toBe('#sec-12');
    expect(active?.getAttribute('aria-current')).toBe('location');
    expect(nav.querySelectorAll('a[data-cur="1"]')).toHaveLength(1);
  });

  it('renders nothing for an entry with no sub-headings', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    await act(async () => {
      createRoot(host).render(<TableOfContents entryKey="/app/content/empty.mdx" />);
    });
    expect(host.querySelector('nav')).toBeNull();
  });

  it('clicking an entry scrolls the DOCUMENT to that heading, and suspends the auto-scroll', async () => {
    const nav = await mount();
    const link = nav.querySelector('a[href="#sec-30"]') as HTMLAnchorElement;
    await act(async () => {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    // The heading, not the list entry.
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    await spyTo('sec-30');
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
