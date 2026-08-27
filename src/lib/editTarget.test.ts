// R3-266 — dispatched content is writable, and the MOUNT decides.
//
// The two things these tests pin are the two things that were wrong before: a dispatched
// viewer must send its edit to the CORPUS (never to Grove's own repo), and whether it may
// offer one at all must be the corpus mount's CURRENT mode rather than a property of the
// packaging or a flag latched at boot.
import { describe, expect, it } from 'vitest';
import { corpusWritable, editTarget, keyToSelfPath } from './editTarget';
import type { CorpusIdentity } from './editTarget';
import type { SandboxMount } from '@immediately-run/sdk/mounts';

const fork: CorpusIdentity = {
  dispatched: false,
  contentRoot: '/app/content/',
  mountId: null,
};
const dispatched: CorpusIdentity = {
  dispatched: true,
  contentRoot: '/task/t1/dir/',
  mountId: '/task/t1/dir',
};

const mount = (over: Partial<SandboxMount> = {}): SandboxMount =>
  ({ type: 'firestore', path: '/task/t1/dir', id: '/task/t1/dir', mode: 'rw', ...over }) as SandboxMount;

describe('editTarget — the verb follows the authority, not the packaging', () => {
  it('a FORK edits its own source through the self-scoped present→edit transition', () => {
    expect(editTarget('/app/content/handbook/onboarding.mdx', fork)).toEqual({
      via: 'self',
      path: 'content/handbook/onboarding.mdx',
    });
  });

  it('a DISPATCHED viewer delegates the CORPUS file, never a path in its own repo', () => {
    expect(editTarget('/task/t1/dir/plot/the-rail.mdx', dispatched)).toEqual({
      via: 'delegate',
      mountId: '/task/t1/dir',
      relPath: 'plot/the-rail.mdx',
    });
  });

  it('is corpus-relative under dispatch — the mount root IS the corpus root', () => {
    const t = editTarget('/task/t1/dir/home.mdx', dispatched);
    expect(t).toMatchObject({ relPath: 'home.mdx' });
    // The fork's `content/` segment must NOT leak into a corpus-relative path: the
    // delegated chroot is minted AT the content directory.
    expect((t as { relPath: string }).relPath.startsWith('content/')).toBe(false);
  });

  it('offers nothing for a key outside the mounted corpus (a leftover from the viewer)', () => {
    expect(editTarget('/app/content/home.mdx', dispatched)).toBeNull();
  });

  it('offers nothing when a dispatched corpus has no mount id to delegate from', () => {
    expect(editTarget('/task/t1/dir/home.mdx', { ...dispatched, mountId: null })).toBeNull();
  });

  it('offers nothing for the corpus root itself (a directory is not an entry)', () => {
    expect(editTarget('/task/t1/dir/', dispatched)).toBeNull();
  });

  it('never throws on a junk key', () => {
    expect(editTarget('', dispatched)).toBeNull();
    expect(editTarget(undefined as unknown as string, fork)).toBeNull();
  });

  it('keyToSelfPath strips the app anchor exactly as the fork URLs require', () => {
    expect(keyToSelfPath('/app/content/x.mdx')).toBe('content/x.mdx');
    expect(keyToSelfPath('/content/x.mdx')).toBe('content/x.mdx');
  });
});

describe('corpusWritable — the mount decides, live', () => {
  it('a fork asks about its working tree, as before', () => {
    expect(corpusWritable([{ type: 'worktree', path: '/app', mode: 'rw' } as SandboxMount], fork)).toBe(true);
    expect(corpusWritable([{ type: 'worktree', path: '/app', mode: 'ro' } as SandboxMount], fork)).toBe(false);
    expect(corpusWritable([], fork)).toBe(false);
  });

  it('a DISPATCHED viewer on an rw corpus is writable — packaging is not trust', () => {
    expect(corpusWritable([mount()], dispatched)).toBe(true);
  });

  it('a ro corpus is not writable, so the affordance is hidden rather than EROFS-ing', () => {
    expect(corpusWritable([mount({ mode: 'ro' })], dispatched)).toBe(false);
  });

  it('follows a LIVE downgrade: the same mount re-announced ro flips the answer', () => {
    expect(corpusWritable([mount({ mode: 'rw' })], dispatched)).toBe(true);
    expect(corpusWritable([mount({ mode: 'ro' })], dispatched)).toBe(false);
  });

  it('a corpus mount that has vanished is not writable', () => {
    expect(corpusWritable([mount({ id: 'space:other', path: '/mnt/x' })], dispatched)).toBe(false);
    expect(corpusWritable([], dispatched)).toBe(false);
    expect(corpusWritable(null, dispatched)).toBe(false);
  });

  it('matches a mount that carries no id by its path (what the host publishes)', () => {
    expect(corpusWritable([{ type: 'firestore', path: '/task/t1/dir', mode: 'rw' } as SandboxMount], dispatched)).toBe(
      true,
    );
  });

  it('never reports writable when there is no mount id at all', () => {
    expect(corpusWritable([mount()], { ...dispatched, mountId: null })).toBe(false);
  });
});
