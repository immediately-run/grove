// The corpus change feed for a dispatched viewer (R3-1373).
//
// The host relays the reader's working-tree edits into the published corpus mount as
// mount-anchored `fs-change` batches (site-main R3-1372), and the sandbox turns those into
// `fs.promises.watch` events (FILESYSTEM_SPEC §2.2, the remote leg). This module is the
// Grove end: one recursive watch on the corpus root, each event joined back to an
// absolute path — the key the metadata index and the source cache both use.
//
// Not `onFsChange`: that stream is gated on elevated `editor:read`, which a dispatched
// viewer does not hold, so it never arrives here.
//
// Two platform facts shape it (the todo repo's `src/lib/store.ts` `watchDir` found them):
//   1. ZenFS core and the sandbox relay ignore AbortSignal — the iterator's own `return()`
//      is the only stop both honour.
//   2. Setting the watch up can fail (no fs before boot, a mount that is gone): end quietly
//      with one warning, never an unhandled rejection. The index is still right; it is
//      only no longer live.

/** One watch event, Node's shape: a type and a filename relative to the watched path. */
export interface CorpusWatchEvent {
  eventType: string;
  filename: string | null;
}

type WatchIterator = AsyncIterable<CorpusWatchEvent> & { return?: () => Promise<unknown> };

/** End a watch. A backend whose `return()` rejects at teardown must not leave an
 *  unhandled rejection behind an unmount (R3-1373 review, 1-A-2). */
function stopIterator(iterator: WatchIterator): void {
  try {
    void iterator.return?.()?.catch?.((err: unknown) => console.warn('[grove] stopping a corpus watch failed', err));
  } catch (err) {
    console.warn('[grove] stopping a corpus watch failed', err);
  }
}

/** The slice of `fs.promises` the watch needs — injected, so it tests without a sandbox. */
export interface WatchFs {
  watch(path: string, opts: { recursive: true }): AsyncIterable<CorpusWatchEvent>;
}

/**
 * Watch `root` recursively and call `onPaths` with the absolute paths that changed. Events
 * arriving before the next macrotask are delivered as one deduplicated batch: the host
 * relays a whole change batch at once, and an editor save can touch a file more than once.
 * Returns the stop function.
 */
export function watchCorpus(root: string, fs: WatchFs, onPaths: (absPaths: string[]) => void): () => void {
  const base = root.endsWith('/') ? root : `${root}/`;
  let stopped = false;
  let iterator: WatchIterator | null = null;
  let pending: Set<string> | null = null;

  const flush = (): void => {
    const batch = pending;
    pending = null;
    if (stopped || !batch || batch.size === 0) return;
    try {
      onPaths([...batch]);
    } catch (err) {
      console.warn('[grove] a corpus change listener threw', err);
    }
  };

  void (async () => {
    try {
      iterator = fs.watch(root, { recursive: true }) as WatchIterator;
      if (stopped) {
        stopIterator(iterator);
        return;
      }
      for await (const event of iterator) {
        if (stopped) break;
        const name = event.filename?.replace(/^\/+/, '');
        if (!name) continue;
        if (pending === null) {
          pending = new Set();
          setTimeout(flush, 0);
        }
        pending.add(`${base}${name}`);
      }
    } catch (err) {
      if (!stopped) console.warn(`[grove] watching ${root} failed; edits need a reload`, err);
    }
  })();

  return () => {
    if (stopped) return;
    stopped = true;
    pending = null;
    if (iterator) stopIterator(iterator);
  };
}
