// The theme catalogue for the theme menu (id → label + swatch gradient). Data,
// not components — kept out of the chrome components per the Fast-Refresh rule.
//
// R3-308: every theme declares BOTH polarities (its CSS block pair) and a
// `preferred` one — the polarity a wiki opens in when neither the reader nor the
// host has said otherwise (02-theme-contract §4). The catalogue ids must match
// the `[data-grove-theme="…"]` selectors in GroveApp.css; the contrast check in
// `scripts/check-theme-contrast.mjs` reads both and fails if they drift apart.
import type { Polarity } from '../lib/themeSelection';

export interface Theme {
  id: string;
  label: string;
  swatch: string;
  /** The polarity this theme opens in absent a reader/host opinion. */
  preferred: Polarity;
}

export const THEMES: Theme[] = [
  {
    id: 'default',
    label: 'immediately.run',
    swatch: 'linear-gradient(96deg,#f6f1fb,#f49ad4 46%,#b285f2)',
    preferred: 'dark',
  },
  { id: 'pixies', label: 'Pixies', swatch: 'linear-gradient(96deg,#ffe14d,#ff2d8e 50%,#9d29ff)', preferred: 'dark' },
  {
    id: 'family',
    label: 'Family journal',
    swatch: 'linear-gradient(96deg,#f3cf9a,#e09a6a 50%,#c8744f)',
    preferred: 'light',
  },
  {
    id: 'lotr',
    label: 'Middle-earth',
    swatch: 'linear-gradient(96deg,#b89a56,#8a6a36 50%,#4a5a38)',
    preferred: 'light',
  },
];

/** The preferred polarity of a palette id — unknown ids fall back to dark, the
 * long-standing Grove default, rather than throwing in a render path. */
export function preferredPolarity(id: string): Polarity {
  return THEMES.find((t) => t.id === id)?.preferred ?? 'dark';
}
