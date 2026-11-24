import { describe, it, expect, vi, onTestFinished } from 'vitest';
import { createCorpusScan, scanCorpus, listCorpusFiles, type ScanFs } from './corpusScan';
import { parseFrontmatter } from './frontmatter';
import { FRONTMATTER_REJECTED, resolveSafeRender } from './renderMode';
import { countTags } from './tagCloud';
import { rowLabel } from './directory';
import { navQuery, plainLabel, searchQuery, sidebarQuery, toSearchEntries } from './queries';
import { resetContentRoot, setContentRoot } from './contentRoot';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

describe('scanCorpus — typed and rejected frontmatter (R3-1350)', () => {
  it('a rejected block marks its row, and the render-mode decision fails closed', async () => {
    const fs = fakeFs({
      '/mnt/c/home.mdx': '---\nrender: safe\ndescription: x (nav: top)\n---\n\nBody.\n',
      '/mnt/c/page.mdx': '---\ntitle: Fine\n---\n\nBody.\n',
    });
    const meta = await scanCorpus('/mnt/c', fs);
    const home = meta['/mnt/c/home.mdx'] as Record<string, unknown>;
    expect(home[FRONTMATTER_REJECTED]).toMatchObject({ kind: 'yaml', line: 3 });
    expect(home.render).toBeUndefined();
    // Home rejected → every entry renders safely; a clean home + a rejected entry → that entry.
    expect(resolveSafeRender(home, meta['/mnt/c/page.mdx'] as Record<string, unknown>)).toBe(true);
    expect(resolveSafeRender({ title: 'Home' }, home)).toBe(true);
    expect(resolveSafeRender({ title: 'Home' }, { title: 'Fine' })).toBe(false);
  });

  it('typed titles and tags reach the readers as text, through the real scan', async () => {
    // YAML 1.2: `title: 1984` is a number and `tags: [2026, notes, true]` holds a number and a
    // boolean. The readers used to call string methods on them (and throw) or drop them.
    const fs = fakeFs({ '/mnt/c/year.mdx': '---\ntitle: 1984\ntags: [2026, notes, true, ui/nav]\n---\n\nBody.\n' });
    const meta = await scanCorpus('/mnt/c', fs);
    expect(countTags(meta as never, '/mnt/c/')).toEqual(
      expect.arrayContaining([expect.objectContaining({ tag: '2026' }), expect.objectContaining({ tag: 'true' })]),
    );
    expect(rowLabel({ kind: 'entry', name: 'year.mdx', meta: meta['/mnt/c/year.mdx'] } as never)).toBe('1984');
  });
});

