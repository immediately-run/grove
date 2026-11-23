import { describe, it, expect } from 'vitest';
import { resolveSiteLogo } from './siteLogo';
import { entryAssetRelPath } from './assetPath';

const HOME = '/mnt/abc/tickets/home.mdx';
const TICKET = '/mnt/abc/tickets/sub/DIB-1.md';

describe('resolveSiteLogo — the `logo:` key', () => {
  it('is null when neither the entry nor home declares one (the tile stays)', () => {
    expect(resolveSiteLogo(TICKET, { title: 'x' } as never, HOME, {})).toBeNull();
    expect(resolveSiteLogo(TICKET, null, HOME, undefined)).toBeNull();
  });

  it("takes home's logo and resolves it against HOME, not the page being read", () => {
    const logo = resolveSiteLogo(TICKET, {}, HOME, { logo: 'icon.webp' });
    expect(logo).toEqual({ entryPath: HOME, src: 'icon.webp' });
    expect(entryAssetRelPath(logo!.entryPath, logo!.src)).toBe('mnt/abc/tickets/icon.webp');
  });

  it("prefers the entry's own logo, resolved against the entry", () => {
    const logo = resolveSiteLogo(TICKET, { logo: 'mine.png' }, HOME, { logo: 'icon.webp' });
    expect(logo).toEqual({ entryPath: TICKET, src: 'mine.png' });
  });

  it('ignores a blank or non-scalar value', () => {
    expect(resolveSiteLogo(TICKET, { logo: '  ' }, HOME, { logo: ['a.png'] })).toBeNull();
  });
});
