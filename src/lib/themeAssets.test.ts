// R3-315's adversarial exits, at the minter:
//   • faces mint from LOCAL bytes — no network location is named anywhere;
//   • switching sets revokes the outgoing URLs (no leak across a theme lifetime);
//   • a missing font or asset degrades — skipped, never thrown, fallback answers;
//   • minted URLs and @font-face srcs are `blob:` — no chroot prefix can reach
//     them (proven non-vacuous by a leaking canary the same check catches).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mintThemeAssets } from './themeAssets';
import type { AssetReader } from './themeAssets';

const BYTES = new Uint8Array([1, 2, 3, 4]);
const ok: AssetReader = async () => BYTES;
const miss: AssetReader = async () => {
  throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
};

const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
const createSpy = vi.spyOn(URL, 'createObjectURL');

afterEach(() => {
  revokeSpy.mockClear();
  createSpy.mockClear();
});

describe('minting', () => {
  it('emits one @font-face per declared face, blob: src, descriptors carried', async () => {
    const m = await mintThemeAssets(
      { fonts: [{ family: 'Source Serif 4', src: './fonts/a.woff2', weight: '400 700', style: 'normal' }] },
      '/app/themes/x.css',
      ok,
    );
    expect(m.minted).toBe(1);
    expect(m.fontFaceCss).toContain('@font-face');
    expect(m.fontFaceCss).toContain('"Source Serif 4"');
    expect(m.fontFaceCss).toContain('font-weight: 400 700');
    expect(m.fontFaceCss).toMatch(/src: url\("blob:/);
    expect(m.fontFaceCss).toContain('format("woff2")');
  });

  it('resolves src RELATIVE TO THE DECLARING FILE and reads the resolved path', async () => {
    const read = vi.fn(ok);
    await mintThemeAssets({ fonts: [{ family: 'A', src: '../fonts/a.woff2' }] }, '/app/themes/x.css', read);
    expect(read).toHaveBeenCalledWith('/app/fonts/a.woff2');
  });

  it('named assets become --asset-<name> vars on .grove-root', async () => {
    const m = await mintThemeAssets({ assets: { paper: './textures/paper.jpg' } }, '/app/themes/x.css', ok);
    expect(m.assetVarsCss).toMatch(/^\.grove-root\{--asset-paper: url\("blob:/);
    expect(m.minted).toBe(1);
  });

  it('malformed names/refs are skipped, not thrown', async () => {
    const m = await mintThemeAssets(
      { assets: { 'bad name': './x.png', 'also__bad!': './y.png', ok: './z.png' } },
      '/app/t.css',
      ok,
    );
    expect(m.minted).toBe(1);
    expect(m.assetVarsCss).toContain('--asset-ok');
  });
});

describe('degrade, never break', () => {
  it('a missing font file skips its @font-face — the token fallback answers', async () => {
    const m = await mintThemeAssets(
      { fonts: [{ family: 'Here', src: './here.woff2' }, { family: 'Gone', src: './gone.woff2' }] },
      '/app/t.css',
      async (p) => (p.endsWith('here.woff2') ? BYTES : Promise.reject(new Error('ENOENT'))),
    );
    expect(m.minted).toBe(1);
    expect(m.fontFaceCss).toContain('"Here"');
    expect(m.fontFaceCss).not.toContain('"Gone"');
  });

  it('a missing named asset skips its var — the var() fallback answers', async () => {
    const m = await mintThemeAssets({ assets: { paper: './none.jpg' } }, '/app/t.css', miss);
    expect(m.minted).toBe(0);
    expect(m.assetVarsCss).toBe('');
  });

  it('nothing throws for an all-missing set', async () => {
    const m = await mintThemeAssets({ fonts: [{ family: 'X', src: './x.woff2' }], assets: { a: './b.png' } }, '/app/t.css', miss);
    expect(m.minted).toBe(0);
    expect(m.fontFaceCss).toBe('');
    expect(m.assetVarsCss).toBe('');
  });
});

describe('the revoke scope is the theme lifetime (no leak on switch)', () => {
  it('revoke() releases every minted URL exactly once (idempotent)', async () => {
    const m = await mintThemeAssets(
      { fonts: [{ family: 'A', src: './a.woff2' }], assets: { b: './b.png' } },
      '/app/t.css',
      ok,
    );
    expect(m.minted).toBe(2);
    m.revoke();
    m.revoke(); // idempotent
    expect(revokeSpy).toHaveBeenCalledTimes(2);
  });

  it('mint → revoke → mint again mints FRESH URLs (a switch leaks nothing)', async () => {
    const first = await mintThemeAssets({ fonts: [{ family: 'A', src: './a.woff2' }] }, '/app/t.css', ok);
    const urls1 = first.fontFaceCss;
    first.revoke();
    const second = await mintThemeAssets({ fonts: [{ family: 'A', src: './a.woff2' }] }, '/app/t.css', ok);
    expect(second.minted).toBe(1);
    expect(second.fontFaceCss).not.toBe(urls1); // distinct URL per mint
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    second.revoke();
  });
});

describe('UNDER DISPATCH no chroot prefix reaches a minted URL or @font-face src', () => {
  it('the minted output is blob:-only — the mount path appears nowhere in it', async () => {
    const m = await mintThemeAssets(
      { fonts: [{ family: 'A', src: './a.woff2' }], assets: { b: './b.png' } },
      '/mnt/abc123def456/themes/x.css',
      ok,
    );
    const all = m.fontFaceCss + m.assetVarsCss;
    expect(all).not.toContain('mnt');
    expect(all).not.toContain('abc123def456');
    expect(all).toMatch(/blob:/);
  });

  it('NON-VACUOUS by fault injection: the same assertion catches a leaking src', () => {
    // The canary: the regression class this exit exists for — an implementation
    // that writes the resolved path into the CSS instead of the minted URL.
    const leaky = `@font-face{src: url("/mnt/abc123def456/themes/a.woff2");}`;
    expect(() => {
      expect(leaky).not.toContain('abc123def456');
    }).toThrow();
  });
});