describe('typed values through every query the shell builds (R3-1350 review 2-r2)', () => {
  it('search, sidebar, nav and the agent title take a numeric title and tags without throwing', async () => {
    const fs = fakeFs({
      '/mnt/c/year.mdx': '---\ntitle: 1984\ndescription: 42\nnav: 7\ntags: [2026, notes, ui/nav, ui/sidebar, true]\n---\n\nBody.\n',
    });
    const meta = (await scanCorpus('/mnt/c', fs)) as Parameters<typeof searchQuery>[0];
    // The queries keep entries under the mounted corpus root, as a dispatched viewer sets it.
    setContentRoot('/mnt/c/');
    onTestFinished(() => resetContentRoot());
    const rows = searchQuery(meta).filter((r) => r.path === '/mnt/c/year.mdx');
    expect(rows).toEqual([{ path: '/mnt/c/year.mdx', title: '1984', desc: '42', tags: ['2026', 'notes', 'true'] }]);
    expect(toSearchEntries(rows)[0]).toMatchObject({ title: '1984', plain: '1984', desc: '42' });
    expect(sidebarQuery(meta).find((r) => r.path === '/mnt/c/year.mdx')).toMatchObject({ title: '1984', nav: '7' });
    expect(plainLabel(meta['/mnt/c/year.mdx'].title)).toBe('1984');
    expect(plainLabel(undefined)).toBe('');
    // navQuery reads the ui/nav tag out of a mixed, typed list.
    expect(navQuery(meta).map((n) => n.label)).toContain('7');
  });

  it('no source file outside displayText.ts calls startsWith with a ui/ literal (source guard)', () => {
    // Review 2-r2-1: round one routed SOME tag readers through the helper and left others
    // calling t.startsWith('ui/') on a value that may be a number. What this checks, and
    // all it checks (review 3-r3-1): no non-test .ts/.tsx under src/ other than
    // displayText.ts contains `startsWith(` followed by a quoted `ui/`. A reader that
    // filters ui/ tags any other way (a regex, `slice`, a constant prefix) passes it; the
    // typed-values tests here and in components/typedFrontmatter.render.test.tsx are what
    // cover those readers' behaviour.
    const src = fileURLToPath(new URL('../', import.meta.url));
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const f = join(d, n);
        return statSync(f).isDirectory() ? walk(f) : /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [f] : [];
      });
    const offenders = walk(src).filter((f) => !f.endsWith('displayText.ts') && /startsWith\(\s*['"]ui\//.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
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
    // 0.8.0 (R3-1347) adds `content` (the untrimmed remainder; here the whole input) and,
    // only for a present-but-rejected block, `error` — so an unterminated one has none.
    expect(parseFrontmatter(src)).toEqual({ data: {}, body: src, content: src, hadFrontmatter: false });
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

  // R3-1090 — the cold-load defect: on a 1,600-file corpus the LISTING ran ~13 s and
  // the reader's entry painted only after it (title at 27.2 s, tree at 25.5 s), because
  // a prioritized key could not be read until the walk completed. The wanted key's read
  // now starts at prioritize() time, listing or no listing. The fixture holds the
  // listing OPEN (a readdir that answers when told), so pre-fix code — which could only
  // collect the wanted key — fails this case by never settling it.
  it('a key prioritized DURING the listing is read at once, and its row survives the listing', async () => {
    const files: Record<string, string> = { '/mnt/c/entry.mdx': entry('The entry') };
    for (let i = 0; i < 1600; i++) files[`/mnt/c/e${String(i).padStart(4, '0')}.mdx`] = entry(`E${i}`);
    const base = fakeFs(files);
    let openListing: () => void = () => {};
    const listingHeld = new Promise<void>((res) => {
      openListing = res;
    });
    const fs: ScanFs = {
      readdir: async (dir, opts) => {
        await listingHeld;
        return base.readdir(dir, opts);
      },
      readFile: (p, e) => base.readFile(p, e),
    };
    const scan = createCorpusScan('/mnt/c', fs, { flushMs: 0 });
    scan.prioritize(['/mnt/c/entry.mdx']);
    // Settles while the listing is still open — pre-fix, this waitFor times out.
    await vi.waitFor(() => expect(scan.isSettled('/mnt/c/entry.mdx')).toBe(true));
    expect(scan.snapshot().status).toBe('listing');
    // And the row is not clobbered to {} when the listing lands (review round 1).
    openListing();
    await vi.waitFor(() => expect(scan.snapshot().status).not.toBe('listing'));
    expect(scan.snapshot().metadata['/mnt/c/entry.mdx'].title).toBe('The entry');
    expect(scan.isSettled('/mnt/c/entry.mdx')).toBe(true);
    scan.dispose();
  });

  it('prioritize never reads a key that cannot be an entry (a folder routeKey)', async () => {
    // R3-1090 round 3: a folder URL's routeKey has no .mdx; reading it rejects EISDIR,
    // which is not ENOENT — unguarded, it would be recorded as a read FAILURE and the
    // entry gate would show "Could not read … Reload to try again" for the whole
    // listing window.
    const h = heldFs({ '/mnt/c/home.mdx': entry('Home') });
    const scan = createCorpusScan('/mnt/c', h.fs, { flushMs: 0 });
    scan.prioritize(['/mnt/c/guides']);
    await new Promise((r) => setTimeout(r, 20));
    expect(h.calls).not.toContain('/mnt/c/guides');
    expect(scan.readFailure('/mnt/c/guides')).toBeNull();
    scan.dispose();
  });

  it('fault injection: without the priority read the entry waits for the walk (the pre-fix shape)', async () => {
    // The same corpus, NO prioritize: the entry (e0000-adjacent by sort would cheat —
    // pick the last-sorted key) settles only when the pool reaches it, long after the
    // listing. This is the behavior the fix removes; if prioritize ever stops starting
    // reads early, the case above fails and this one keeps passing.
    const files: Record<string, string> = {};
    for (let i = 0; i < 100; i++) files[`/mnt/c/e${String(i).padStart(4, '0')}.mdx`] = entry(`E${i}`);
    files['/mnt/c/zz-entry.mdx'] = entry('Last');
    const base = fakeFs(files);
    // One read per tick, so the pool cannot drain the corpus before the
    // 'reading' observation (an instant fs completes 100 files inside the wait).
    const fs: ScanFs = {
      readdir: base.readdir,
      readFile: (p, e) => new Promise((res) => setTimeout(() => res(base.readFile(p, e)), 0)),
    };
    const scan = createCorpusScan('/mnt/c', fs, { concurrency: 1, flushMs: 0 });
    // Not prioritized: the key is NOT settled right after the listing publishes.
    await vi.waitFor(() => expect(scan.snapshot().status).toBe('reading'));
    expect(scan.isSettled('/mnt/c/zz-entry.mdx')).toBe(false);
    await scan.done;
    expect(scan.isSettled('/mnt/c/zz-entry.mdx')).toBe(true);
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

describe('createCorpusScan — read failures', () => {
  const notFound = () => Object.assign(new Error('no such file'), { code: 'ENOENT' });

  it('a transient failure is reported for the key once settled; a missing file is not a failure', async () => {
    const files = { '/mnt/c/a.mdx': entry('A'), '/mnt/c/b.mdx': entry('B') };
    const base = fakeFs(files);
    const fs: ScanFs = {
      readdir: base.readdir,
      async readFile(path) {
        if (path === '/mnt/c/a.mdx') throw new Error('EIO: the channel dropped the request');
        if (path === '/mnt/c/b.mdx') throw notFound();
        return base.readFile(path, 'utf8');
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const scan = createCorpusScan('/mnt/c', fs, { flushMs: 0 });
    expect(scan.readFailure('/mnt/c/a.mdx')).toBeNull(); // nothing is known yet
    await scan.done;
    expect(scan.readFailure('/mnt/c/a.mdx')).toBe('EIO: the channel dropped the request');
    expect(scan.readFailure('/mnt/c/b.mdx')).toBeNull();
    expect(scan.snapshot().metadata).toEqual({}); // both rows leave the index either way
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

// R3-1373 — a live edit re-reads the changed key into the index.
describe('createCorpusScan refresh (R3-1373)', () => {
  /** A mutable tree whose absent paths reject the way the sandbox does (code ENOENT). */
  function liveFs(files: Record<string, string>) {
    const base = fakeFs(files);
    const reads: string[] = [];
    const fs: ScanFs = {
      readdir: base.readdir,
      async readFile(path) {
        reads.push(path);
        if (files[path] === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return files[path];
      },
    };
    return { fs, reads };
  }
  const flushed = { flushMs: 0 };
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it('re-reads a changed entry; every other row keeps its identity', async () => {
    const files = { '/mnt/c/DIB-26.md': entry('Accept random ids'), '/mnt/c/DIB-27.md': entry('Other') };
    const { fs } = liveFs(files);
    const scan = createCorpusScan('/mnt/c', fs, flushed);
    await scan.done;
    const before = scan.snapshot().metadata;
    files['/mnt/c/DIB-26.md'] = entry('Accept random ids XYZZY');
    scan.refresh(['/mnt/c/DIB-26.md']);
    await tick();
    const after = scan.snapshot().metadata;
    expect(after['/mnt/c/DIB-26.md']).toMatchObject({ title: 'Accept random ids XYZZY' });
    expect(after['/mnt/c/DIB-27.md']).toBe(before['/mnt/c/DIB-27.md']);
    expect(scan.snapshot().status).toBe('complete');
  });

  it('a new entry joins the index, and a removed one leaves it', async () => {
    const files: Record<string, string> = { '/mnt/c/home.mdx': entry('Home'), '/mnt/c/gone.md': entry('Gone') };
    const { fs } = liveFs(files);
    const scan = createCorpusScan('/mnt/c', fs, flushed);
    await scan.done;
    files['/mnt/c/new/fresh.md'] = entry('Fresh');
    delete files['/mnt/c/gone.md'];
    scan.refresh(['/mnt/c/new/fresh.md', '/mnt/c/gone.md']);
    await tick();
    const meta = scan.snapshot().metadata;
    expect(meta['/mnt/c/new/fresh.md']).toMatchObject({ title: 'Fresh' });
    expect('/mnt/c/gone.md' in meta).toBe(false);
    expect(scan.isSettled('/mnt/c/new/fresh.md')).toBe(true);
    expect(scan.readFailure('/mnt/c/gone.md')).toBeNull();
  });

  it('reads nothing for a non-entry, a skipped directory, or a path outside the root', async () => {
    const { fs, reads } = liveFs({ '/mnt/c/home.mdx': entry('Home') });
    const scan = createCorpusScan('/mnt/c', fs, flushed);
    await scan.done;
    reads.length = 0;
    scan.refresh(['/mnt/c/logo.png', '/mnt/c/node_modules/x/readme.md', '/mnt/other/x.md', '/mnt/c/../c/x.md']);
    await tick();
    expect(reads).toEqual([]);
  });

  it('a refresh during the listing waits for it and reads the path once', async () => {
    const files = { '/mnt/c/home.mdx': entry('Home'), '/mnt/c/a.md': entry('A') };
    const { fs, reads } = liveFs(files);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: ScanFs = { ...fs, readdir: async (d, o) => (await gate, fs.readdir(d, o)) };
    const scan = createCorpusScan('/mnt/c', slow, flushed);
    scan.refresh(['/mnt/c/a.md']);
    expect(reads).toEqual([]);
    release();
    await scan.done;
    await tick();
    expect(reads.filter((p) => p === '/mnt/c/a.md')).toHaveLength(1);
  });

  it('a refresh while that key is being read re-reads it, so the newest bytes win', async () => {
    const files = { '/mnt/c/a.md': entry('v1') };
    const { fs } = liveFs(files);
    const scan = createCorpusScan('/mnt/c', fs, flushed);
    await scan.done;
    files['/mnt/c/a.md'] = entry('v2');
    scan.refresh(['/mnt/c/a.md']);
    files['/mnt/c/a.md'] = entry('v3');
    scan.refresh(['/mnt/c/a.md']); // lands while the v2 read is in flight
    await tick();
    expect(scan.snapshot().metadata['/mnt/c/a.md']).toMatchObject({ title: 'v3' });
  });

  it('a key whose read failed, then was deleted, reports no failure after a refresh (1-A-1)', async () => {
    const files: Record<string, string> = { '/mnt/c/a.md': entry('A') };
    let flaky = true;
    const fs: ScanFs = {
      readdir: fakeFs(files).readdir,
      async readFile(path) {
        if (flaky) {
          flaky = false;
          throw new Error('Invalid RPC id');
        }
        if (files[path] === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        return files[path];
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scan = createCorpusScan('/mnt/c', fs, flushed);
    await scan.done;
    await tick();
    expect(scan.readFailure('/mnt/c/a.md')).toBe('Invalid RPC id');
    delete files['/mnt/c/a.md'];
    scan.refresh(['/mnt/c/a.md']);
    await tick();
    expect(scan.readFailure('/mnt/c/a.md')).toBeNull();
    warn.mockRestore();
  });

  it('refresh after dispose does nothing', async () => {
    const { fs, reads } = liveFs({ '/mnt/c/a.md': entry('A') });
    const scan = createCorpusScan('/mnt/c', fs, flushed);
    await scan.done;
    scan.dispose();
    reads.length = 0;
    scan.refresh(['/mnt/c/a.md']);
    await tick();
    expect(reads).toEqual([]);
  });
});
