// The map a safe renderer passes to the SDK interpreter (R3-1290): the shell's vocabulary,
// layered by `safeVocabulary`, or stock `SAFE_MDX` when no App provided one. Memoized on the
// shell map, which App captures once, so a re-render hands the renderer the same object.

import { useMemo } from 'react';
import { SAFE_MDX } from '../mdxComponents';
import { useShellVocabulary } from '../lib/shell';
import { safeVocabulary } from '../lib/safeVocabulary';

export function useSafeVocabulary(): Record<string, unknown> {
  const shell = useShellVocabulary();
  return useMemo(() => (shell ? safeVocabulary(shell) : SAFE_MDX), [shell]);
}
