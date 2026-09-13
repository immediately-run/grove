// @vitest-environment jsdom
// G-GA-1 / G-GA-2 — the surface itself: with `writable=false` and no provider, the
// DOM contains no write-flavored chip and no "proposes the edit"/"host confirms"
// copy; with `writable=false` but a configured, granted provider, Q&A is fully
// enabled (read-only NEVER blocks asking — R-GA-5). Provider/grant state is driven
// through the SDK's REAL push channels (an emitting stub transport), not mocks of
// the hooks — the component reads what the host would have said.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// `useHeadings` scans the DOM (no .grove-prose in this harness ⇒ no headings — fine).
// `fs` is read only through safeSources on the stuffing path, never in these cases.
vi.mock('fs', () => ({ default: { promises: { readFile: vi.fn(async () => '') } } }));

// runAgent is controllable for the stop-abort case (R3-608); everything else in
// the barrel stays real — the existing cases never invoke it.
const runAgentMock = vi.fn();
vi.mock('@immediately-run/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@immediately-run/sdk')>()),
  runAgent: (opts: unknown) => runAgentMock(opts),
}));

// An EMITTING stub transport: push channels subscribe per type and tests emit
// host→app messages through it (the same wire the real host speaks).
// The transport contract (`hostTransport.ts`): `onMessage(handler)` receives EVERY
// host→app message; the SDK's addListener filters by `msg.type` itself.
type Handler = (msg: Record<string, unknown>) => void;
const handlers = new Set<Handler>();
const emit = (msg: Record<string, unknown>): void => {
  for (const h of handlers) h(msg);
};
// Controllable per-case (the edit-refusal probe rejects through it); the
// default resolves like a permissive host.
const protocolRequest = vi.fn(async () => ({}));
(globalThis as { __immediatelyRun__?: unknown }).__immediatelyRun__ = {
  transport: {
    sendMessage: vi.fn(),
    protocolRequest,
    onMessage: (handler: Handler) => {
      handlers.add(handler);
      return { dispose: () => handlers.delete(handler) };
    },
  },
};

import type { GroveShell } from '../lib/shell';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
const { default: GroveAgent } = await import('./GroveAgent');
const { GroveShellContext } = await import('../lib/shell');

const NAV = {
  mode: 'github',
  namespace: 'immediately-run',
  provider: 'github',
  repository: 'docs',
  ref: 'main',
  sandboxPath: '/app',
  hash: '',
  search: '',
};

const shell: GroveShell = { openEditor: vi.fn() } as unknown as GroveShell;

async function renderAgent(props: { writable: boolean }): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <GroveShellContext.Provider value={shell}>
        <TinkerableContext.Provider
          value={{ outerHref: '', navigationState: NAV, routingSpec: {} as never, filesMetadata: {} }}
        >
          <GroveAgent {...props} entryKey="/app/content/wiki/security.mdx" entryTitle="Security" />
        </TinkerableContext.Provider>
      </GroveShellContext.Provider>,
    );
  });
  return { root, container };
}

const openPanel = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    (container.querySelector('.ga-line input') as HTMLInputElement)?.focus();
  });
};

/** Drive host→app pushes the way the host would: after the app subscribed. */
const push = async (msg: Record<string, unknown>): Promise<void> => {
  await act(async () => {
    emit(msg);
  });
};

// NOTE: no per-test handler reset. The SDK's push channels are module-global and
// subscribe to the transport exactly once (the `started` flag in `createPushChannel`),
// so clearing the handler set would sever every later emit from the channels. Each
// test drives the FULL desired host state through its own pushes instead.

describe('G-GA-1 — no unbacked capability claims in the DOM', () => {
  it('writable=false + no provider: no write-flavored chip, no phantom-write copy', async () => {
    const { container } = await renderAgent({ writable: false });
    await push({ type: 'llm-provider', provider: null }); // answered: not-configured
    await push({ type: 'api-catalog', methods: [] }); // nothing granted
    await openPanel(container);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/add an entry|fix broken links|reorganize the sidebar|add a timeline/i);
    expect(text).not.toMatch(/proposes the edit|host confirms the write/i);
    expect(container.querySelectorAll('.ga-chip').length).toBe(0); // no ✓ rows ⇒ no chips
    // And the honest causes ARE there:
    expect(text).toContain('no model key connected');
    expect(text).toContain('you’re a reader here');
  });
});

describe('G-GA-2 / R-GA-5 — read-only never blocks Q&A', () => {
  it('writable=false + configured granted provider ⇒ input enabled, reach card says so', async () => {
    const { container } = await renderAgent({ writable: false });
    await push({
      type: 'llm-provider',
      provider: {
        providerId: 'llm.chat.anthropic',
        hostVouched: true,
        features: { vision: false, tools: true, jsonMode: true, reasoning: false, maxContextTokens: 100000 },
      },
    });
    await push({ type: 'api-catalog', methods: [{ name: 'llm:chat', capability: 'llm:chat', stream: true }] });
    await openPanel(container);
    const input = container.querySelector('.ga-foot input') as HTMLInputElement;
    expect(input.disabled).toBe(false);
    const text = container.textContent ?? '';
    expect(text).toContain('Answer questions about this wiki');
    expect(text).toContain('you’re a reader here'); // draft row still honest
    expect(container.textContent).not.toMatch(/Suggest an edit/i); // no write chip while read-only
  });

  it('an ungranted fork renders the DISTINCT forbidden cause, never connect-a-key copy', async () => {
    const { container } = await renderAgent({ writable: true });
    await push({
      type: 'llm-provider',
      provider: {
        providerId: 'llm.chat.anthropic',
        hostVouched: true,
        features: { vision: false, tools: true, jsonMode: true, reasoning: false, maxContextTokens: 100000 },
      },
    });
    await push({ type: 'api-catalog', methods: [] }); // a key exists; this copy wasn't granted chat
    await openPanel(container);
    const text = container.textContent ?? '';
    expect(text).toContain("this Grove wasn't granted chat — reading works as normal");
    expect(text).not.toContain('add one in Settings');
    const input = container.querySelector('.ga-foot input') as HTMLInputElement;
    expect(input.disabled).toBe(true); // cannot ask — but reading works, and the card says why
  });

  it('R-GA-6 — the egress disclosure shows whenever a provider is bound', async () => {
    const { container } = await renderAgent({ writable: false });
    await push({
      type: 'llm-provider',
      provider: {
        providerId: 'llm.chat.anthropic',
        hostVouched: true,
        features: { vision: false, tools: true, jsonMode: true, reasoning: false, maxContextTokens: 100000 },
      },
    });
    await push({ type: 'api-catalog', methods: [{ name: 'llm:chat', capability: 'llm:chat', stream: true }] });
    await openPanel(container);
    expect(container.textContent).toContain('answers come from your connected model provider');
  });
});

