import { useContext, useEffect, useMemo, useState } from 'react';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import fs from 'fs';
import { toFsPath } from '../lib/content';

// MDX `img` override: resolve a mount-relative image path to a displayable object
// URL by reading its bytes off the sandbox fs (the opaque-origin iframe can't
// fetch a relative path). Resolves relative to the entry currently being rendered
// (navigationState.sandboxPath) and revokes the object URL on unmount.

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

const MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

interface Props {
  src?: string;
  alt?: string;
  className?: string;
}

export default function AssetImage({ src = '', alt = '', className }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { navigationState } = useContext(TinkerableContext) as any;
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const abs = useMemo(() => {
    // The entry's absolute fs path (/app/content/...) is the base for relative assets.
    const base = toFsPath(navigationState?.sandboxPath || '/');
    return resolvePath(base, src);
  }, [navigationState?.sandboxPath, src]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const ext = (src.split('.').pop() || '').toLowerCase();
    fs.promises
      .readFile(abs)
      .then((bytes: unknown) => {
        if (!active) return;
        const arr = bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(String(bytes));
        objectUrl = URL.createObjectURL(
          new Blob([arr as BlobPart], { type: MIME[ext] || 'application/octet-stream' })
        );
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setMissing(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [abs, src]);

  if (missing) return <span className="grove-img__cap">missing asset: {src}</span>;
  if (!url) return <span className="grove-img__box" style={{ display: 'block', minHeight: 80 }} />;
  return <img className={className || 'grove-img__el'} src={url} alt={alt} />;
}
