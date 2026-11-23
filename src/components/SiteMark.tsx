import type { SiteLogo } from '../lib/siteLogo';
import EntryImage from './EntryImage';

// The site's mark beside its title: the corpus's `logo:` image, or the gradient tile
// when there is none. A missing or unreadable logo degrades to the tile too, never to a
// broken-image glyph (EntryImage's contract). `alt` is empty because the site title sits
// right beside it — the image is decoration, the text is the name.
export default function SiteMark({ logo, className }: { logo: SiteLogo | null; className: string }) {
  const tile = <span className={className} />;
  if (!logo) return tile;
  return <EntryImage entryPath={logo.entryPath} src={logo.src} alt="" className={className} degrade={tile} />;
}
