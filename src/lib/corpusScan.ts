// The viewer-side corpus scan (R3-265) — how a DISPATCHED Grove learns what its corpus
// contains.
//
// In the fork packaging the frontmatter index is bundler-fed: the sandbox scans the app's
// own MDX at build time and hands the result to `TinkerableContext.filesMetadata`, which is
// what `useMetadataQuery` / `useFileMetadata` / `useAllMetadata` read. Under dispatch the
// corpus is a MOUNT, and the bundler never saw it — so nav, sidebar, search, backlinks,
// routing and the 404 index would all be empty while the files sit right there. Nothing
// errors; the wiki is simply blank, which is the failure mode this module exists to remove.
//
// The scan produces the SAME SHAPE the bundler produces — `Record<absolutePath, metadata>`,
// keyed by the ABSOLUTE path (sandbox #41; the JSDoc that once said "repo-relative" was
// wrong) — so every consumer keeps working with no call-site change. That is the whole
// design: swap the source of the map, not the map.
//
// **The sidecar is the fast path, when there is one.** `R3-168`'s pre-computed frontmatter
// sidecar makes this scan unnecessary for a repo that publishes one. A PRIVATE repo has no
// Pages site and therefore no sidecar BY DESIGN (publishing one would publish the corpus),
// so the scan is not a fallback for the pilot — it is the only path. Wiring the sidecar as a
// fast path is additive and belongs with R3-168.

import type { Frontmatter } from './frontmatter';
import { parseFrontmatter } from './frontmatter';
import { collectHeadings } from '@immediately-run/sdk';

/** The metadata map shape the SDK hooks read (`FilesMetadata`). */
export type CorpusMetadata = Record<string, Frontmatter>;

/** The slice of `fs.promises` the scan needs — injected, so the walk is testable without a
 *  sandbox and without mocking the module registry. */
export interface ScanFs {
  readdir(path: string, opts: { withFileTypes: true }): Promise<Array<{ name: string; isDirectory(): boolean }>>;
  readFile(path: string, encoding: 'utf8'): Promise<string>;
}

/** How many files are read at once. The sandbox fs is an RPC to the host, so a sequential
 *  walk of a 40-entry corpus is 40 round trips of latency; unbounded parallelism instead
 *  floods the channel the rest of the app shares. A small pool is the honest middle. */
const READ_CONCURRENCY = 8;

/** How often a running scan publishes a new metadata map. Every consumer of the index
 *  re-derives on a new identity, so a map per file would re-render the wiki a thousand
 *  times on a large corpus; a key the entry is waiting on publishes at once instead. */
const FLUSH_MS = 250;

/** Entry files. `_layout.mdx` is INCLUDED deliberately: `layoutChainForKey` resolves the
 *  chain by looking for layout keys in this very map, so excluding structural files here
 *  would silently drop every layout under dispatch. Reader-facing enumerations filter with
 *  `isContentEntry`, which is where `_`-prefixed files are meant to disappear. */
const ENTRY_RE = /\.mdx?$/;

/** Directories never worth walking in a content mount. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.immediately.run']);

/** Every entry path under `root`, absolute and sorted. Sibling directories are walked
 *  concurrently: the listing is on the path to first paint, and it reads no file bodies. */
export async function listCorpusFiles(root: string, fs: ScanFs, maxDepth = 12): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth) return;
    let items: Array<{ name: string; isDirectory(): boolean }>;
    try {
      items = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // an unreadable directory is not a corpus error — it contributes nothing
    }
    const dirs: string[] = [];
    for (const it of items) {
      if (it.isDirectory()) {
        if (!SKIP_DIRS.has(it.name)) dirs.push(`${dir}${it.name}/`);
      } else if (ENTRY_RE.test(it.name)) {
        out.push(`${dir}${it.name}`);
      }
    }
    await Promise.all(dirs.map((d) => walk(d, depth + 1)));
  };
  await walk(root.endsWith('/') ? root : `${root}/`, 0);
  return out.sort();
}

/** One entry's index row: its frontmatter, plus the additive headings index extension
 *  (GROVE_AGENT_SPEC §4). A dispatched row carries its entry's `headings: [{id, text,
 *  depth}]`, ids from the same mdx-plugins canon the render path emits (via the SDK's
 *  `collectHeadings` — one implementation, shared with the tool that reads the field). The
 *  author's own frontmatter `headings` key wins; a row with none of either simply lacks the
 *  field (readers degrade to body reads). */
function rowFor(raw: string): Frontmatter {
  const parsed = parseFrontmatter(raw);
  const row = parsed.data;
  const headings = collectHeadings(parsed.body);
  if (headings.length && !Object.prototype.hasOwnProperty.call(row, 'headings')) {
    return { ...row, headings } as Frontmatter & { headings?: unknown };
  }
  return row;
}

/** A file that is simply not there is a corpus property, not a failure. */
function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'ENOENT';
}

export type CorpusScanStatus = 'listing' | 'reading' | 'complete';

export interface CorpusScanSnapshot {
  status: CorpusScanStatus;
  /** Every listed entry, keyed by absolute path. A row is `{}` until its file is read, so
   *  existence and link resolution are right from the first render; whether a row has been
   *  READ is `isSettled`'s question, never the row's. */
  metadata: CorpusMetadata;
}

/** The part of a scan the wiki's entry gate needs. The fork packaging's index is complete
 *  at boot, so its stand-in answers "settled" for every key. */
