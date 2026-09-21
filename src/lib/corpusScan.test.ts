import { describe, it, expect, vi } from 'vitest';
import { createCorpusScan, scanCorpus, listCorpusFiles, type ScanFs } from './corpusScan';
import { parseFrontmatter } from './frontmatter';

/** An in-memory tree, shaped like the fs slice the scan injects. */
function fakeFs(files: Record<string, string>, opts: { unreadable?: string[] } = {}): ScanFs {
  const unreadable = new Set(opts.unreadable ?? []);
  return {
    async readdir(dir) {
      if (unreadable.has(dir)) throw new Error('EACCES');
      const names = new Map<string, boolean>(); // name → isDirectory
      for (const path of Object.keys(files)) {
        if (!path.startsWith(dir)) continue;
        const rest = path.slice(dir.length);
        const slash = rest.indexOf('/');
        if (slash === -1) names.set(rest, false);
        else names.set(rest.slice(0, slash), true);
      }
      return [...names].map(([name, isDir]) => ({ name, isDirectory: () => isDir }));
    },
    async readFile(path) {
      if (unreadable.has(path)) throw new Error('EIO');
      const hit = files[path];
      if (hit === undefined) throw new Error('ENOENT');
      return hit;
    },
  };
}

const entry = (title: string, extra = '') => `---\ntitle: "${title}"\n${extra}---\n\nbody\n`;

describe('listCorpusFiles', () => {
  it('walks nested directories and returns absolute paths', async () => {
    const fs = fakeFs({
      '/mnt/c/home.mdx': entry('Home'),
      '/mnt/c/plot/the-rail.mdx': entry('The rail'),
      '/mnt/c/plot/deep/x.mdx': entry('Deep'),
      '/mnt/c/notes.txt': 'not an entry',
    });
    expect(await listCorpusFiles('/mnt/c', fs)).toEqual([
      '/mnt/c/home.mdx',
      '/mnt/c/plot/deep/x.mdx',
      '/mnt/c/plot/the-rail.mdx',
    ]);
  });

  it('includes _layout.mdx — the layout chain is resolved FROM this map', async () => {
    // Excluding structural files here would silently drop every layout under dispatch:
    // `layoutChainForKey` finds layouts by scanning these very keys.
    const fs = fakeFs({ '/mnt/c/_layout.mdx': entry('L'), '/mnt/c/home.mdx': entry('Home') });
    expect(await listCorpusFiles('/mnt/c', fs)).toContain('/mnt/c/_layout.mdx');
  });

  it('tolerates a missing trailing slash on the root', async () => {
    const fs = fakeFs({ '/mnt/c/home.mdx': entry('Home') });
    expect(await listCorpusFiles('/mnt/c/', fs)).toEqual(['/mnt/c/home.mdx']);
  });

  it('skips .git and node_modules rather than walking a whole checkout', async () => {
    const fs = fakeFs({
      '/mnt/c/home.mdx': entry('Home'),
      '/mnt/c/.git/config.mdx': entry('nope'),
      '/mnt/c/node_modules/pkg/readme.md': entry('nope'),
    });
    expect(await listCorpusFiles('/mnt/c', fs)).toEqual(['/mnt/c/home.mdx']);
  });

  it('does not fail the whole scan on an unreadable directory', async () => {
    const fs = fakeFs(
      { '/mnt/c/home.mdx': entry('Home'), '/mnt/c/private/x.mdx': entry('X') },
      { unreadable: ['/mnt/c/private/'] },
    );
    expect(await listCorpusFiles('/mnt/c', fs)).toEqual(['/mnt/c/home.mdx']);
  });
});

