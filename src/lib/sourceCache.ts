// The raw-source read cache behind the interpreter body renderer — pure, injectable, and
// separate from the component so its failure behaviour can be tested without a host.
//
// `use()` needs a STABLE promise across renders, so reads are memoised per path. The
// subtlety is what happens when a read FAILS: a rejected promise left in the cache is
// returned to every later render, so the entry can never recover. That is not theoretical
// — the host↔sandbox RPC drops requests during a navigation ("Invalid RPC id"), and an
// entry whose read lost that race stayed **permanently blank for the rest of the session**,
// with no error and no way back short of a reload. Evicting on rejection makes the next
// attempt a fresh read, so a transient failure costs a retry instead of the page.

export type Reader = (path: string) => Promise<string>;

export interface SourceCache {
  read: (path: string) => Promise<string>;
  /** Drop a memoised read (a live edit, or an explicit refresh). */
  invalidate: (path?: string) => void;
  /** Testing/diagnostics: how many paths are memoised right now. */
  size: () => number;
}

export function createSourceCache(reader: Reader): SourceCache {
  const cache = new Map<string, Promise<string>>();
  return {
    read(path) {
      const hit = cache.get(path);
      if (hit) return hit;
      const p = reader(path).catch((err) => {
        // Never let a failure become the permanent answer for this path.
        if (cache.get(path) === p) cache.delete(path);
        throw err;
      });
      cache.set(path, p);
      return p;
    },
    invalidate(path) {
      if (path === undefined) cache.clear();
      else cache.delete(path);
    },
    size: () => cache.size,
  };
}
