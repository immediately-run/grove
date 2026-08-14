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

/** Entry files. `_layout.mdx` is INCLUDED deliberately: `layoutChainForKey` resolves the
 *  chain by looking for layout keys in this very map, so excluding structural files here
 *  would silently drop every layout under dispatch. Reader-facing enumerations filter with
 *  `isContentEntry`, which is where `_`-prefixed files are meant to disappear. */
const ENTRY_RE = /\.mdx?$/;

/** Directories never worth walking in a content mount. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.immediately.run']);

/** Every entry path under `root`, depth-first, absolute. */
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
    for (const d of dirs) await walk(d, depth + 1);
  };
  await walk(root.endsWith('/') ? root : `${root}/`, 0);
  return out.sort();
}

/** Read + parse a list of entries into the metadata map, bounded-concurrently. */
async function readAll(paths: string[], fs: ScanFs): Promise<CorpusMetadata> {
  const meta: CorpusMetadata = {};
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= paths.length) return;
      const path = paths[i];
      try {
        const raw = await fs.readFile(path, 'utf8');
        meta[path] = parseFrontmatter(raw).data;
      } catch {
        // One unreadable entry must not empty the whole corpus. It is simply absent from
        // the index — the same state it would be in if the author had not written it.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, paths.length) }, worker));
  return meta;
}

/**
 * Build the frontmatter index for a corpus resident at `root`.
 *
 * Failure is per-file by design: a corpus is a foreign author's tree, and one malformed or
 * unreadable entry may not take the wiki down with it.
 */
export async function scanCorpus(root: string, fs: ScanFs): Promise<CorpusMetadata> {
  const files = await listCorpusFiles(root, fs);
  return readAll(files, fs);
}