describe('scanCorpus — the index a dispatched viewer reads', () => {
  it('keys metadata by ABSOLUTE path, the same shape the bundler feeds', async () => {
    // The whole design is "swap the source of the map, not the map": every consumer
    // (`useFileMetadata`, `useMetadataQuery`, `layoutChainForKey`) is keyed this way.
    const fs = fakeFs({
      '/mnt/c/home.mdx': entry('Home', 'site: "Writers\' room"\ntags: [ui/nav]\n'),
      '/mnt/c/themes.mdx': entry('Themes', 'topics: [themes, bans]\nowns:\n  concepts: [the-frame]\n'),
    });
    const meta = await scanCorpus('/mnt/c', fs);
    expect(Object.keys(meta).sort()).toEqual(['/mnt/c/home.mdx', '/mnt/c/themes.mdx']);
    expect(meta['/mnt/c/home.mdx'].title).toBe('Home');
    expect(meta['/mnt/c/home.mdx'].site).toBe("Writers' room");
    expect(meta['/mnt/c/themes.mdx'].topics).toEqual(['themes', 'bans']);
    expect(meta['/mnt/c/themes.mdx'].owns).toEqual({ concepts: ['the-frame'] });
  });

  it('keeps an entry with NO frontmatter, with empty metadata (plus the additive headings field)', async () => {
    // A draft or a bare `_layout.mdx` is still part of the corpus; dropping it would make
    // the file unroutable rather than merely unlabelled. Since the headings index
    // extension (GROVE_AGENT_SPEC §4) the row carries its heading list too.
    const fs = fakeFs({ '/mnt/c/raw.mdx': '# just a heading\n' });
    expect(await scanCorpus('/mnt/c', fs)).toEqual({
      '/mnt/c/raw.mdx': { headings: [{ id: 'just-a-heading', text: 'just a heading', depth: 1 }] },
    });
  });

  it('loses only the unreadable entry, never the corpus', async () => {
    const fs = fakeFs(
      { '/mnt/c/a.mdx': entry('A'), '/mnt/c/b.mdx': entry('B'), '/mnt/c/c.mdx': entry('C') },
      { unreadable: ['/mnt/c/b.mdx'] },
    );
    const meta = await scanCorpus('/mnt/c', fs);
    expect(Object.keys(meta).sort()).toEqual(['/mnt/c/a.mdx', '/mnt/c/c.mdx']);
  });

  it('reads a corpus larger than the concurrency pool', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 40; i++) files[`/mnt/c/e${i}.mdx`] = entry(`E${i}`);
    const meta = await scanCorpus('/mnt/c', fakeFs(files));
    expect(Object.keys(meta)).toHaveLength(40);
    expect(meta['/mnt/c/e39.mdx'].title).toBe('E39');
  });
});

describe('parseFrontmatter — the grammar the authoring contract documents', () => {
  it('reads scalars, inline lists, block lists and one level of nesting', () => {
    const { data, body } = parseFrontmatter(
      [
        '---',
        'title: "GLORIA REEVES — Denise\'s mother"',
        'status: draft',
        'topics: [characters, denise]',
        'reads-first:',
        '  - themes.mdx',
        '  - world.mdx',
        'owns:',
        '  concepts: [gloria-reeves]',
        'prs: []',
        '---',
        '',
        '# Heading',
      ].join('\n'),
    );
    expect(data.title).toBe("GLORIA REEVES — Denise's mother");
    expect(data.status).toBe('draft');
    expect(data.topics).toEqual(['characters', 'denise']);
    expect(data['reads-first']).toEqual(['themes.mdx', 'world.mdx']);
    expect(data.owns).toEqual({ concepts: ['gloria-reeves'] });
    expect(data.prs).toEqual([]);
    expect(body).toBe('# Heading');
  });

  it('treats an unterminated block as no frontmatter, keeping the body whole', () => {
    const src = '---\ntitle: X\n\n# body';
    // `hadFrontmatter` distinguishes this from `---\n---` (a block WITH no keys) —
    // carried by the shared parser since R3-277a, where Grove's port had dropped it.
    expect(parseFrontmatter(src)).toEqual({ data: {}, body: src, hadFrontmatter: false });
  });

  it('does not mistake a horizontal rule mid-document for frontmatter', () => {
    const src = '# Title\n\n---\n\nmore';
    expect(parseFrontmatter(src).data).toEqual({});
  });
});

