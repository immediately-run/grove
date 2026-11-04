// @vitest-environment jsdom
// R3-1322 (REPO_CONTENT_DISPATCH_SPEC §9) — a relative link that leaves the bundle is a
// cross-bundle link: under dispatch WikiLink renders the authored href and a plain click
// hands it to the host through the SDK's `followBundleLink`; a modified click stays the
// browser's; the fork never calls the SDK.
//
// The input is a REAL baton ticket: `__fixtures__/baton-tickets/B-10.mdx` is baton's
// `tickets/B-10.mdx` (baton@ab8a150) with its Spec line linked the way baton#176 links it.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { resetContentRoot, setContentRoot } from '../lib/contentRoot';
// Read from disk, not `?raw`: the MDX plugin claims `.mdx` imports. A direct node:fs require,
// as the navigation sweep does, so no `fs` mock in the graph can intercept it.
import { createRequire } from 'node:module';
import { join } from 'node:path';
const { readFileSync } = createRequire(import.meta.url)('node:fs') as typeof import('node:fs');
const B10 = readFileSync(join(__dirname, '__fixtures__/baton-tickets/B-10.mdx'), 'utf8');

const { followBundleLink } = vi.hoisted(() => ({ followBundleLink: vi.fn(() => true) }));
vi.mock('@immediately-run/sdk', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  followBundleLink,
}));

const { default: WikiLink } = await import('./WikiLink');
const { EntryContext } = await import('../hooks/useEntryKey');

/** Every markdown link in the ticket body, in order. */
const LINKS = [...B10.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({ text: m[1], href: m[2] }));
const SPEC_6_1 = LINKS[0];

const DISPATCHED_ROOT = '/mnt/0a1b2c3d/';
const FORK_ROOT = '/app/content/';

function host(children: ReactNode, root: string) {
  const entryKey = `${root}B-10.mdx`;
  const value = {
    outerHref: 'https://immediately.run/present/github/o/r/main/files/content/B-10.mdx',
    navigationState: { mode: 'present', namespace: 'github', provider: 'github', repository: 'o/r', ref: 'main', sandboxPath: '/files/content/B-10.mdx', hash: '', search: '' },
    routingSpec: { routes: [] },
    filesMetadata: { [entryKey]: { title: 'B-10' }, [`${root}B-11.mdx`]: { title: 'B-11' } },
  };
  return (
    <EntryContext.Provider value={{ entryKey }}>
      <TinkerableContext.Provider value={value as never}>{children}</TinkerableContext.Provider>
    </EntryContext.Provider>
  );
}

async function render(node: ReactNode): Promise<HTMLElement> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(node);
  });
  return container;
}

/** Click `el`; report whether anything before the document prevented the default, then
 *  prevent it ourselves so jsdom does not attempt the navigation. */
function click(el: Element, init: MouseEventInit = {}): { prevented: boolean } {
  const seen = { prevented: false };
  const atDocument = (e: Event) => {
    seen.prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener('click', atDocument);
  try {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  } finally {
    document.removeEventListener('click', atDocument);
  }
  return seen;
}

describe('the fixture is the real ticket shape', () => {
  it('B-10 links the spec sections it cites with repository-relative paths that leave tickets/', () => {
    expect(SPEC_6_1).toEqual({
      text: 'BATON_SPEC §6.1',
      href: '../spec/BATON_SPEC/06-prerequisites-blocks-advice.md#sec-6-1',
    });
    expect(LINKS.length).toBeGreaterThan(1);
    for (const { href } of LINKS) expect(href.startsWith('../spec/BATON_SPEC/')).toBe(true);
  });
});

describe('WikiLink — a link that leaves the bundle (R3-1322)', () => {
  beforeEach(() => {
    followBundleLink.mockClear();
    return () => resetContentRoot();
  });

  it('dispatched: renders the authored href; a plain click calls followBundleLink once with (href, fromEntry) and prevents the default', async () => {
    setContentRoot(DISPATCHED_ROOT);
    const el = await render(host(<WikiLink href={SPEC_6_1.href}>{SPEC_6_1.text}</WikiLink>, DISPATCHED_ROOT));
    const a = el.querySelector('a') as HTMLAnchorElement;
    expect(a).not.toBeNull();
    expect(a.getAttribute('href')).toBe(SPEC_6_1.href); // the plain relative href, for copy and forge reading
    expect(a.hasAttribute('target')).toBe(false); // not an external link, no new tab
    expect(a.textContent).toBe('BATON_SPEC §6.1');

    const { prevented } = click(a);
    expect(prevented).toBe(true);
    expect(followBundleLink).toHaveBeenCalledTimes(1);
    expect(followBundleLink).toHaveBeenCalledWith(SPEC_6_1.href, 'B-10.mdx');
  });

  it('dispatched: every spec link in the ticket renders as a followable link, none broken', async () => {
    setContentRoot(DISPATCHED_ROOT);
    const el = await render(
      host(
        <>
          {LINKS.map(({ text, href }, i) => (
            <WikiLink key={i} href={href}>{text}</WikiLink>
          ))}
        </>,
        DISPATCHED_ROOT,
      ),
    );
    expect(el.querySelectorAll('[data-state="broken"]').length).toBe(0);
    expect([...el.querySelectorAll('a[data-bundle-link]')].map((a) => a.getAttribute('href'))).toEqual(LINKS.map((l) => l.href));
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['middle button', { button: 1 }],
  ])('dispatched: a %s click is the browser\'s — not intercepted, SDK not called', async (_name, init) => {
    setContentRoot(DISPATCHED_ROOT);
    const el = await render(host(<WikiLink href={SPEC_6_1.href}>{SPEC_6_1.text}</WikiLink>, DISPATCHED_ROOT));
    const { prevented } = click(el.querySelector('a') as HTMLAnchorElement, init);
    expect(prevented).toBe(false);
    expect(followBundleLink).not.toHaveBeenCalled();
  });

  it('dispatched: a link that stays inside the bundle is routed as before, not handed to the host', async () => {
    setContentRoot(DISPATCHED_ROOT);
    const el = await render(host(<WikiLink href="B-11.mdx">B-11</WikiLink>, DISPATCHED_ROOT));
    const a = el.querySelector('a') as HTMLAnchorElement;
    expect(a.hasAttribute('data-bundle-link')).toBe(false);
    click(a);
    expect(followBundleLink).not.toHaveBeenCalled();
  });

  it('undispatched (the fork): the same href calls nothing and renders as today (broken, no navigating anchor)', async () => {
    setContentRoot(FORK_ROOT);
    const el = await render(host(<WikiLink href={SPEC_6_1.href}>{SPEC_6_1.text}</WikiLink>, FORK_ROOT));
    expect(el.querySelector('a')).toBeNull();
    const span = el.querySelector('.grove-wikilink') as HTMLElement;
    expect(span.getAttribute('data-state')).toBe('broken');
    click(span);
    expect(followBundleLink).not.toHaveBeenCalled();
  });
});
