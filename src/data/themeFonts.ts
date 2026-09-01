// The per-theme face sets (R3-310; the R3-315 declared-asset mechanism): the
// engine default's families plus the two catalogue looks that change the reading
// face. `archive` puts a serif in `--sans` — the contract's documented role rule
// ("`--sans` is the body face, whatever face that is"); `journal` reads warm in
// Lora; `editorial` is loud through weight, tracking and colour, not through a
// new face, so it keeps the default set. Data, not components.

import type { ThemeAssetDeclarations } from '../lib/themeAssets';

const F = (family: string, file: string, weight: string) => ({ family, src: `/app/assets/fonts/${file}`, weight, style: 'normal' });

/** The engine default: Gabarito (display) · Public Sans (body) · Space Mono. */
export const DEFAULT_THEME_ASSETS: ThemeAssetDeclarations = {
  fonts: [
    F('Gabarito', 'gabarito-latin-400-normal.woff2', '400'),
    F('Gabarito', 'gabarito-latin-500-normal.woff2', '500'),
    F('Gabarito', 'gabarito-latin-600-normal.woff2', '600'),
    F('Gabarito', 'gabarito-latin-700-normal.woff2', '700'),
    F('Gabarito', 'gabarito-latin-800-normal.woff2', '800'),
    F('Gabarito', 'gabarito-latin-900-normal.woff2', '900'),
    F('Public Sans', 'public-sans-latin-400-normal.woff2', '400'),
    F('Public Sans', 'public-sans-latin-500-normal.woff2', '500'),
    F('Public Sans', 'public-sans-latin-600-normal.woff2', '600'),
    F('Public Sans', 'public-sans-latin-700-normal.woff2', '700'),
    F('Space Mono', 'space-mono-latin-400-normal.woff2', '400'),
    F('Space Mono', 'space-mono-latin-700-normal.woff2', '700'),
  ],
};

/** `archive` — the reading face is Source Serif 4 (dense reference); display
 *  keeps Gabarito so nav and furniture stay legible-brand. */
export const ARCHIVE_THEME_ASSETS: ThemeAssetDeclarations = {
  fonts: [
    ...DEFAULT_THEME_ASSETS.fonts!,
    F('Source Serif 4', 'source-serif-4-latin-400-normal.woff2', '400'),
    F('Source Serif 4', 'source-serif-4-latin-500-normal.woff2', '500'),
    F('Source Serif 4', 'source-serif-4-latin-600-normal.woff2', '600'),
    F('Source Serif 4', 'source-serif-4-latin-700-normal.woff2', '700'),
  ],
};

/** `journal` — the reading face is Lora (warm, personal); display keeps Gabarito. */
export const JOURNAL_THEME_ASSETS: ThemeAssetDeclarations = {
  fonts: [
    ...DEFAULT_THEME_ASSETS.fonts!,
    F('Lora', 'lora-latin-400-normal.woff2', '400'),
    F('Lora', 'lora-latin-500-normal.woff2', '500'),
    F('Lora', 'lora-latin-600-normal.woff2', '600'),
    F('Lora', 'lora-latin-700-normal.woff2', '700'),
  ],
};

/** The declaration set a theme mints — default/editorial share the engine set. */
export function themeAssetsFor(theme: string): ThemeAssetDeclarations {
  if (theme === 'archive') return ARCHIVE_THEME_ASSETS;
  if (theme === 'journal') return JOURNAL_THEME_ASSETS;
  return DEFAULT_THEME_ASSETS;
}
