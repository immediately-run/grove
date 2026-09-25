// The shared harness for GroveAgent's wire-level tests.
//
// It lives OUTSIDE `src/` deliberately. `check:deps` walks `src/` for runtime imports and
// excludes only `*.test.*`, so a test helper under `src/` reads as app code and its
// `vitest` import as a missing runtime dependency — which is the gate working correctly,
// since the sandbox resolves an app's modules from `dependencies` alone.
//
// It was inline in `GroveAgent.test.tsx` until grove#75 round 3 needed a SECOND file: the
// `useCatalogAnswered` flag is module-global and never resets, so a case that must run
// with the catalog UNANSWERED cannot share a module registry with cases that answer it.
// Vitest isolates by file, so a separate file is the isolation — and copying sixty lines
// of harness to get it would be the duplication R6 forbids.
//
// Import this BEFORE anything that reads the SDK: installing the transport is a module
// side effect, and the SDK's channels resolve it lazily on first read.
import { vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

type Handler = (msg: Record<string, unknown>) => void;

const handlers = new Set<Handler>();

/** Emit a host→app message to every channel subscriber. */
export const emit = (msg: Record<string, unknown>): void => {
  for (const h of handlers) h(msg);
};

/** Controllable per-case; the default resolves like a permissive host. */
export const protocolRequest = vi.fn(async () => ({}) as unknown);

// An EMITTING stub transport. The transport contract (`hostTransport.ts`):
// `onMessage(handler)` receives EVERY host→app message; the SDK's addListener filters by
// `msg.type` itself.
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

/**
 * Render GroveAgent against the stub host.
 *
 * The SDK modules are imported HERE rather than at this module's top level so the
 * transport above is installed first.
 */
export async function renderAgent(
  props: { writable: boolean },
  opts: { shell?: Partial<import('../src/lib/shell').GroveShell> } = {},
): Promise<{ root: Root; container: HTMLElement }> {
  const { default: GroveAgent } = await import('../src/components/GroveAgent');
  const { GroveShellContext } = await import('../src/lib/shell');
  const { TinkerableContext } = await import('@immediately-run/sdk/TinkerableContext');
  // `opts.shell` overrides fields for cases that need a shell that refuses (the edit
  // affordance probes); everything else takes the permissive default.
  const shell = { openEditor: vi.fn(), ...opts.shell } as unknown as import('../src/lib/shell').GroveShell;

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

export const openPanel = async (container: HTMLElement): Promise<void> => {
  await act(async () => {
    (container.querySelector('.ga-line input') as HTMLInputElement)?.focus();
  });
};

/** Drive host→app pushes the way the host would: after the app subscribed. */
export const push = async (msg: Record<string, unknown>): Promise<void> => {
  await act(async () => {
    emit(msg);
  });
};
