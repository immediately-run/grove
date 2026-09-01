// Theme selection — the ONE resolution of who picks what a reader sees
// (plans/grove-layouts-and-themes/02-theme-contract.mdx §4, R3-308).
//
// Two INDEPENDENT axes, three sources, stated once here so no surface re-derives
// them (ways_of_working §5: one resolution entry point per concern):
//
//   palette  = reader override, else author declaration, else 'default'
//   polarity = reader override, else host theme,        else the theme's own preferred
//
// The host has an opinion about POLARITY ONLY — it holds `theme:read` for exactly
// that and nothing else, so it never appears in the palette chain. A reader's
// choice outranks everyone and persists; an author's declaration is the default a
// reader falls into, not a wall.
//
// PURE: takes already-read inputs, returns a decision. Where each input comes from
// (localStorage, home-entry frontmatter, the host channel) is wiring, not policy,
// and lives in the components.

/** Light/dark — the axis that selects WITHIN a palette family. */
export type Polarity = 'light' | 'dark';

/** A palette family id — a `Theme['id']`, or any string a reader's override holds. */
export type PaletteId = string;

export interface PaletteInputs {
  /** The reader's stored override (`grove:theme`), if any. */
  reader?: PaletteId | null;
  /** The author's `theme:` declaration on the home entry, if any. */
  author?: PaletteId | null;
}

/**
 * Resolve the palette. An empty/absent override is NOT an override — `''` would
 * otherwise beat a real declaration while meaning nothing. `'default'` as a READER
 * choice is meaningful ("the brand palette, even though this wiki declares another"),
 * so any explicit reader value — `default` included — outranks the author.
 */
export function resolvePalette({ reader, author }: PaletteInputs): PaletteId {
  if (reader) return reader;
  if (author) return author;
  return 'default';
}

export interface PolarityInputs {
  /** The reader's stored override (`grove:appearance`), if any. */
  reader?: Polarity | null;
  /** The host's current theme, when the host has one (standalone: the channel's
   *  initial — the host axis simply has no live source there). */
  host?: Polarity | null;
  /** The resolved palette's own preferred polarity. */
  preferred: Polarity;
}

/** Resolve the polarity. Reader, then host, then the palette's own preference. */
export function resolvePolarity({ reader, host, preferred }: PolarityInputs): Polarity {
  if (reader === 'light' || reader === 'dark') return reader;
  if (host === 'light' || host === 'dark') return host;
  return preferred;
}
