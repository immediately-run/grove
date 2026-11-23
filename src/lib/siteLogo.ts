// The site's mark — the `logo:` frontmatter key, the image the nav and the drawer show
// beside `site:` in place of the gradient tile.
//
// Same precedence as `site:`: the entry's own value first, then the home entry's, so a
// corpus declares it once on its home page. The asset resolves against the entry that
// DECLARED it (R3-313's rule for `cover:`), not the page being read, so a home-relative
// `logo: icon.png` still finds `icon.png` beside the home page from a ticket three
// folders down. Pure: no fs, no React.

import { displayText } from './displayText';

export interface SiteLogo {
  /** The declaring entry's fs path (the metadata key) — the asset's base. */
  entryPath: string;
  /** The declared reference: entry-relative, or `/…` absolute. */
  src: string;
}

type Meta = { logo?: unknown } | null | undefined;

const declared = (meta: Meta): string => (displayText(meta?.logo) ?? '').trim();

/** The logo to show on `entryKey`, or `null` when neither it nor home declares one. */
export function resolveSiteLogo(entryKey: string, meta: Meta, homeKey: string, homeMeta: Meta): SiteLogo | null {
  const own = declared(meta);
  if (own) return { entryPath: entryKey, src: own };
  const home = declared(homeMeta);
  if (home) return { entryPath: homeKey, src: home };
  return null;
}