describe('scanCorpus — the additive headings index (GROVE_AGENT_SPEC §4)', () => {
  it('G-GA-7 — a scan emits headings whose ids match the rendered anchors (the mdx-plugins canon)', async () => {
    const fs = fakeFs({
      '/mnt/c/a.mdx': '---\ntitle: A\n---\n\n## 8. Capability model\n\n## Getting started\n\n## Getting started\n',
    });
    const meta = await scanCorpus('/mnt/c', fs);
    expect(meta['/mnt/c/a.mdx']).toMatchObject({
      title: 'A',
      headings: [
        { id: 'sec-8', text: '8. Capability model', depth: 2 },
        { id: 'getting-started', text: 'Getting started', depth: 2 },
        { id: 'getting-started-1', text: 'Getting started', depth: 2 },
      ],
    });
  });

  it('the author own `headings` frontmatter key wins over the computed field', async () => {
    const fs = fakeFs({
      '/mnt/c/a.mdx': '---\ntitle: A\nheadings: authored\n---\n\n## One\n',
    });
    const meta = await scanCorpus('/mnt/c', fs);
    expect(meta['/mnt/c/a.mdx']).toEqual({ title: 'A', headings: 'authored' });
  });

  it('a heading-less entry simply lacks the field (the old-index degrade)', async () => {
    const fs = fakeFs({ '/mnt/c/a.mdx': '---\ntitle: A\n---\n\nprose only\n' });
    const meta = await scanCorpus('/mnt/c', fs);
    expect(meta['/mnt/c/a.mdx']).toEqual({ title: 'A' });
  });
});

const tick = () => new Promise((r) => setTimeout(r, 0));

/** The same tree as `fakeFs`, but every `readFile` waits until the test releases it — so
 *  a test can observe the scan between the listing and the reads, and see read order. */
function heldFs(files: Record<string, string>, opts: { unreadable?: string[] } = {}) {
  const base = fakeFs(files, opts);
  const calls: string[] = [];
  const held = new Map<string, () => void>();
  const fs: ScanFs = {
    readdir: base.readdir,
    readFile(path, enc) {
      calls.push(path);
      return new Promise<void>((resolve) => held.set(path, resolve)).then(() => base.readFile(path, enc));
    },
  };
  const release = async (path: string) => {
    held.get(path)!();
    held.delete(path);
    await tick(); // let the settle + pump run
  };
  return { fs, calls, held, release };
}