export interface CorpusScanGate {
  /** True once `key` has been read, has failed to read, or the listing has finished
   *  without it. False while the listing is still running. */
  isSettled(key: string): boolean;
  /** Read these keys next, ahead of the rest of the corpus. */
  prioritize(keys: readonly string[]): void;
  /** Why a settled key's read failed, when the cause was anything but "not found". */
  readFailure(key: string): string | null;
}

export interface CorpusScan extends CorpusScanGate {
  /** The current published state. Stable identity between publishes. */
  snapshot(): CorpusScanSnapshot;
  subscribe(listener: () => void): () => void;
  /** Resolves when the scan completes or is disposed. */
  readonly done: Promise<void>;
  /** Stop reading, cancel the pending publish, drop every listener. */
  dispose(): void;
}

export interface CorpusScanOptions {
  concurrency?: number;
  flushMs?: number;
}

/**
 * Start building the frontmatter index for a corpus resident at `root`.
 *
 * The listing comes first and reads no file bodies; every listed path is then in the index
 * as an empty row, and the rows fill in as the files are read, a bounded pool at a time.
 * A key passed to `prioritize` jumps the queue, which is how an entry the reader is waiting
 * for is read before the rest of the corpus.
 *
 * Failure is per-file by design: a corpus is a foreign author's tree, and one malformed or
 * unreadable entry may not take the wiki down with it. An unreadable entry leaves the index
 * — the same state it would be in if the author had not written it — and counts as settled.
 */
export function createCorpusScan(root: string, fs: ScanFs, opts: CorpusScanOptions = {}): CorpusScan {
  const concurrency = Math.max(1, opts.concurrency ?? READ_CONCURRENCY);
  const flushMs = opts.flushMs ?? FLUSH_MS;
  const rows: CorpusMetadata = {};
  // A key is SETTLED only once its row is in a published snapshot — `isSettled` must never
  // run ahead of the metadata a render can see, or the entry gate would open on an empty
  // row that reads as `render` unset. `read` holds keys whose row is in `rows` but not yet
  // published.
  const settled = new Set<string>();
  const read = new Set<string>();
  // Reads that failed for a reason other than "no such file" — a dropped RPC, a rate
  // limit. The row is gone either way, but the entry gate must not treat a transient
  // failure of a file it needs as "this file has no frontmatter".
  const failures = new Map<string, string>();
  const wanted = new Set<string>();
  const listeners = new Set<() => void>();
  let listed: Set<string> | null = null;
  let queue: string[] = [];
  let status: CorpusScanStatus = 'listing';
  let snap: CorpusScanSnapshot = { status, metadata: {} };
  let active = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const publish = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (disposed) return;
    for (const key of read) settled.add(key);
    read.clear();
    snap = { status, metadata: { ...rows } };
    for (const listener of [...listeners]) listener();
  };
  const schedule = (): void => {
    if (timer === null && !disposed) timer = setTimeout(publish, flushMs);
  };
  const finish = (): void => {
    status = 'complete';
    publish();
    resolveDone();
  };

  const readOne = async (path: string): Promise<void> => {
    try {
      rows[path] = rowFor(await fs.readFile(path, 'utf8'));
    } catch (err) {
      delete rows[path];
      if (!isNotFound(err)) {
        const message = err instanceof Error ? err.message : String(err);
        failures.set(path, message);
        console.warn(`[grove] could not read ${path}: ${message}`);
      }
    }
  };
  const pump = (): void => {
    while (!disposed && active < concurrency && queue.length) {
      const path = queue.shift()!;
      active++;
      // `readOne` settles every failure itself, so this chain has no rejection to lose.
      void readOne(path).then(() => {
        active--;
        if (disposed) return;
        read.add(path);
        if (wanted.delete(path)) publish();
        else schedule();
        pump();
      });
    }
    if (!disposed && status === 'reading' && active === 0 && queue.length === 0) finish();
  };

  void listCorpusFiles(root, fs)
    .then((paths) => {
      if (disposed) return;
      listed = new Set(paths);
      for (const path of paths) rows[path] = {};
      const first = [...wanted].filter((k) => listed!.has(k));
      const firstSet = new Set(first);
      queue = [...first, ...paths.filter((p) => !firstSet.has(p))];
      status = 'reading';
      publish();
      pump();
    })
    .catch((err: unknown) => {
      // `listCorpusFiles` swallows per-directory failures, so this is a bug, not a corpus
      // property: say so, and settle as an empty corpus rather than "Opening…" forever.
      console.error('[grove] corpus listing failed', err);
      if (disposed) return;
      listed = new Set();
      finish();
    });

  return {
    snapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isSettled: (key) => settled.has(key) || (listed !== null && !listed.has(key)),
    readFailure: (key) => (settled.has(key) ? (failures.get(key) ?? null) : null),
    prioritize(keys) {
      const front: string[] = [];
      let readButUnpublished = false;
      for (const key of keys) {
        if (read.has(key)) readButUnpublished = true;
        if (settled.has(key) || read.has(key) || wanted.has(key)) continue;
        wanted.add(key);
        const at = queue.indexOf(key);
        if (at !== -1) {
          queue.splice(at, 1);
          front.push(key);
        }
      }
      queue.unshift(...front);
      // Wanted, and already read before anyone asked: publish now rather than at the timer.
      if (readButUnpublished) publish();
    },
    done,
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      queue = [];
      listeners.clear();
      resolveDone();
    },
  };
}

/** Build the whole index and resolve with it — for callers that want the finished map. */
export async function scanCorpus(root: string, fs: ScanFs): Promise<CorpusMetadata> {
  const scan = createCorpusScan(root, fs);
  await scan.done;
  return scan.snapshot().metadata;
}
