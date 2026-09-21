// The dispatched bundle's frontmatter index (R3-265).
//
// A FORK gets its index from the bundler and this hook does nothing. A DISPATCHED viewer
// has to build it: the bundle is a mount the bundler never scanned, so without this the
// wiki renders with empty nav, empty sidebar, no search, no backlinks and no routing —
// silently, because an absent index is indistinguishable from an empty bundle.
//
// The index is PROGRESSIVE (MDX_FROM_MOUNT_SPEC D8): once the listing is done every key is
// present, and rows fill in as files are read. The caller hands `metadata` to a
// `MetadataSource`, which is where `useMetadataQuery` / `useFileMetadata` / `useAllMetadata`
// read from, and hands `scan` to the entry gate, which asks whether the rows it needs have
// been read.

import { useEffect, useState, useSyncExternalStore } from 'react';
import fs from 'fs';
import {
  createCorpusScan,
  type CorpusMetadata,
  type CorpusScan,
  type CorpusScanSnapshot,
  type CorpusScanStatus,
  type ScanFs,
} from '../lib/corpusScan';

export interface BundleIndex {
  /** `idle` — a fork, nothing to scan · `listing` — hold the render, no key is known yet ·
   *  `reading` — every key is known, rows are filling in · `complete` — every row is read. */
  status: 'idle' | CorpusScanStatus;
  /** Null until the listing is done (and always for a fork). */
  metadata: CorpusMetadata | null;
  /** The running scan, for the entry gate. Null for a fork and before the scan starts. */
  scan: CorpusScan | null;
}

const LISTING: CorpusScanSnapshot = { status: 'listing', metadata: {} };
const noSubscribe = () => () => undefined;
const listingSnapshot = () => LISTING;

/** Scan `root`, or do nothing when it is null (the fork packaging). */
export function useBundleMetadata(root: string | null): BundleIndex {
  const [owned, setOwned] = useState<{ root: string; scan: CorpusScan } | null>(null);

  useEffect(() => {
    if (!root) return;
    const scan = createCorpusScan(root, fs.promises as unknown as ScanFs);
    // The scan is an external resource this effect owns: created here, disposed below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwned({ root, scan });
    return () => scan.dispose();
  }, [root]);

  const scan = owned && owned.root === root ? owned.scan : null;
  const snap = useSyncExternalStore(scan ? scan.subscribe : noSubscribe, scan ? scan.snapshot : listingSnapshot);

  if (!root) return { status: 'idle', metadata: null, scan: null };
  // A bundle that resolves to nothing is still a result: `complete` with an empty map
  // renders the 404 index, which tells the reader the folder has no entries.
  if (snap.status === 'listing') return { status: 'listing', metadata: null, scan };
  return { status: snap.status, metadata: snap.metadata, scan };
}
