import { describe, it, expect } from 'vitest';
import { createSourceCache } from './sourceCache';

describe('createSourceCache', () => {
  it('memoises a successful read so `use()` gets a stable promise', async () => {
    let calls = 0;
    const c = createSourceCache(async (p) => { calls++; return `body of ${p}`; });
    const a = c.read('x.mdx');
    const b = c.read('x.mdx');
    expect(a).toBe(b); // identical promise identity, which is what `use()` requires
    expect(await a).toBe('body of x.mdx');
    expect(calls).toBe(1);
  });

  it('does NOT memoise a failure — the next read retries', async () => {
    // The defect this guards: the host↔sandbox RPC drops requests during a navigation, and
    // a rejected promise left in the cache was returned to every later render, so the entry
    // stayed blank for the rest of the session with no error and no way back.
    let calls = 0;
    const c = createSourceCache(async (p) => {
      calls++;
      if (calls === 1) throw new Error('Invalid RPC id');
      return `body of ${p}`;
    });

    await expect(c.read('x.mdx')).rejects.toThrow('Invalid RPC id');
    expect(c.size()).toBe(0); // evicted, not retained

    expect(await c.read('x.mdx')).toBe('body of x.mdx'); // recovered
    expect(calls).toBe(2);
  });

  it('keeps a later successful read even if an earlier one failed', async () => {
    let calls = 0;
    const c = createSourceCache(async () => {
      calls++;
      if (calls === 1) throw new Error('transient');
      return 'ok';
    });
    await expect(c.read('a.mdx')).rejects.toThrow();
    await c.read('a.mdx');
    expect(await c.read('a.mdx')).toBe('ok');
    expect(calls).toBe(2); // the second read was memoised
  });

  it('evicts only the failing path', async () => {
    const c = createSourceCache(async (p) => {
      if (p === 'bad.mdx') throw new Error('nope');
      return 'fine';
    });
    await c.read('good.mdx');
    await expect(c.read('bad.mdx')).rejects.toThrow();
    expect(c.size()).toBe(1);
  });

  it('invalidates one path, or all of them', async () => {
    const c = createSourceCache(async () => 'v');
    await c.read('a.mdx');
    await c.read('b.mdx');
    expect(c.size()).toBe(2);
    c.invalidate('a.mdx');
    expect(c.size()).toBe(1);
    c.invalidate();
    expect(c.size()).toBe(0);
  });

  // R3-1373: a live edit bumps the edited path's version only, and tells subscribers.
  it('invalidate bumps that path’s version and notifies; other paths keep theirs', () => {
    const c = createSourceCache(async () => 'v');
    const heard: number[] = [];
    const stop = c.subscribe(() => heard.push(c.version('a.mdx')));
    expect(c.version('a.mdx')).toBe(0);
    c.invalidate('a.mdx');
    expect(c.version('a.mdx')).toBe(1);
    expect(c.version('b.mdx')).toBe(0);
    expect(heard).toEqual([1]);
    c.invalidate();
    expect(c.version('b.mdx')).toBe(1);
    stop();
    c.invalidate('a.mdx');
    expect(heard).toHaveLength(2);
  });

  // R3-1373 review (1-A-0/1-B-0): a render deferred behind an edit reads the previous
  // version's resolved promise until the fresh read lands.
  it('readAt holds the previous version’s promise while the fresh read is pending', async () => {
    let n = 0;
    const releases: Array<() => void> = [];
    const c = createSourceCache(
      (p) => new Promise<string>((r) => (n++ === 0 ? r(`${p} v0`) : releases.push(() => r(`${p} v1`)))),
    );
    const first = c.readAt('a.mdx', 0);
    expect(await first).toBe('a.mdx v0');
    c.invalidate('a.mdx');
    expect(c.readAt('a.mdx', 0)).toBe(first); // the old bytes, while v1 is in flight
    const fresh = c.readAt('a.mdx', 1);
    expect(fresh).not.toBe(first);
    releases.forEach((r) => r());
    expect(await fresh).toBe('a.mdx v1');
    expect(c.readAt('a.mdx', 0)).toBe(fresh); // landed: the held promise is dropped
  });
});
