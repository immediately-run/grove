// R3-1373 — the corpus change feed: watch events joined to absolute keys, one batch per
// tick, stopped through the iterator's own return() (ZenFS ignores AbortSignal).
import { describe, it, expect, vi } from 'vitest';
import { watchCorpus, type CorpusWatchEvent, type WatchFs } from './corpusWatch';

/** A watch whose events the test pushes; records how it was opened and stopped. */
function controllableWatch() {
  const queue: CorpusWatchEvent[] = [];
  let wake: (() => void) | null = null;
  let ended = false;
  const opened: Array<{ path: string; opts: unknown }> = [];
  const returned = vi.fn(async () => {
    ended = true;
    wake?.();
    return { done: true, value: undefined };
  });
  const fs: WatchFs = {
    watch(path, opts) {
      opened.push({ path, opts });
      return {
        [Symbol.asyncIterator]() {
          return {
            async next(): Promise<IteratorResult<CorpusWatchEvent>> {
              while (!queue.length && !ended) await new Promise<void>((r) => (wake = r));
              if (ended) return { done: true, value: undefined };
              return { done: false, value: queue.shift()! };
            },
            return: returned,
          };
        },
        return: returned,
      } as AsyncIterable<CorpusWatchEvent>;
    },
  };
  const push = (...events: CorpusWatchEvent[]) => {
    queue.push(...events);
    wake?.();
  };
  return { fs, push, opened, returned };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('watchCorpus', () => {
  it('watches the root recursively and reports absolute paths', async () => {
    const w = controllableWatch();
    const onPaths = vi.fn();
    const stop = watchCorpus('/mnt/c', w.fs, onPaths);
    await settle();
    expect(w.opened).toEqual([{ path: '/mnt/c', opts: { recursive: true } }]);
    w.push({ eventType: 'change', filename: 'DIB-26.md' });
    await settle();
    expect(onPaths).toHaveBeenCalledWith(['/mnt/c/DIB-26.md']);
    stop();
  });

  it('coalesces the events of one tick into one batch, deduplicated', async () => {
    const w = controllableWatch();
    const onPaths = vi.fn();
    const stop = watchCorpus('/mnt/c/', w.fs, onPaths);
    await settle();
    w.push(
      { eventType: 'change', filename: 'a.md' },
      { eventType: 'rename', filename: '/sub/b.mdx' },
      { eventType: 'change', filename: 'a.md' },
    );
    await settle();
    expect(onPaths).toHaveBeenCalledTimes(1);
    expect(onPaths.mock.calls[0][0].sort()).toEqual(['/mnt/c/a.md', '/mnt/c/sub/b.mdx']);
    stop();
  });

  it('stops through the iterator return(), and reports nothing after', async () => {
    const w = controllableWatch();
    const onPaths = vi.fn();
    const stop = watchCorpus('/mnt/c', w.fs, onPaths);
    await settle();
    stop();
    expect(w.returned).toHaveBeenCalled();
    w.push({ eventType: 'change', filename: 'late.md' });
    await settle();
    expect(onPaths).not.toHaveBeenCalled();
  });

  it('a return() that rejects at teardown is caught, not left unhandled (1-A-2)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fs: WatchFs = {
      watch() {
        return {
          [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => {}) }),
          return: () => Promise.reject(new Error('port closed')),
        } as AsyncIterable<CorpusWatchEvent>;
      },
    };
    const stop = watchCorpus('/mnt/c', fs, vi.fn());
    await settle();
    stop();
    await settle();
    expect(warn).toHaveBeenCalledWith('[grove] stopping a corpus watch failed', expect.any(Error));
    warn.mockRestore();
  });

  it('a watch that cannot be set up warns once and never rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fs: WatchFs = {
      watch() {
        throw Object.assign(new Error('no fs'), { code: 'ENOSYS' });
      },
    };
    const stop = watchCorpus('/mnt/c', fs, vi.fn());
    await settle();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('/mnt/c');
    stop();
    warn.mockRestore();
  });
});
