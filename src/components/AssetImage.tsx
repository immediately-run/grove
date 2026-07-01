import { useContext, useMemo } from 'react';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { MountImage } from '@immediately-run/sdk';
import type { SandboxMount } from '@immediately-run/sdk';
import { toFsPath } from '../lib/content';

// MDX `img` override: display a mount-relative image by reading its bytes off the
// sandbox fs (the opaque-origin iframe can't fetch a relative path). Resolves the
// src relative to the entry currently being rendered (navigationState.sandboxPath),
// then hands the file to the SDK's `MountImage`, which owns the read → object URL →
// revoke lifecycle we used to hand-roll here.

function resolvePath(basePath: string, relativePath: string): string {
  if (relativePath.startsWith('/')) return relativePath;
  const parts = basePath.split('/');
  parts.pop();
  for (const part of relativePath.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { navigationState } = useContext(TinkerableContext) as any;

  const relPath = useMemo(() => {
    // The entry's absolute fs path (/app/content/...) is the base for relative assets.
    const base = toFsPath(navigationState?.sandboxPath || '/');
    return resolvePath(base, src).replace(/^\/+/, '');
  }, [navigationState?.sandboxPath, src]);

  return (
    <MountImage
      mount={ROOT_MOUNT}
      relPath={relPath}
      alt={alt}
      className={className || 'grove-img__el'}
      placeholder={
        <span className="grove-img__box" style={{ display: 'block', minHeight: 80 }} />
      }
      fallback={<span className="grove-img__cap">missing asset: {src}</span>}
    />
  );
}
