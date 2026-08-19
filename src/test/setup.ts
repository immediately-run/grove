// A stub host transport, installed before any test imports the SDK.
//
// `@immediately-run/sdk`'s root module wires a debug push-channel at import time, and with
// no transport that THROWS during module evaluation — so a component test fails at import
// with "no host transport" before a single assertion runs, which reads like a broken test
// file rather than a missing environment. Inside immediately.run the host injects this
// object; here it is inert (nothing under test sends a message).
//
// Deliberately not a mock of anything: tests that care about host traffic should inject
// their own doubles rather than reach for this.
const noop = (): void => undefined;

(globalThis as { __immediatelyRun__?: unknown }).__immediatelyRun__ = {
  transport: {
    sendMessage: noop,
    protocolRequest: async () => ({}),
    onMessage: () => ({ dispose: noop }),
  },
};
