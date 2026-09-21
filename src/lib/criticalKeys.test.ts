// The files an entry needs read before it paints (MDX_FROM_MOUNT_SPEC D8). One input is
// this repo's own corpus, listed by the real `listCorpusFiles` over the real directory —
// so a layout that exists on disk is proven to be asked for, not assumed.
import { describe, it, expect } from 'vitest';
import { promises as nodeFs } from 'node:fs';
import { join } from 'node:path';
import { criticalKeys } from './criticalKeys';
import { listCorpusFiles, type ScanFs } from './corpusScan';
import { APP_CONTENT_ROOT } from './contentRoot';
import { folderIndexKey } from './directory';

const DISK_ROOT = join(process.cwd(), 'content') + '/';

/** The real corpus's listing, rebased to the fork's `/app/content/` keys, as an index of
 *  unread rows — exactly what the scan publishes when its listing finishes. */
async function listedIndex(): Promise<Record<string, Record<string, unknown>>> {
  const paths = await listCorpusFiles(DISK_ROOT, nodeFs as unknown as ScanFs);
  return Object.fromEntries(paths.map((p) => [APP_CONTENT_ROOT + p.slice(DISK_ROOT.length), {}]));
}

describe('criticalKeys', () => {
  it('over the real corpus: home, the entry, and every layout on its folder path that exists', async () => {
    const index = await listedIndex();
    const entry = Object.keys(index).find((k) => k.startsWith('/app/content/people/') && !k.endsWith('_layout.mdx'))!;
    expect(entry).toBeDefined();
    const keys = criticalKeys(entry, index);
    expect(keys).toEqual([
      '/app/content/home.mdx',
      entry,
      '/app/content/_layout.mdx',
      '/app/content/people/_layout.mdx',
    ]);
    // Every layout named is one the listing found — none is invented.
    for (const k of keys) expect(index).toHaveProperty([k]);
  });

  it('asks only for layouts that exist', () => {
    const index = { '/app/content/home.mdx': {}, '/app/content/a/b/x.mdx': {}, '/app/content/a/_layout.mdx': {} };
    expect(criticalKeys('/app/content/a/b/x.mdx', index)).toEqual([
      '/app/content/home.mdx',
      '/app/content/a/b/x.mdx',
      '/app/content/a/_layout.mdx',
    ]);
  });

  it('adds the `frame:` target once the entry row is read and names one that exists', () => {
    const index: Record<string, Record<string, unknown>> = {
      '/app/content/home.mdx': {},
      '/app/content/x.mdx': {},
      '/app/content/frames/wide.mdx': {},
    };
    expect(criticalKeys('/app/content/x.mdx', index)).not.toContain('/app/content/frames/wide.mdx');
    index['/app/content/x.mdx'] = { frame: 'frames/wide' };
    expect(criticalKeys('/app/content/x.mdx', index)).toContain('/app/content/frames/wide.mdx');
    index['/app/content/x.mdx'] = { frame: 'frames/absent' };
    expect(criticalKeys('/app/content/x.mdx', index)).toEqual(['/app/content/home.mdx', '/app/content/x.mdx']);
    index['/app/content/x.mdx'] = { frame: 'none' };
    expect(criticalKeys('/app/content/x.mdx', index)).toEqual(['/app/content/home.mdx', '/app/content/x.mdx']);
  });

  it('a folder route: the entry is the folder index the router resolves, wrapped by that folder\'s layout', () => {
    // GroveWiki hands `folderIndexKey(route, keys) ?? route` to criticalKeys; the real
    // resolver picks the entry here, so the case follows the router, not a guess at it.
    const index = {
      '/app/content/home.mdx': {},
      '/app/content/guides/index.mdx': {},
      '/app/content/guides/_layout.mdx': {},
      '/app/content/guides/first.mdx': {},
    };
    const entry = folderIndexKey('/app/content/guides', Object.keys(index));
    expect(entry).toBe('/app/content/guides/index.mdx');
    expect(criticalKeys(entry!, index)).toEqual([
      '/app/content/home.mdx',
      '/app/content/guides/index.mdx',
      '/app/content/guides/_layout.mdx',
    ]);
  });

  it('home is named once when it is the entry', () => {
    expect(criticalKeys('/app/content/home.mdx', { '/app/content/home.mdx': {} })).toEqual(['/app/content/home.mdx']);
  });
});
