import { useEffect, useMemo, useRef, useState } from 'react';
import { gateStylesheet } from '../lib/contentStylesheet';
import { mintThemeAssets, type MintedThemeAssets } from '../lib/themeAssets';
import { openFs } from '@immediately-run/sdk';

// A bundle's own look, carried as content (R3-316): each `ui/stylesheet` entry's
// body is gated by the grammar (declarations only — a selector, at-rule, `url(`,
// `@import` or `@font-face` is rejected with the line named, never silently
// dropped) and admitted ONLY into the lowest cascade layer (`grove.content`),
// where it can style tokens and nothing else. The entry's frontmatter may
// declare `fonts:`/`assets:` — minted by the engine exactly as an engine theme's
// are, so a content theme can change the reading face without naming a location.
//
// Gating is PURE and runs in render (a rejected sheet contributes nothing that
// frame); only the byte-reading mint is effectful.
//
// THE ESCAPE HATCH: the theme control (`.grove-theme-control`) is pinned by
// protective declarations in `grove.reset` — the FIRST layer, which for
// !important beats every later layer including `grove.content` — so a planted
// stylesheet cannot hide the way back to a shipped theme. Proven by test, not by
// reading the layer declaration.

const ROOT_MOUNT = { path: '/', type: 'repo' } as const;

export interface ContentStylesheet {
  /** The entry's absolute fs path (the declaring file for its asset refs). */
  path: string;
  /** The raw body bytes (CSS). */
  css: string;
  /** The entry's declared fonts/assets, if any. */
  declarations: { fonts?: unknown; assets?: unknown };
}

interface Props {
  sheets: ContentStylesheet[];
  /** Where a rejected sheet's verdict goes (the reader-facing degrade). */
  onRejected?: (path: string, verdict: { line: number; reason: string; excerpt: string }) => void;
}

export default function ContentTheme({ sheets, onRejected }: Props) {
  // Gate per render — pure. A sheet with declarations rides; a sheet with a
  // verdict rides its verdict to the caller instead.
  const results = useMemo(
    () => sheets.map((sheet) => ({ sheet, verdict: gateStylesheet(sheet.css) })),
    [sheets],
  );
  const accepted = results.filter((r) => r.verdict.ok);
  const rejected = results.filter((r) => !r.verdict.ok);
  useEffect(() => {
    for (const { sheet, verdict } of rejected) {
      if (verdict.ok) continue;
      onRejected?.(sheet.path, verdict);
    }
  }, [rejected, onRejected]);

  // Declared faces mint through the engine path; the revoke scope is this
  // sheet set's lifetime.
  const [assetCss, setAssetCss] = useState<string>('');
  const mintedRef = useRef<MintedThemeAssets | null>(null);
  const mintKey = accepted.map((a) => a.sheet.path).join('|');
  useEffect(() => {
    let alive = true;
    const sheetsWithAssets = accepted.filter((r) => {
      const d = r.sheet.declarations;
      return (Array.isArray(d.fonts) && d.fonts.length) || (d.assets && Object.keys(d.assets as object).length);
    });
    if (!sheetsWithAssets.length) {
      mintedRef.current?.revoke();
      mintedRef.current = null;
      return;
    }
    const fsApi = openFs(ROOT_MOUNT);
    const decl = accepted.length ? sheetsWithAssets[0].sheet.declarations : {};
    void mintThemeAssets(
      decl as never,
      sheetsWithAssets[0].sheet.path,
      async (p) => {
        const bytes = await fsApi.readFile(p.replace(/^\/+/, ''));
        return typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
      },
    ).then((m) => {
      if (!alive) {
        m.revoke();
        return;
      }
      mintedRef.current?.revoke();
      mintedRef.current = m;
      setAssetCss([m.fontFaceCss, m.assetVarsCss].filter(Boolean).join('\n'));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mintKey is the sheet-set identity
  }, [mintKey]);

  useEffect(
    () => () => {
      mintedRef.current?.revoke();
    },
    [],
  );

  if (!accepted.length && !assetCss) return null;
  const decls = accepted.map((a) => (a.verdict.ok ? a.verdict.declarations : '')).filter(Boolean).join('\n');
  return (
    <>
      {assetCss ? <style data-grove-content-assets="">{assetCss}</style> : null}
      {decls ? <style data-grove-content-theme="">{`@layer grove.content{.grove-root{\n${decls}\n}}`}</style> : null}
    </>
  );
}
