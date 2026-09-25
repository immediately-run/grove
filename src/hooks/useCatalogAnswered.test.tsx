// @vitest-environment jsdom
// `useCatalogAnswered` — rendered in a real React tree, driven through the SDK's REAL
// catalog push channel against an emitting stub transport. The whole point of the hook is
// a timing property of that channel, so a mock of either would assert nothing.
//
// The property under test: the push channel has no value-equality check, so a host answer
// of `[]` — identical to the initial value — still notifies. That second notification is
// the signal. A test that only pushed a NON-empty catalog would pass against a naive
// `catalog.length > 0` implementation and prove nothing, which is why the empty-answer
// case is the one that carries this file.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

type Handler = (msg: Record<string, unknown>) => void;
const handlers = new Set<Handler>();
const emit = (msg: Record<string, unknown>): void => {
  for (const h of handlers) h(msg);
};

// Installed BEFORE the SDK is imported: the channel resolves its transport lazily, and
// the hook module subscribes at import time.
(globalThis as { __immediatelyRun__?: unknown }).__immediatelyRun__ = {
  transport: {
    sendMessage: vi.fn(),
    protocolRequest: vi.fn(async () => ({})),
    onMessage: (handler: Handler) => {
      handlers.add(handler);
      return { dispose: () => handlers.delete(handler) };
    },
  },
};

let useCatalogAnswered: typeof import('./useCatalogAnswered').useCatalogAnswered;
let getCatalog: typeof import('@immediately-run/sdk').getCatalog;

beforeAll(async () => {
  ({ useCatalogAnswered } = await import('./useCatalogAnswered'));
  ({ getCatalog } = await import('@immediately-run/sdk'));
});

/** Render a probe recording the hook's value on every render. */
const renderProbe = async () => {
  const seen: boolean[] = [];
  const Probe = () => {
    seen.push(useCatalogAnswered());
    return null;
  };
  const root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(<Probe />);
  });
  return { seen, unmount: () => act(async () => root.unmount()) };
};

describe('useCatalogAnswered', () => {
  it('is false before the host answers — the subscribe-time call is not an answer', async () => {
    // `onCatalogChange` invokes its listener once, SYNCHRONOUSLY, with the current value
    // when you subscribe. If that counted, the flag would be true from module load and
    // the reach card would read an unanswered catalog as "not granted" — the exact defect
    // this hook exists to prevent.
    getCatalog(); // start the channel the way the app does
    const { seen, unmount } = await renderProbe();
    expect(seen[seen.length - 1]).toBe(false);
    await unmount();
  });

  it('an EMPTY catalog answer flips it, and RE-RENDERS — an empty answer is still an answer', async () => {
    const { seen, unmount } = await renderProbe();
    expect(seen[seen.length - 1]).toBe(false);
    const before = seen.length;

    await act(async () => {
      emit({ type: 'api-catalog', methods: [] });
    });

    // Both halves matter: a hook that returned the flag without subscribing would show
    // the right value only on the NEXT unrelated render.
    expect(seen.length).toBeGreaterThan(before);
    expect(seen[seen.length - 1]).toBe(true);
    await unmount();
  });

  it('stays true for a probe mounted after the answer', async () => {
    const { seen, unmount } = await renderProbe();
    expect(seen[seen.length - 1]).toBe(true);
    await unmount();
  });
});
