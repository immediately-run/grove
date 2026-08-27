import { describe, it, expect, afterEach } from 'vitest';
import { resolveOpenWiki, OPEN_WIKI_TASK, CONTENT_MOUNT_TYPE } from './openWiki';
import {
  getContentRoot,
  getCorpusMountId,
  setContentRoot,
  resetContentRoot,
  isDispatched,
  APP_CONTENT_ROOT,
} from './contentRoot';
import { slugToKey, isContentEntry, homeKey, contentDir, keyToHref, sandboxPathToKey } from './content';
import { layoutChainForKey } from './layout';
import type { SandboxMount } from '@immediately-run/sdk/mounts';

const mount = (path: string, extra: Partial<SandboxMount> = {}): SandboxMount =>
  ({ path, type: 'task', ...extra }) as SandboxMount;

afterEach(resetContentRoot);

describe('resolveOpenWiki — the delegated corpus', () => {
  it('resolves the dir param mounted at the host-minted chroot', () => {
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [mount('/app'), mount('/task/t1/dir')]);
    expect(r).toEqual({ ok: true, root: '/task/t1/dir', readOnly: false, via: 'task', mountId: '/task/t1/dir' });
  });

  it('reports a read-only delegation without refusing it', () => {
    // Sharing a corpus read-only is legitimate — the reader still reads. Only the WRITE
    // affordances may consult this; refusing the whole open would break the ordinary case.
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [mount('/task/t1/dir', { mode: 'ro' })]);
    expect(r).toEqual({ ok: true, root: '/task/t1/dir', readOnly: true, via: 'task', mountId: '/task/t1/dir' });
  });

  it('is not a callee when there is no task input — the ordinary fork boot', () => {
    expect(resolveOpenWiki(null, [mount('/app')])).toEqual({ ok: false, reason: 'not-a-callee' });
  });

  it('refuses a task it does not provide', () => {
    expect(resolveOpenWiki({ task: 'edit-file', params: {} }, [mount('/task/t1/file')]))
      .toEqual({ ok: false, reason: 'wrong-task' });
  });

  it('reports no-mount rather than falling back to its OWN corpus', () => {
    // The dangerous failure: rendering the viewer's repo while the reader believes they
    // are looking at the delegated one. Silence is not an option here — cancel instead.
    expect(resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [mount('/app')]))
      .toEqual({ ok: false, reason: 'no-mount' });
  });

  it('never mistakes the app\'s own repo mount for the delegation', () => {
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [mount('/app'), mount('/app/dir')]);
    expect(r).toEqual({ ok: false, reason: 'no-mount' });
  });

  it('takes a single unambiguous foreign mount when the param segment is not the hook', () => {
    // The host owns the `/task/<slot>/<param>` grammar; if it ever renames the segment,
    // suffix-matching alone would cancel a task the user really asked for.
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [mount('/app'), mount('/mnt/abc123')]);
    expect(r).toEqual({ ok: true, root: '/mnt/abc123', readOnly: false, via: 'task', mountId: '/mnt/abc123' });
  });

  it('does not guess between two foreign mounts', () => {
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [mount('/mnt/a'), mount('/mnt/b')]);
    expect(r).toEqual({ ok: false, reason: 'no-mount' });
  });

  it('honours a canonical app mount path that is not /app', () => {
    // The repo is dual-mounted at /app and /mnt/{hash}; the host reports the canonical
    // one. Hardcoding /app here would read the viewer's own corpus as the delegation.
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [mount('/mnt/self')], '/mnt/self');
    expect(r).toEqual({ ok: false, reason: 'no-mount' });
  });
});

