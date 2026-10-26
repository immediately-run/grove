// R3-1290 — capture the SHELL's MDX vocabulary: the map the nearest provider holds where this
// is called. App calls it ABOVE the corpus provider it nests below, so the map is the one
// `boot({ mdxComponents })` established (stock `GROVE_MDX`, or a library-mode shell's composed
// map), never a corpus's declared components. With no provider above the caller the map is
// empty, and null keeps the safe path on stock `SAFE_MDX` (`hooks/useSafeVocabulary`).

import { useMDXComponents } from '@immediately-run/sdk/MDXProvider';

/** `useMDXComponents`' argument: no overrides, so it answers the provider's map as is. */
const NO_OVERRIDES = {};

export function useShellVocabularyCapture(): Record<string, unknown> | null {
  const providerMap = useMDXComponents(NO_OVERRIDES) as Record<string, unknown>;
  return Object.keys(providerMap).length > 0 ? providerMap : null;
}
