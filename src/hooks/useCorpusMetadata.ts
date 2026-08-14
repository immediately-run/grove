// The dispatched corpus's frontmatter index (R3-265).
//
// A FORK gets its index from the bundler and this hook does nothing. A DISPATCHED viewer
// has to build it: the corpus is a mount the bundler never scanned, so without this the
// wiki renders with empty nav, empty sidebar, no search, no backlinks and no routing —
// silently, because an absent index is indistinguishable from an empty corpus.
//
// The scan runs ONCE per root and the result is handed to `TinkerableContext.filesMetadata`,
// which is where `useMetadataQuery` / `useFileMetadata` / `useAllMetadata` already read
// from — so every consumer keeps working untouched.

import { useEffect, useState } from 'react';
import fs from 'fs';
import { scanCorpus, type CorpusMetadata, type ScanFs } from '../lib/corpusScan';

export interface CorpusIndex {
  /** `idle` — a fork, nothing to scan · `scanning` — hold the render · `ready` — use it. */
  status: 'idle' | 'scanning' | 'ready';
  metadata: CorpusMetadata | null;
}

/** Scan `root`, or do nothing when it is null (the fork packaging). */
export function useCorpusMetadata(root: string | null): CorpusIndex {
  const [index, setIndex] = useState<{ root: string; metadata: CorpusMetadata } | null>(null);

  useEffect(() => {
    if (!root || index?.root === root) return;
    let cancelled = false;
    void scanCorpus(root, fs.promises as unknown as ScanFs).then((metadata) => {
      // A corpus that resolves to nothing is still a result: `ready` with an empty map
      // renders the 404 index, which tells the reader the folder has no entries. Staying
      // in `scanning` forever would show a spinner and say nothing.
      if (!cancelled) setIndex({ root, metadata });
    });
    return () => {
      cancelled = true;
    };
  }, [root, index?.root]);

  if (!root) return { status: 'idle', metadata: null };
  if (index?.root === root) return { status: 'ready', metadata: index.metadata };
  return { status: 'scanning', metadata: null };
}
