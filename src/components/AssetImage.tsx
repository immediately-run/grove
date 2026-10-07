import { useMemo } from 'react';
import { MountImage, useMounts } from '@immediately-run/sdk';
import type { SandboxMount } from '@immediately-run/sdk';
import { keyToFsPath } from '../lib/content';
import { resolvePath, federatedAliasFor } from '../lib/assetPath';
import { useEntryKey } from '../hooks/useEntryKey';

// MDX `img` override: display a mount-relative image by reading its bytes off the
// sandbox fs (the opaque-origin iframe can't fetch a relative path). Resolves the
// src relative to the entry currently being rendered — the entry context's entry,
// not the URL (R3-871: inside an included fragment or a layout, the URL names the
// wrong base) — then hands the file to the SDK's `MountImage`, which owns the
// read → object URL → revoke lifecycle we used to hand-roll here.

// The whole sandbox fs, `/`-rooted. The resolved asset path is already absolute
// (`/app/content/…`), so anchor at root and pass it as the mount-relative path
// (leading slash stripped) — preserving the exact paths the old `fs.readFile` read.
const ROOT_MOUNT: SandboxMount = { path: '/', type: 'repo' };

interface Props {
  src?: string;
  alt?: string;
  className?: string;
}

export default function AssetImage({ src = '', alt = '', className }: Props) {
  const entryKey = useEntryKey();
  const mounts = useMounts();

  const relPath = useMemo(() => {
    // The entry's absolute fs path (/app/content/...) is the base for relative assets.
    const base = keyToFsPath(entryKey);
    return resolvePath(base, src).replace(/^\/+/, '');
  }, [entryKey, src]);

  // R3-1017 (PERSISTENCE §8.3/§8.5): a corpus-absolute src may name a DECLARED
  // federation alias — a `requests.mounts[].at` the host minted a mount for.
  // Read it from that mount; absent an alias the corpus's own path stands
  // (the pre-R3-1017 behavior, and the non-holder's honest degradation below it).
  const federated = useMemo(
    () => (src.startsWith('/') ? federatedAliasFor(mounts, src) : null),
    [mounts, src],
  );
  const targetMount = federated?.mount ?? ROOT_MOUNT;
  const targetRelPath = federated ? federated.relPath : relPath;
  return (
    <MountImage
      mount={targetMount}
      relPath={targetRelPath}
      alt={alt}
      className={className || 'grove-img__el'}
      placeholder={
        <span className="grove-img__box" style={{ display: 'block', minHeight: 80 }} />
      }
      fallback={<span className="grove-img__cap">missing asset: {src}</span>}
    />
  );
}
