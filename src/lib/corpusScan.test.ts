import { describe, it, expect } from 'vitest';
import { scanCorpus, listCorpusFiles, type ScanFs } from './corpusScan';
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

  it('keeps an entry with NO frontmatter, with empty metadata', async () => {
    // A draft or a bare `_layout.mdx` is still part of the corpus; dropping it would make
    // the file unroutable rather than merely unlabelled.
    const fs = fakeFs({ '/mnt/c/raw.mdx': '# just a heading\n' });
    expect(await scanCorpus('/mnt/c', fs)).toEqual({ '/mnt/c/raw.mdx': {} });
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
    expect(parseFrontmatter(src)).toEqual({ data: {}, body: src });
  });

  it('does not mistake a horizontal rule mid-document for frontmatter', () => {
    const src = '# Title\n\n---\n\nmore';
    expect(parseFrontmatter(src).data).toEqual({});
  });
});
