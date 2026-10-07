// The navigation policy's defaults + click guard (APP_CUSTOMIZATION_SPEC §4.3,
// R3-872): the stock policy navigates the resolved href; a plain click routes to
// the policy with the browser default prevented; a modified click falls through
// to the real href; a throwing policy fails LOUDLY (logged, never silently
// retried by the default — R-CUST-5).
//
// R3-1029: the target's href is finalized at click time from the clicked
// ANCHOR (the absolute outer URL the anchor renders) — the corpus-relative
// call-site value is the fallback only, because the host's urlchange handler
// parses the url with new URL() and DROPS a bare relative path as unparseable
// (the defect that killed every plain click in a hosted grove >=0.2.0 wiki).
import { describe, it, expect, vi } from 'vitest';

const navigate = vi.fn();
vi.mock('@immediately-run/sdk', () => ({ navigate: (...a: unknown[]) => navigate(...(a as [])) }));

import { defaultFollowLink, followLinkOnClick } from './navigationPolicy';

const click = (over: Partial<Parameters<ReturnType<typeof followLinkOnClick>>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  preventDefault: vi.fn(),
  currentTarget: undefined,
  ...over,
});

const ANCHOR_HREF = 'https://immediately.run/edit/github/o/r/main/files/wiki/b.mdx';

describe('navigationPolicy', () => {
  it('defaultFollowLink calls the SDK navigate with the resolved href', () => {
    defaultFollowLink({ key: '/app/content/a.mdx', href: '/content/a' });
    expect(navigate).toHaveBeenCalledWith('/content/a');
  });

  it('R3-1029: a plain click reaches the policy with the ANCHOR\'S rendered href, not the raw passed one', () => {
    const follow = vi.fn();
    const e = click({ currentTarget: { href: ANCHOR_HREF } });
    followLinkOnClick(follow, { key: '/app/content/wiki/b.mdx', fragment: 'sec-4', href: '/wiki/b.mdx#sec-4', from: '/app/content/wiki/a.mdx' })(e);
    expect(follow).toHaveBeenCalledWith({
      key: '/app/content/wiki/b.mdx',
      fragment: 'sec-4',
      href: ANCHOR_HREF,
      from: '/app/content/wiki/a.mdx',
    });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('R3-1029: the anchor href the policy receives survives the host\'s exact guard — new URL() parses it', () => {
    const follow = vi.fn();
    followLinkOnClick(follow, { key: 'k', href: '/wiki/b.mdx' })(click({ currentTarget: { href: ANCHOR_HREF } }));
    const href = follow.mock.calls[0][0].href;
    // the host's urlchange handler parses the url with new URL() and drops a
    // bare relative path as unparseable — the raw call-site value is exactly
    // that input; the anchor's rendered outer URL is the shape that survives
    expect(() => new URL(href)).not.toThrow();
  });

  it('R3-1029: a synthetic, anchor-less event falls back to the passed href', () => {
    const follow = vi.fn();
    followLinkOnClick(follow, { key: 'k', fragment: 'sec-4', href: '/h#sec-4', from: 'here' })(click());
    expect(follow).toHaveBeenCalledWith({ key: 'k', fragment: 'sec-4', href: '/h#sec-4', from: 'here' });
  });

  it('a plain click (primary button, no modifier) reaches the policy and prevents the default', () => {
    const follow = vi.fn();
    const e = click();
    followLinkOnClick(follow, { key: 'k', fragment: 'sec-4', href: '/h#sec-4', from: 'here' })(e);
    expect(follow).toHaveBeenCalledWith({ key: 'k', fragment: 'sec-4', href: '/h#sec-4', from: 'here' });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it.each([
    ['meta', { metaKey: true }],
    ['ctrl', { ctrlKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['non-primary button', { button: 1 }],
  ])('a %s click never reaches the policy — the real href handles it', (_name, over) => {
    const follow = vi.fn();
    const e = click(over);
    followLinkOnClick(follow, { key: 'k', href: '/h' })(e);
    expect(follow).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('a throwing policy is logged with the target and NOT silently fallen back from', () => {
    const boom = new Error('policy broke');
    const follow = vi.fn(() => {
      throw boom;
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const e = click();
    expect(() => followLinkOnClick(follow, { key: 'k', href: '/h' })(e)).not.toThrow();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('k'), boom);
    // and no default navigation happened in place of the policy (the click was
    // already preventDefault'd — the shell's bug is visible, never papered over)
    expect(e.preventDefault).toHaveBeenCalled();
    err.mockRestore();
  });
});