describe('repo-load dispatch — a cold URL load, with no task input at all', () => {
  it('resolves the corpus from the MARKED mount', () => {
    // R3-172: the URL named a content repo; the host resolved this viewer through the
    // binding table and published the corpus stamped `type: 'content'`.
    const r = resolveOpenWiki(null, [
      mount('/app'),
      mount('/mnt/deadbeef', { type: CONTENT_MOUNT_TYPE, name: 'neumark/book-nine-from-here' }),
    ]);
    expect(r).toEqual({ ok: true, root: '/mnt/deadbeef', readOnly: false, via: 'repo-load', mountId: '/mnt/deadbeef' });
  });

  it('carries a read-only delegation through', () => {
    const r = resolveOpenWiki(null, [mount('/mnt/x', { type: CONTENT_MOUNT_TYPE, mode: 'ro' })]);
    expect(r).toMatchObject({ ok: true, readOnly: true, via: 'repo-load' });
  });

  it('answers FORK immediately when there are no mounts at all', () => {
    // Measured, not assumed: a plain present-mode fork publishes NO mounts — worktrees,
    // spaces and dispatched corpora are published, the app's own repo arrives as `/app`
    // through the bundler. So an empty set must mean "fork, render now", never "wait and
    // see", or every ordinary wiki pays a grace period for a guess that never pays off.
    expect(resolveOpenWiki(null, [])).toEqual({ ok: false, reason: 'not-a-callee' });
  });

  it('is NOT fooled by an unmarked foreign mount when there is no task', () => {
    // The whole reason the host marks it: a reader who holds a space has a foreign mount
    // that is not a corpus. Guessing here would render somebody's space as a wiki.
    expect(resolveOpenWiki(null, [mount('/app'), mount('/spaces/s1', { type: 'firestore' })]))
      .toEqual({ ok: false, reason: 'not-a-callee' });
    expect(resolveOpenWiki(null, [mount('/app'), mount('/mnt/wt', { type: 'worktree' })]))
      .toEqual({ ok: false, reason: 'not-a-callee' });
  });

  it('prefers the marked mount over a task delegation, and says which', () => {
    // Both present is not a real shape today, but the precedence must be decided rather
    // than emergent: the mark is the host's explicit statement about THIS load.
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [
      mount('/task/t1/dir'),
      mount('/mnt/marked', { type: CONTENT_MOUNT_TYPE }),
    ]);
    expect(r).toMatchObject({ root: '/mnt/marked', via: 'repo-load' });
  });
});

describe('contentRoot — the corpus location is a runtime value', () => {
  it('defaults to the fork packaging and reports itself as not dispatched', () => {
    expect(getContentRoot()).toBe(APP_CONTENT_ROOT);
    expect(isDispatched()).toBe(false);
  });

  it('normalizes a missing trailing slash, so every startsWith/slice holds', () => {
    setContentRoot('/task/t1/dir');
    expect(getContentRoot()).toBe('/task/t1/dir/');
    expect(isDispatched()).toBe(true);
  });

  it('re-points every helper built on the root, not just the constant', () => {
    // The reason this is a function and not a constant: these helpers are what nav,
    // routing, the sidebar and the layout chain are made of. If any one of them kept the
    // build-time root, a dispatched Grove would render a MIXTURE of two corpora.
    setContentRoot('/task/t1/dir');
    expect(contentDir()).toBe('/task/t1/dir/');
    expect(homeKey()).toBe('/task/t1/dir/home.mdx');
    expect(slugToKey('characters/the-cast')).toBe('/task/t1/dir/characters/the-cast.mdx');
    expect(isContentEntry('/task/t1/dir/themes.mdx')).toBe(true);
    // …and the viewer's OWN corpus stops being content once it is not the root.
    expect(isContentEntry('/app/content/home.mdx')).toBe(false);
  });

  it('builds the layout chain from the delegated root', () => {
    setContentRoot('/task/t1/dir');
    const corpus = {
      '/task/t1/dir/_layout.mdx': {},
      '/task/t1/dir/plot/_layout.mdx': {},
      '/task/t1/dir/plot/the-rail.mdx': {},
    };
    expect(layoutChainForKey('/task/t1/dir/plot/the-rail.mdx', corpus)).toEqual([
      '/task/t1/dir/_layout.mdx',
      '/task/t1/dir/plot/_layout.mdx',
    ]);
  });
});

