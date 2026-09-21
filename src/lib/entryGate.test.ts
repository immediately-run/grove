// The body gate (MDX_FROM_MOUNT_SPEC D8), driven by a REAL scan rather than a stubbed
// `isSettled`, so "pending" means what the scan means by it.
import { describe, it, expect } from 'vitest';
import { entryPending } from './entryGate';
import { createCorpusScan, type ScanFs } from './corpusScan';

/** A two-file corpus whose reads wait for `release()`. */
function corpus(files: Record<string, string>) {
  const held: Array<() => void> = [];
  const fs: ScanFs = {
    async readdir() {
      return Object.keys(files).map((p) => ({ name: p.slice('/c/'.length), isDirectory: () => false }));
    },
    readFile(path) {
      return new Promise<string>((resolve) => held.push(() => resolve(files[path]!)));
    },
  };
  const release = () => held.splice(0).forEach((r) => r());
  return { fs, release };
}

const FILES = { '/c/home.mdx': '---\ntitle: H\n---\n', '/c/x.mdx': '---\ntitle: X\n---\n' };

describe('entryPending', () => {
  it('pending while a critical key is unread; clear once the scan has read it', async () => {
    const c = corpus(FILES);
    const scan = createCorpusScan('/c/', c.fs, { flushMs: 0 });
    const critical = ['/c/home.mdx', '/c/x.mdx'];
    expect(entryPending(critical, scan.isSettled, 'ready')).toBe(true); // still listing
    await new Promise((r) => setTimeout(r, 0));
    expect(entryPending(critical, scan.isSettled, 'ready')).toBe(true); // listed, unread
    c.release();
    await scan.done;
    expect(entryPending(critical, scan.isSettled, 'ready')).toBe(false);
  });

  it('a critical key the listing did not find (no home.mdx) does not hold the entry', async () => {
    const c = corpus({ '/c/x.mdx': FILES['/c/x.mdx'] });
    const scan = createCorpusScan('/c/', c.fs, { flushMs: 0 });
    await new Promise((r) => setTimeout(r, 0));
    c.release();
    await scan.done;
    expect(entryPending(['/c/home.mdx', '/c/x.mdx'], scan.isSettled, 'ready')).toBe(false);
  });

  it('pending while declared stylesheets load, even with every key read', () => {
    expect(entryPending(['/c/x.mdx'], () => true, 'loading')).toBe(true);
    expect(entryPending(['/c/x.mdx'], () => true, 'ready')).toBe(false);
  });
});
