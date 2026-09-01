import { useEffect, useRef, useState } from 'react';
import { mintThemeAssets, type MintedThemeAssets, type ThemeAssetDeclarations } from '../lib/themeAssets';
import { openFs } from '@immediately-run/sdk';

// The engine-owned emission of a declaration set's minted assets (R3-315): one
// `<style data-grove-theme-assets>` carrying the `@font-face` rules inside the
// ENGINE cascade layer and the `--asset-*` assignments on `.grove-root`. The
// revoke scope is the declaration set's lifetime — switching themes (or a reader
// override re-resolving the set) revokes the outgoing URLs before the incoming
// ones mint, so repeated switches leak nothing.
//
// Nothing here is content-styleable: the layer order in `index.css` namespaces
// these rules as `grove.engine`, below the reset but above theme and content.

/** The declaring-file anchor for the engine's own default set — the app repo root
 *  (fork AND dispatch load the engine from this repo; `/app` is its own tree). */
const ENGINE_DECLARING_FILE = '/app/src/index.css';

// The whole sandbox fs, `/`-rooted — the same anchor `AssetImage`/`EntryImage` use.
const ROOT_MOUNT = { path: '/', type: 'repo' } as const;

interface Props {
  declarations: ThemeAssetDeclarations;
  /** Absolute fs path of the file the declarations live in (resolution base). */
  basePath?: string;
}

export default function ThemeAssets({ declarations, basePath = ENGINE_DECLARING_FILE }: Props) {
  const [minted, setMinted] = useState<MintedThemeAssets | null>(null);
  // The CURRENT set, reached from the cleanup — a setState updater does NOT run
  // on unmount (React 18+), so reaching the outgoing URLs only through state
  // would leak them exactly there.
  const mintedRef = useRef<MintedThemeAssets | null>(null);

  useEffect(() => {
    let alive = true;
    // Read through the SDK's fs surface (the same one `MountImage` reads
    // through): it resolves the sandbox's injected shared fs in every stance,
    // where a bare `import fs` would only work where the bundler shims it.
    const rootFs = openFs(ROOT_MOUNT);
    void mintThemeAssets(declarations, basePath, async (p) => {
      const bytes = await rootFs.readFile(p.replace(/^\/+/, ''));
      return typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
    }).then((m) => {
      if (!alive) {
        m.revoke(); // the set changed/unmounted mid-mint — never leak the late arrival
        return;
      }
      mintedRef.current = m;
      setMinted(m);
    });
    return () => {
      alive = false;
      // Revoke the OUTGOING set on switch/unmount — the theme's lifetime ends here.
      mintedRef.current?.revoke();
      mintedRef.current = null;
      setMinted(null);
    };
  }, [declarations, basePath]);

  if (!minted || (!minted.fontFaceCss && !minted.assetVarsCss)) return null;
  return <style data-grove-theme-assets="">{`@layer grove.engine{${minted.fontFaceCss}}\n${minted.assetVarsCss}`}</style>;
}
