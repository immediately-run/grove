// The interpreter's component map, layered in ONE place (R3-1290).
//
// Under `render: safe` a body renders as data through the SDK's safe renderer, which
// resolves tags only from the map it is handed. That map is the SHELL's vocabulary — the
// components the viewer itself registered with `boot({ mdxComponents })`: stock Grove's
// `GROVE_MDX`, or a library-mode shell's composition of it (`composeComponents`, then
// `extendComponents`). The shell's components are the viewer's own code, so they may render
// safe content; a corpus's declared components never reach this map (R3-1289 stops loading
// them, and the safe renderers read the shell's map from `ShellVocabularyContext`, captured
// above the corpus provider, never the nearest provider).
//
// Layered exactly as `boot()` layers the compiled path: the sanitizing structural tags at
// the bottom, the SDK defaults over them, the shell's map on top — so `GROVE_MDX`'s `a` and
// `img` (`WikiLink`, `AssetImage`) win, and a shell's override wins over stock.
//
// This file exports no components, so it is exempt from the Fast-Refresh rule.

import { DEFAULT_MDX_COMPONENTS } from '@immediately-run/sdk';
import { SAFE_INTRINSICS } from './safeIntrinsics';

/** The safe renderer's map for a shell vocabulary. */
export function safeVocabulary(shellMap: Record<string, unknown>): Record<string, unknown> {
  return {
    ...SAFE_INTRINSICS,
    ...(DEFAULT_MDX_COMPONENTS as Record<string, unknown>),
    ...shellMap,
  };
}
