// The body gate (MDX_FROM_MOUNT_SPEC D8), driven by a REAL scan rather than a stubbed
// `isSettled`, so "pending" means what the scan means by it.
import { describe, it, expect, vi } from 'vitest';
import { criticalFailure, entryPending } from './entryGate';
import { createCorpusScan, type ScanFs } from './corpusScan';
import { criticalKeys } from './criticalKeys';

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

describe('criticalFailure', () => {
  it('names the first critical key whose read failed, and nothing when none did', () => {
    const failed: Record<string, string> = { '/c/x.mdx': 'EIO' };
    expect(criticalFailure(['/c/home.mdx', '/c/x.mdx'], (k) => failed[k] ?? null)).toBe(
      'Could not read /c/x.mdx (EIO). Reload to try again.',
    );
    expect(criticalFailure(['/c/home.mdx'], (k) => failed[k] ?? null)).toBeNull();
  });
});

/** A listing-shaped fs over `files`; a read of any path in `failing` throws EIO. */
function failingFs(files: Record<string, string>, failing: (path: string) => boolean): ScanFs {
  return {
    async readdir(dir) {
      const names = new Map<string, boolean>();
      for (const p of Object.keys(files)) {
        if (!p.startsWith(dir)) continue;
        const rest = p.slice(dir.length);
        const slash = rest.indexOf('/');
        names.set(slash === -1 ? rest : rest.slice(0, slash), slash !== -1);
      }
      return [...names].map(([name, isDir]) => ({ name, isDirectory: () => isDir }));
    },
    async readFile(path) {
      if (failing(path)) throw new Error('EIO dropped');
      return files[path]!;
    },
  };
}

describe('fail closed on a failed FRAME read, end to end with a real scan', () => {
  it('a frame: target whose read failed stays critical and fails the gate', async () => {
    const files: Record<string, string> = {
      '/app/content/home.mdx': '---\ntitle: H\n---\n',
      '/app/content/frames/wide.mdx': '---\n---\n',
      '/app/content/a.mdx': '---\ntitle: A\nframe: frames/wide\n---\n',
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const scan = createCorpusScan('/app/content/', failingFs(files, (p) => p.endsWith('wide.mdx')), { flushMs: 0 });
    await scan.done;
    const critical = criticalKeys('/app/content/a.mdx', scan.snapshot().metadata, scan.readFailure);
    expect(critical).toContain('/app/content/frames/wide.mdx');
    expect(criticalFailure(critical, scan.readFailure)).toBe(
      'Could not read /app/content/frames/wide.mdx (EIO dropped). Reload to try again.',
    );
    warn.mockRestore();
  });
});

describe('fail closed on a failed LAYOUT read, end to end with a real scan', () => {
  it('a layout whose read failed stays critical and fails the gate, instead of painting without it', async () => {
    const files: Record<string, string> = {
      '/app/content/home.mdx': '---\ntitle: H\n---\n',
      '/app/content/guides/_layout.mdx': '---\n---\n',
      '/app/content/guides/a.mdx': '---\ntitle: A\n---\n',
    };
    const fs: ScanFs = {
      async readdir(dir) {
        const names = new Map<string, boolean>();
        for (const p of Object.keys(files)) {
          if (!p.startsWith(dir)) continue;
          const rest = p.slice(dir.length);
          const slash = rest.indexOf('/');
          names.set(slash === -1 ? rest : rest.slice(0, slash), slash !== -1);
        }
        return [...names].map(([name, isDir]) => ({ name, isDirectory: () => isDir }));
      },
      async readFile(path) {
        if (path.endsWith('_layout.mdx')) throw new Error('EIO dropped');
        return files[path]!;
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const scan = createCorpusScan('/app/content/', fs, { flushMs: 0 });
    await scan.done;
    const entry = '/app/content/guides/a.mdx';
    const critical = criticalKeys(entry, scan.snapshot().metadata, scan.readFailure);
    expect(critical).toContain('/app/content/guides/_layout.mdx');
    expect(criticalFailure(critical, scan.readFailure)).toBe(
      'Could not read /app/content/guides/_layout.mdx (EIO dropped). Reload to try again.',
    );
    warn.mockRestore();
  });
});
