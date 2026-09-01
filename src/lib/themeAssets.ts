// Engine-resolved theme assets (R3-315; plan 05-content-carried-themes §4).
//
// A theme DECLARES its fonts and named assets (`fonts: [{family, src, weight,
// style}]`, `assets: {<name>: <relPath>}`, resolved relative to the declaring
// file); the ENGINE reads the bytes off the fs, mints a `blob:` URL for each, and
// hands the result to CSS — an `@font-face` rule per font (emitted into the
// engine-owned cascade layer) and a `--asset-<name>` custom property per asset.
// Content never names a network location at all, which is the point: `blob:` is
// permitted by `img-src`, `font-src` AND `style-src` in every stance including
// M3, so one mechanism serves fork, dispatch and library modes — and the wiki
// renders its faces with the network off, in every stance.
//
// The revoke scope is the THEME'S lifetime, not a component's — `useObjectUrl`'s
// component-scoped revoke does not fit an asset set that outlives any single
// surface, so this module owns the lifecycle explicitly: `revoke()` releases
// every minted URL, and the switching surface calls it on teardown.
//
// DEGRADE, NEVER BREAK: a missing font file skips that `@font-face` (the token's
// fallback stack answers); a missing named asset skips its var (the var()'s own
// fallback answers). Nothing throws and nothing renders a broken glyph.
//
// The minted URLs carry no path information (`blob:` + origin), so under dispatch
// the chroot prefix cannot reach a URL or a `@font-face` src by construction —
// asserted, not assumed, in the tests.

import { resolvePath } from './assetPath';

/** One declared webfont. `src` is relative to the declaring file (or `/…` absolute). */
export interface FontDeclaration {
  family: string;
  src: string;
  /** CSS `font-weight` descriptor, e.g. `'400 700'` or `'700'`. */
  weight?: string;
  /** CSS `font-style` descriptor, e.g. `'normal'` | `'italic'`. */
  style?: string;
}

/** The asset declarations a theme (or the engine's own default set) carries. */
export interface ThemeAssetDeclarations {
  fonts?: FontDeclaration[];
  assets?: Record<string, string>;
}

/** The minted result: CSS the engine owns, plus the revoke handle. */
export interface MintedThemeAssets {
  /** `@font-face` rules with `blob:` srcs — the caller emits these inside the
   *  engine cascade layer. Empty when nothing declared or everything degraded. */
  fontFaceCss: string;
  /** A `.grove-root` rule assigning `--asset-<name>: url(blob:…)` per minted
   *  asset — empty when nothing declared or everything degraded. */
  assetVarsCss: string;
  /** How many URLs were minted (observable for leak tests). */
  minted: number;
  /** Release every minted URL. Idempotent. */
  revoke(): void;
}

/** The bytes-read the minter needs — injected so tests spy and fault-inject. */
export type AssetReader = (absPath: string) => Promise<Uint8Array<ArrayBuffer> | string>;

const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};
const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

function ext(p: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(p);
  return m ? m[1].toLowerCase() : '';
}

/**
 * Mint the blob URLs + CSS for a declaration set.
 *
 * @param decls   the fonts/assets the declaring file asked for
 * @param basePath the DECLARING FILE's absolute fs path (resolution base)
 * @param read    the bytes-read (fs)
 */
export async function mintThemeAssets(
  decls: ThemeAssetDeclarations,
  basePath: string,
  read: AssetReader,
): Promise<MintedThemeAssets> {
  const urls: string[] = [];
  const fontRules: string[] = [];
  const varRules: string[] = [];

  const mint = async (ref: string): Promise<string | null> => {
    try {
      const abs = resolvePath(basePath, ref);
      const bytes = await read(abs);
      const e = ext(abs);
      const type = FONT_MIME[e] ?? IMAGE_MIME[e] ?? 'application/octet-stream';
      const url = URL.createObjectURL(new Blob([bytes], { type }));
      urls.push(url);
      return url;
    } catch {
      return null; // degrade: the fallback stack / var() fallback answers
    }
  };

  for (const f of decls.fonts ?? []) {
    if (!f || typeof f.family !== 'string' || typeof f.src !== 'string') continue;
    const url = await mint(f.src);
    if (!url) continue;
    const descriptors = [
      `font-family: ${JSON.stringify(f.family)}`,
      `src: url(${JSON.stringify(url)}) format(${JSON.stringify(ext(f.src) === 'woff2' ? 'woff2' : ext(f.src))})`,
      ...(f.weight ? [`font-weight: ${f.weight}`] : []),
      ...(f.style ? [`font-style: ${f.style}`] : []),
      'font-display: swap',
    ];
    fontRules.push(`@font-face{${descriptors.join(';')}}`);
  }

  for (const [name, ref] of Object.entries(decls.assets ?? {})) {
    if (!/^[a-z][a-z0-9-]*$/i.test(name) || typeof ref !== 'string') continue;
    const url = await mint(ref);
    if (!url) continue;
    varRules.push(`--asset-${name}: url(${JSON.stringify(url)});`);
  }

  let revoked = false;
  return {
    fontFaceCss: fontRules.join('\n'),
    assetVarsCss: varRules.length ? `.grove-root{${varRules.join('')}}` : '',
    minted: urls.length,
    revoke() {
      if (revoked) return;
      revoked = true;
      for (const u of urls) URL.revokeObjectURL(u);
    },
  };
}
