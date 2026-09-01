// The shipped default face set (R3-315): the families `index.css`'s tokens name —
// Gabarito (display), Public Sans (body), Space Mono (details) — as DECLARED
// assets the engine mints from in-repo bytes, replacing the Google Fonts
// `@import` that broke offline in every stance and was blocked under compiled
// dispatch of a low-trust corpus. Data, not components.
//
// `archive` and `journal` (R3-310's catalogue themes) declare their own faces the
// same way — this set is the engine default's declaration, and the worked example
// every token-only theme copies.

import type { ThemeAssetDeclarations } from '../lib/themeAssets';

// Absolute refs for the ENGINE's own set (anchored at the app repo root, which
// is where the bytes ship); a CONTENT theme's declarations stay entry-relative —
// that is the mechanism the minter exists to serve.
const F = (family: string, file: string, weight: string) => ({ family, src: `/app/assets/fonts/${file}`, weight, style: 'normal' });

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
