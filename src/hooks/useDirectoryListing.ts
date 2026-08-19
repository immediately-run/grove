// Does this key name a DIRECTORY, and what is in it?
//
// The frontmatter index cannot answer this. It holds `.md`/`.mdx` entries only, so a
// folder of assets is invisible to it and a folder whose only child is an image would
// read as "nothing here". The filesystem is the authority, so this hook asks it — the
// one effectful step in the directory feature (the rules live in `lib/directory`).
//
// It runs ONLY for a key the entry index already missed, which is the whole cost
// argument: an ordinary page render performs no extra I/O, and the readdir happens on
// the path that was about to render a 404 anyway.

import { useEffect, useState } from 'react';
import fs from 'fs';
import type { DirEntry } from '../lib/directory';

export type DirectoryListing =
  /** Not asked (a resolved entry), or the key is a file — render the entry / the 404. */
  | { status: 'none' }
  /** The readdir is in flight. Callers must NOT show the 404 here: a 404 that flashes
   *  and then becomes a listing reads as a broken link that healed itself. */
  | { status: 'checking' }
  | { status: 'ready'; entries: DirEntry[] };

/** The `fs.promises` slice this hook needs — injectable so the effect is testable. */
export interface ReaddirFs {
  readdir(path: string, opts: { withFileTypes: true }): Promise<Array<{ name: string; isDirectory(): boolean }>>;
}

/** Read `dirKey`, or do nothing when it is null. A read that throws means "not a
 *  directory" (ENOTDIR/ENOENT are the same answer to the only question asked). */
export function useDirectoryListing(dirKey: string | null, io?: ReaddirFs): DirectoryListing {
  const [state, setState] = useState<{ key: string; entries: DirEntry[] | null } | null>(null);

  useEffect(() => {
    if (!dirKey || state?.key === dirKey) return;
    let cancelled = false;
    const api = io ?? (fs.promises as unknown as ReaddirFs);
    api
      .readdir(dirKey, { withFileTypes: true })
      .then((items) => {
        if (!cancelled) {
          setState({ key: dirKey, entries: items.map((i) => ({ name: i.name, isDirectory: i.isDirectory() })) });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ key: dirKey, entries: null });
      });
    return () => {
      cancelled = true;
    };
  }, [dirKey, state?.key, io]);

  if (!dirKey) return { status: 'none' };
  if (state?.key !== dirKey) return { status: 'checking' };
  return state.entries ? { status: 'ready', entries: state.entries } : { status: 'none' };
}
