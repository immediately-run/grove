// @vitest-environment jsdom
// G-GA-1 / G-GA-2 — the surface itself: with `writable=false` and no provider, the
// DOM contains no write-flavored chip and no "proposes the edit"/"host confirms"
// copy; with `writable=false` but a configured, granted provider, Q&A is fully
// enabled (read-only NEVER blocks asking — R-GA-5). Provider/grant state is driven
// through the SDK's REAL push channels (an emitting stub transport), not mocks of
// the hooks — the component reads what the host would have said.
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// `useHeadings` scans the DOM (no .grove-prose in this harness ⇒ no headings — fine).
// `fs` is read only through safeSources on the stuffing path, never in these cases.
vi.mock('fs', () => ({ default: { promises: { readFile: vi.fn(async () => '') } } }));

// An EMITTING stub transport: push channels subscribe per type and tests emit
// host→app messages through it (the same wire the real host speaks).
// The transport contract (`hostTransport.ts`): `onMessage(handler)` receives EVERY
// host→app message; the SDK's addListener filters by `msg.type` itself.
type Handler = (msg: Record<string, unknown>) => void;
const handlers = new Set<Handler>();
const emit = (msg: Record<string, unknown>): void => {
  for (const h of handlers) h(msg);
};
(globalThis as { __immediatelyRun__?: unknown }).__immediatelyRun__ = {
  transport: {
    sendMessage: vi.fn(),
    protocolRequest: async () => ({}),
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
