// Typed views over viewer.manifest.json's catalogue sections — the manifest is
// the contract (R3-309/R3-311): every shipped theme, page variant, starter and
// collection shape is enumerated THERE, and the gallery entries render FROM it,
// so adding an entry to the manifest adds a row with no edit to any entry.

import manifest from '../../viewer.manifest.json';

export interface ManifestTheme {
  label: string;
  preferred: 'light' | 'dark';
  ships: boolean;
  summary: string;
}
export interface ManifestPageVariant {
  key: string;
  value: string;
  ships: boolean;
  summary: string;
}
export interface ManifestLayout {
  layoutRole: string;
  arranges: string;
  ships: boolean;
  summary: string;
}
export interface ManifestCollection {
  component?: string;
  props?: Record<string, string>;
  ships: boolean;
  summary: string;
}

const cat = manifest as unknown as {
  themes: Record<string, ManifestTheme>;
  pageVariants: Record<string, ManifestPageVariant>;
  layouts: Record<string, ManifestLayout>;
  collections: Record<string, ManifestCollection>;
};

/** The shipped themes, manifest order. */
export const manifestThemes = (): Array<[string, ManifestTheme]> =>
  Object.entries(cat.themes).filter(([, t]) => t.ships);

/** The shipped page variants (bucket B — a frontmatter key on one entry). */
export const manifestPageVariants = (): Array<[string, ManifestPageVariant]> =>
  Object.entries(cat.pageVariants).filter(([, v]) => v.ships);

/** The shipped layout starters (bucket A — a copyable `_layout.mdx`). */
export const manifestLayouts = (): Array<[string, ManifestLayout]> =>
  Object.entries(cat.layouts).filter(([, l]) => l.ships);

/** The shipped collection shapes (bucket C — a component call). */
export const manifestCollections = (): Array<[string, ManifestCollection]> =>
  Object.entries(cat.collections).filter(([, c]) => c.ships);
