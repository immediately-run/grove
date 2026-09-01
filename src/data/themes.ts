// The theme catalogue for the theme menu (id → label + swatch gradient). Data,
// not components — kept out of the chrome components per the Fast-Refresh rule.
//
// R3-310: the catalogue is four shippable looks; the three showcase skins
// (pixies/family/lotr — drawn for a fictional handbook, reading as costumes) are
// retired. archive/journal/editorial are keyed to uses a real corpus has.
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
  {
    id: 'archive',
    label: 'Archive',
    swatch: 'linear-gradient(96deg,#b89a56,#7a5c20 55%,#3f5a63)',
    preferred: 'light',
  },
  {
    id: 'journal',
    label: 'Journal',
    swatch: 'linear-gradient(96deg,#e8c9a0,#c08552 50%,#a25a3c)',
    preferred: 'light',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    swatch: 'linear-gradient(96deg,#ffd64f,#ff4d2e 55%,#37d4a8)',
    preferred: 'dark',
  },
];

/** The preferred polarity of a palette id — unknown ids fall back to dark, the
 * long-standing Grove default, rather than throwing in a render path. */
export function preferredPolarity(id: string): Polarity {
  return THEMES.find((t) => t.id === id)?.preferred ?? 'dark';
}