describe('routing — the URL space follows the packaging', () => {
  it('leaves a FORK\'s URLs byte-identical', () => {
    // These are published, cited and deep-linked. A "tidy-up" here breaks every shared
    // link into the docs wiki, so the fork mapping is pinned rather than merely tested.
    expect(keyToHref('/app/content/specs/TRUST_MODES_SPEC.mdx')).toBe('/content/specs/TRUST_MODES_SPEC.mdx');
    expect(sandboxPathToKey('/content/specs/TRUST_MODES_SPEC.mdx')).toBe('/app/content/specs/TRUST_MODES_SPEC.mdx');
    expect(sandboxPathToKey('/files/content/home.mdx')).toBe('/app/content/home.mdx');
    expect(sandboxPathToKey('/')).toBe('/app/content/home.mdx');
  });

  it('makes a DISPATCHED viewer\'s URLs corpus-relative', () => {
    // The mount is chrooted AT the content directory, so the mount root IS the corpus
    // root — there is no app-root left to measure from.
    setContentRoot('/task/t1/dir');
    expect(keyToHref('/task/t1/dir/plot/the-rail.mdx')).toBe('/plot/the-rail.mdx');
    expect(sandboxPathToKey('/plot/the-rail.mdx')).toBe('/task/t1/dir/plot/the-rail.mdx');
    expect(sandboxPathToKey('/files/plot/the-rail.mdx')).toBe('/task/t1/dir/plot/the-rail.mdx');
    expect(sandboxPathToKey('/')).toBe('/task/t1/dir/home.mdx');
  });

  it('round-trips key → href → key under both packagings', () => {
    // The pair has to be symmetric or a link renders to a URL that resolves to a different
    // entry — the R3-252 class of failure, where navigation lands on the wrong document.
    const fork = '/app/content/plot/the-rail.mdx';
    expect(sandboxPathToKey(keyToHref(fork))).toBe(fork);
    setContentRoot('/task/t1/dir');
    const dispatched = '/task/t1/dir/plot/the-rail.mdx';
    expect(sandboxPathToKey(keyToHref(dispatched))).toBe(dispatched);
  });

  it('refuses a traversal that keeps the content-root PREFIX — the shipped-fork shape', () => {
    // ⚠ This is the pre-existing defect, and it is a FORK bug too, not only a dispatch one.
    // The escape needs the `..` to come AFTER the content segment, so the raw-text check
    // passes while the path resolves elsewhere:
    //
    //   /files/content/../../src/App.tsx  →  /app/content/../../src/App.tsx  →  /src/App.tsx
    //   /content/../../../spaces/s1/x.md  →  …                              →  /spaces/s1/x.md
    //
    // The second is the one that matters: it leaves the app's own repo for ANOTHER MOUNT.
    // The resulting key is what `fs.readFile` gets (bodies, reading time, backlinks) and
    // what `<Include filename>` gets on the compiled path — where it is EVALUATED.
    expect(sandboxPathToKey('/files/content/../../src/App.tsx')).toBe('/app/content/home.mdx');
    expect(sandboxPathToKey('/content/../../../spaces/s1/private.md')).toBe('/app/content/home.mdx');
    expect(sandboxPathToKey('/content/../.claude/memory/x.md')).toBe('/app/content/home.mdx');
    // A `..` that stays inside the corpus is not an escape and still resolves.
    expect(sandboxPathToKey('/content/plot/../home.mdx')).toBe('/app/content/home.mdx');
    expect(sandboxPathToKey('/content/plot/../themes.mdx')).toBe('/app/content/themes.mdx');
  });

  it('sends a path OUTSIDE the corpus home rather than reading it', () => {
    // Under dispatch this is the guard that stops a crafted URL from naming a file outside
    // the delegation: it can only ever resolve to an entry inside the content root.
    setContentRoot('/task/t1/dir');
    // Traversal resolves and lands outside → home. The check must run on the RESOLVED
    // path: `/task/t1/dir/../../app/src/App.tsx` starts with the content root as a string
    // and is a different file as a path, and this key is what `fs.readFile` receives.
    expect(sandboxPathToKey('/../../app/src/App.tsx')).toBe('/task/t1/dir/home.mdx');
    expect(sandboxPathToKey('/plot/../../../etc/passwd')).toBe('/task/t1/dir/home.mdx');

    // A URL that merely LOOKS like the viewer's own app path is not one: under dispatch
    // `/app` has no special meaning, so this is an ordinary corpus-relative path that
    // stays inside the delegation and simply has no entry (the 404 index).
    const key = sandboxPathToKey('/app/content/home.mdx');
    expect(key.startsWith('/task/t1/dir/')).toBe(true);
    expect(key).toBe('/task/t1/dir/app/content/home.mdx');
  });
});

// R3-266 — the corpus mount ID, which is what an onward delegation NAMES. Without it a
// dispatched viewer can locate the corpus and still not hand one of its files to the
// platform editor, which is the whole of the dispatched write path.
describe('resolveOpenWiki — the corpus mount id (the onward-delegation handle)', () => {
  it('prefers the host-published id over the path', () => {
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [
      mount('/task/t1/dir', { id: 'space:abc' }),
    ]);
    expect(r).toMatchObject({ ok: true, mountId: 'space:abc' });
  });

  it('falls back to the mount PATH, which is exactly what the host publishes for a chroot', () => {
    // `mintDelegations` names the descriptor `{ path, type: 'task-delegation', id: path }`,
    // so path and id coincide for a task delegation — the fallback is the same answer, not
    // a guess, and it keeps working against a host that publishes no id at all.
    const r = resolveOpenWiki({ task: OPEN_WIKI_TASK, params: {} }, [mount('/task/t1/dir')]);
    expect(r).toMatchObject({ ok: true, mountId: '/task/t1/dir' });
  });

  it('carries the id through the repo-load branch too', () => {
    const r = resolveOpenWiki(null, [
      mount('/mnt/deadbeef', { type: CONTENT_MOUNT_TYPE, id: 'github:neumark/book@main' }),
    ]);
    expect(r).toMatchObject({ ok: true, via: 'repo-load', mountId: 'github:neumark/book@main' });
  });

  it('reaches the contentRoot module, so the affordance can read it back', () => {
    setContentRoot('/task/t1/dir', { readOnly: false, mountId: 'space:abc' });
    expect(getCorpusMountId()).toBe('space:abc');
    resetContentRoot();
    expect(getCorpusMountId()).toBeNull();
  });
});