describe('R3-608 — the composer stops the run; a refusal surfaces, a cancel does not', () => {
  beforeAll(() => {
    // jsdom lacks Element.scrollTo; the auto-scroll effect only needs to be a no-op.
    HTMLElement.prototype.scrollTo = () => undefined as unknown as void;
  });
  const configured = {
    type: 'llm-provider',
    provider: {
      providerId: 'llm.chat.anthropic',
      hostVouched: true,
      features: { vision: false, tools: true, jsonMode: true, reasoning: false, maxContextTokens: 100000 },
    },
  } as const;
  const granted = {
    type: 'api-catalog',
    methods: [{ name: 'llm:chat', capability: 'llm:chat', stream: true }],
  } as const;

  it('stop aborts the in-flight run — signal aborted, streaming cleared, a Stopped row, no error', async () => {
    // The REAL loop contract on abort: the promise RESOLVES with the partial
    // transcript (a clean stop, never a thrown error) — the mock mirrors it.
    runAgentMock.mockImplementationOnce(
      (opts: { signal?: AbortSignal }) =>
        new Promise((resolve) => {
          opts.signal?.addEventListener('abort', () =>
            resolve([
              { role: 'user', content: 'what is here?' },
              { role: 'assistant', content: 'partial answer' },
            ]),
          );
        }),
    );
    const { container } = await renderAgent({ writable: false });
    await push(configured);
    await push(granted);
    await openPanel(container);
    const input = container.querySelector('.ga-foot input') as HTMLInputElement;
    await act(async () => {
      // The native value setter: React's tracker ignores a bare .value assign.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'what is here?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      (container.querySelector('.ga-foot .go') as HTMLElement).click();
    });
    // Streaming: the stop control exists and the send is spent.
    const stop = container.querySelector('.ga-foot .stop') as HTMLElement;
    expect(stop).toBeTruthy();
    let signal: AbortSignal | undefined;
    runAgentMock.mock.calls.forEach((c) => {
      signal = (c[0] as { signal?: AbortSignal }).signal;
    });
    expect(signal).toBeTruthy();
    await act(async () => {
      stop.click();
    });
    expect(signal!.aborted).toBe(true);
    expect(container.textContent).toContain('Stopped');
    expect(container.textContent).not.toContain('the model or backend errored');
    expect(container.querySelector('.ga-foot .stop')).toBeNull();
  });

  it('a REFUSING edit renders the failure text; a cancelled one renders nothing', async () => {
    // The real hook, through the real requestEdit → the controllable transport.
    const { useEditAffordance } = await import('../hooks/useEditAffordance');
    const refusedStates: boolean[] = [];
    function Probe() {
      const aff = useEditAffordance(false);
      refusedStates.push(aff.refused);
      return (
        <div>
          <button onClick={() => aff.openEditor('/app/content/wiki/security.mdx')}>edit</button>
          <div data-testid="refused">{aff.refused ? 'REFUSED' : ''}</div>
        </div>
      );
    }
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<Probe />);
    });

    // A refusal (anything not `cancelled`): the host said no — it must surface.
    protocolRequest.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'forbidden' }));
    await act(async () => {
      (host.querySelector('button') as HTMLElement).click();
    });
    expect(host.querySelector('[data-testid="refused"]')?.textContent).toBe('REFUSED');

    // A cancellation: the reader closed the editor — silent by contract.
    await act(async () => {
      root.render(<div />);
      root.render(<Probe />);
    });
    refusedStates.length = 0;
    protocolRequest.mockRejectedValueOnce(Object.assign(new Error('closed'), { code: 'cancelled' }));
    await act(async () => {
      (host.querySelector('button') as HTMLElement).click();
    });
    expect(host.querySelector('[data-testid="refused"]')?.textContent).toBe('');
    await act(async () => {
      root.unmount();
    });
  });

  it('the agent panel renders the refusal text where the affordance is offered', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const refusingShell: GroveShell = { openEditor: vi.fn(), editRefused: true } as unknown as GroveShell;
    await act(async () => {
      root.render(
        <GroveShellContext.Provider value={refusingShell}>
          <TinkerableContext.Provider
            value={{ outerHref: '', navigationState: NAV, routingSpec: {} as never, filesMetadata: {} }}
          >
            <GroveAgent writable={false} entryKey="/app/content/wiki/security.mdx" entryTitle="Security" />
          </TinkerableContext.Provider>
        </GroveShellContext.Provider>,
      );
    });
    await openPanel(host);
    expect(host.textContent).toContain('Could not open the editor — the host refused');
    await act(async () => {
      root.unmount();
    });
  });
});
