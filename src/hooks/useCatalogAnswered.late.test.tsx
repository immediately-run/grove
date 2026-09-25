// @vitest-environment jsdom
// The LATE-IMPORT case, in its own file because it is the one ordering the sibling suite
// cannot produce: the host answers BEFORE this module is evaluated.
//
// grove is published as a pinned library (`src/lib.ts`), so "imported before any render"
// is an assumption about one embedding, not a guarantee. If the subscribe-time call is
// discarded with a blanket reset, a host that already answered is invisible for the
// realm's life — and because the host does not push again, nothing corrects it.
//
// This file exists because round 3's own fix was untested: replacing
// `answered = catalog.length > 0` with `answered = false` — i.e. the blanket reset the
// fix replaced — left the whole suite green. A fix with no failing case is a guess.
import { describe, it, expect, vi } from 'vitest';

type Handler = (msg: Record<string, unknown>) => void;
const handlers = new Set<Handler>();
const emit = (msg: Record<string, unknown>): void => {
  for (const h of handlers) h(msg);
};

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

describe('useCatalogAnswered, imported AFTER the host answered', () => {
  it('reads a non-empty catalog at subscribe as proof the answer landed', async () => {
    // Start and answer the channel through the SDK directly, with the hook module not yet
    // imported — the ordering a late-mounting library consumer produces.
    const { getCatalog } = await import('@immediately-run/sdk');
    getCatalog();
    emit({ type: 'api-catalog', methods: [{ name: 'llm:chat', capability: 'llm:chat', stream: true }] });

    // NOW import. The listener's synchronous subscribe-time call carries the answered
    // catalog; a blanket reset would throw it away and the flag would be false forever.
    const { useCatalogAnswered } = await import('./useCatalogAnswered');

    const { act } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const seen: boolean[] = [];
    const Probe = () => {
      seen.push(useCatalogAnswered());
      return null;
    };
    const root = createRoot(document.createElement('div'));
    await act(async () => {
      root.render(<Probe />);
    });

    expect(seen[seen.length - 1]).toBe(true);
    await act(async () => root.unmount());
  });
});
