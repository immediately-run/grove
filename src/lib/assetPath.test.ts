// The pure resolver (R3-313): entry-relative resolution against the OWNING entry,
// the absolute-`/` escape, traversal, and the degrade-to-empty contract.
import { describe, it, expect } from 'vitest';
import { resolvePath, entryAssetRelPath } from './assetPath';

describe('resolvePath', () => {
  it('resolves relative to the base file directory', () => {
    expect(resolvePath('/app/content/wiki/a.mdx', 'pic.png')).toBe('/app/content/wiki/pic.png');
    expect(resolvePath('/app/content/wiki/a.mdx', './pic.png')).toBe('/app/content/wiki/pic.png');
    expect(resolvePath('/app/content/wiki/a.mdx', '../img/pic.png')).toBe('/app/content/img/pic.png');
    expect(resolvePath('/app/content/wiki/deep/a.mdx', '../../pic.png')).toBe('/app/content/pic.png');
  });

  it('an absolute reference roots at the filesystem (the body-image escape rule)', () => {
    expect(resolvePath('/app/content/wiki/a.mdx', '/app/assets/x.svg')).toBe('/app/assets/x.svg');
  });
});

describe('entryAssetRelPath — the MountImage feed', () => {
  it('strips the root for the root-anchored mount', () => {
    expect(entryAssetRelPath('/app/content/wiki/a.mdx', 'pic.png')).toBe('app/content/wiki/pic.png');
  });

  it('empty/absent/malformed src degrades to "" (caller renders the lattice)', () => {
    expect(entryAssetRelPath('/app/content/a.mdx', undefined)).toBe('');
    expect(entryAssetRelPath('/app/content/a.mdx', null)).toBe('');
    expect(entryAssetRelPath('/app/content/a.mdx', '')).toBe('');
    expect(entryAssetRelPath('/app/content/a.mdx', '   ')).toBe('');
  });

  it('UNDER DISPATCH the resolved path carries the chroot prefix only as the READ key — the component publishes MountImage object URLs, never this string', () => {
    // The mount key space is the metadata key space; resolution is prefix-faithful…
    expect(entryAssetRelPath('/mnt/abc123def456/wiki/a.mdx', 'pic.png')).toBe('mnt/abc123def456/wiki/pic.png');
    // …which is exactly why the COMPONENT test asserts this string never reaches the DOM.
  });
});
