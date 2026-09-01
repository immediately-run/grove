import { MountImage } from '@immediately-run/sdk';
import { entryAssetRelPath } from '../lib/assetPath';

// An image declared BY an entry, rendered somewhere OTHER than that entry's body —
// a `<DocList>` card, a `<Timeline>` row, a hero band. R3-313's resolver: the base
// is the OWNING entry's path (a prop), never the navigation state, so a grid of
// cards for six different entries resolves six different bases correctly.
//
// DEGRADE, NEVER BREAK (R3-313): no `cover:` ⇒ the caller's lattice placeholder; a
// missing or unreadable asset ⇒ the placeholder again — never a broken-image glyph,
// never an error surface. The read is the SDK's (`MountImage` owns read → object
// URL → revoke); nothing here writes, so a read-only mount serves covers as-is.
//
// The rendered `src` is the object URL `MountImage` mints — the resolved corpus
// path (which under dispatch carries the host's chroot prefix) never reaches the
// DOM as an addressable string.

interface Props {
  /** The OWNING entry's absolute fs path (the metadata key). */
  entryPath: string;
  /** The declared asset reference (entry-relative, or `/…` absolute). */
  src?: string | null;
  alt?: string;
  className?: string;
  /** What renders while unreadable or absent — the lattice, by contract. */
  degrade?: React.ReactNode;
}

export default function EntryImage({ entryPath, src, alt = '', className, degrade }: Props) {
  const relPath = entryAssetRelPath(entryPath, src);
  const placeholder = <>{degrade}</>;
  if (!relPath) return placeholder;
  return (
    <MountImage
      mount={ROOT_MOUNT}
      relPath={relPath}
      alt={alt}
      className={className}
      placeholder={placeholder}
      fallback={placeholder}
    />
  );
}

// The whole sandbox fs, `/`-rooted — same anchor `AssetImage` uses: the resolved
// asset path is already absolute in the unified namespace.
const ROOT_MOUNT = { path: '/', type: 'repo' } as const;