describe('createCorpusScan — the progressive index (MDX_FROM_MOUNT_SPEC D8)', () => {
  const tree = {
    '/mnt/c/home.mdx': entry('Home'),
    '/mnt/c/a.mdx': entry('A'),
    '/mnt/c/z.mdx': entry('Z'),
  };

  it('seeds EVERY listed key with an empty row before any file is read', async () => {
    const h = heldFs(tree);
    const scan = createCorpusScan('/mnt/c', h.fs, { flushMs: 60_000 });
    expect(scan.snapshot().status).toBe('listing');
    await vi.waitFor(() => expect(scan.snapshot().status).toBe('reading'));
    expect(scan.snapshot().metadata).toEqual({ '/mnt/c/a.mdx': {}, '/mnt/c/home.mdx': {}, '/mnt/c/z.mdx': {} });
    expect(h.held.size).toBeGreaterThan(0); // reads started, none resolved
    scan.dispose();
  });

  it('isSettled: false while listing and for a listed-unread key; true once read, once failed, or never listed', async () => {
    const h = heldFs(tree, { unreadable: ['/mnt/c/z.mdx'] });
    const scan = createCorpusScan('/mnt/c', h.fs, { flushMs: 0 }); // settled = read AND published
    expect(scan.isSettled('/mnt/c/a.mdx')).toBe(false);
    expect(scan.isSettled('/mnt/c/missing.mdx')).toBe(false); // the listing has not answered yet
    await vi.waitFor(() => expect(scan.snapshot().status).toBe('reading'));
    expect(scan.isSettled('/mnt/c/a.mdx')).toBe(false);
    expect(scan.isSettled('/mnt/c/missing.mdx')).toBe(true);
    await h.release('/mnt/c/a.mdx');
    await vi.waitFor(() => expect(scan.isSettled('/mnt/c/a.mdx')).toBe(true));
    await h.release('/mnt/c/z.mdx');
    await vi.waitFor(() => expect(scan.isSettled('/mnt/c/z.mdx')).toBe(true));
    await h.release('/mnt/c/home.mdx');
    await scan.done;
    // The unreadable entry leaves the index, exactly as the whole-corpus scan always did.
    expect(Object.keys(scan.snapshot().metadata).sort()).toEqual(['/mnt/c/a.mdx', '/mnt/c/home.mdx']);
    expect(scan.snapshot().status).toBe('complete');
  });

  it('prioritize: a key asked for is the NEXT read, ahead of the rest of the corpus', async () => {
    const h = heldFs(tree);
    const scan = createCorpusScan('/mnt/c', h.fs, { concurrency: 1, flushMs: 60_000 });
    await vi.waitFor(() => expect(h.calls).toEqual(['/mnt/c/a.mdx'])); // sorted order, one at a time
    scan.prioritize(['/mnt/c/z.mdx']);
    await h.release('/mnt/c/a.mdx');
    await vi.waitFor(() => expect(h.calls).toEqual(['/mnt/c/a.mdx', '/mnt/c/z.mdx']));
    scan.dispose();
  });

  it('prioritize before the listing finishes: the wanted key is read first', async () => {
    const h = heldFs(tree);
    const scan = createCorpusScan('/mnt/c', h.fs, { concurrency: 1, flushMs: 60_000 });
    scan.prioritize(['/mnt/c/z.mdx']);
    await vi.waitFor(() => expect(h.calls).toEqual(['/mnt/c/z.mdx']));
    scan.dispose();
  });

  it('a prioritized key publishes as soon as it settles, without waiting for the flush timer', async () => {
    const h = heldFs(tree);
    const scan = createCorpusScan('/mnt/c', h.fs, { concurrency: 1, flushMs: 60_000 });
    await vi.waitFor(() => expect(scan.snapshot().status).toBe('reading'));
    const before = scan.snapshot();
    const seen = vi.fn();
    scan.subscribe(seen);
    scan.prioritize(['/mnt/c/a.mdx']); // already in flight — still wanted
    await h.release('/mnt/c/a.mdx');
    await vi.waitFor(() => expect(seen).toHaveBeenCalledTimes(1));
    expect(scan.snapshot()).not.toBe(before);
    expect(scan.snapshot().metadata['/mnt/c/a.mdx'].title).toBe('A');
    scan.dispose();
  });

  it('a read key is not settled until its row is published — the gate never runs ahead of the index', async () => {
    const h = heldFs(tree);
    const scan = createCorpusScan('/mnt/c', h.fs, { concurrency: 1, flushMs: 60_000 });
    await vi.waitFor(() => expect(scan.snapshot().status).toBe('reading'));
    await h.release('/mnt/c/a.mdx'); // read, nobody asked for it: waits for the flush
    expect(scan.snapshot().metadata['/mnt/c/a.mdx']).toEqual({});
    expect(scan.isSettled('/mnt/c/a.mdx')).toBe(false);
    scan.prioritize(['/mnt/c/a.mdx']); // now it is wanted: published at once
    expect(scan.isSettled('/mnt/c/a.mdx')).toBe(true);
    expect(scan.snapshot().metadata['/mnt/c/a.mdx'].title).toBe('A');
    scan.dispose();
  });

  it('an unprioritized read is batched into the next flush', async () => {
    const h = heldFs(tree);
    const scan = createCorpusScan('/mnt/c', h.fs, { concurrency: 1, flushMs: 20 });
    await vi.waitFor(() => expect(scan.snapshot().status).toBe('reading'));
    const seen = vi.fn();
    scan.subscribe(seen);
    await h.release('/mnt/c/a.mdx');
    await tick();
    expect(seen).not.toHaveBeenCalled(); // not per file
    await vi.waitFor(() => expect(seen).toHaveBeenCalledTimes(1)); // the timer's flush
    scan.dispose();
  });

  it('dispose stops handing out reads and cancels the pending publish', async () => {
    const h = heldFs(tree);
    const scan = createCorpusScan('/mnt/c', h.fs, { concurrency: 1, flushMs: 5 });
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    const seen = vi.fn();
    scan.subscribe(seen);
    scan.dispose();
    await h.release(h.calls[0]!);
    await new Promise((r) => setTimeout(r, 20));
    expect(h.calls).toHaveLength(1);
    expect(seen).not.toHaveBeenCalled();
    await scan.done; // resolves on dispose rather than hanging
  });

  it('unsubscribe removes exactly that listener', async () => {
    const h = heldFs(tree);
    const scan = createCorpusScan('/mnt/c', h.fs, { flushMs: 60_000 });
    const kept = vi.fn();
    const dropped = vi.fn();
    scan.subscribe(kept);
    const off = scan.subscribe(dropped);
    off();
    await vi.waitFor(() => expect(scan.snapshot().status).toBe('reading'));
    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();
    scan.dispose();
  });

  it('an empty bundle completes straight from the listing', async () => {
    const scan = createCorpusScan('/mnt/c', fakeFs({ '/mnt/c/notes.txt': 'x' }));
    await scan.done;
    expect(scan.snapshot()).toEqual({ status: 'complete', metadata: {} });
  });
});
