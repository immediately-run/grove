// @vitest-environment jsdom
// R3-1373 review round 1 (1-B-0): a live edit must not swap the committed body for the
// Suspense fallback while the fresh read is pending — the old bytes stay on screen until
// the new ones land.
import { describe, it, expect, vi } from "vitest";
import { act, createContext } from "react";
import { createRoot } from "react-dom/client";

const h = vi.hoisted(() => ({
  files: {} as Record<string, string>,
  hold: false, // when set, the next read stays pending until `release()`
  release: null as null | (() => void),
}));

vi.mock("../lib/safeSources", async () => {
  const { createSourceCache } = await import("../lib/sourceCache");
  return {
    // The real cache over a reader the test can hold open.
    safeSources: createSourceCache(
      (path) =>
        new Promise<string>((resolve) => {
          if (!h.hold) return resolve(h.files[path]);
          h.hold = false;
          h.release = () => resolve(h.files[path]);
        }),
    ),
  };
});
vi.mock("@immediately-run/sdk", () => ({
  SafeContent: ({ source }: { source: string }) => (
    <p className="body">{source.trim()}</p>
  ),
  RenderExportedComponentContext: createContext(null),
  useFileMetadata: () => undefined,
}));
vi.mock("../hooks/useSafeVocabulary", () => ({
  useSafeVocabulary: () => ({}),
}));
vi.mock("./ScrollToFragment", () => ({ default: () => null }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import SafeEntryBody from "./SafeEntryBody";
import { safeSources } from "../lib/safeSources";

const KEY = "/mnt/c/DIB-26.md";
const flush = async () => {
  for (let i = 0; i < 5; i++)
    await act(async () => new Promise((r) => setTimeout(r, 10)));
};

describe("SafeEntryBody across a live edit (R3-1373)", () => {
  it("keeps the committed body on screen while the fresh read is pending, then shows it", async () => {
    h.files[KEY] = "---\ntitle: x\n---\nold body\n";
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<SafeEntryBody entryKey={KEY} />));
    await flush();
    expect(container.querySelector(".body")?.textContent).toBe("old body");

    // The edit: the next read is held open.
    h.files[KEY] = "---\ntitle: x\n---\nnew body\n";
    h.hold = true;
    await act(async () => safeSources.invalidate(KEY));
    await flush();
    // Mid-read: the old body is still mounted — no fallback in between.
    expect(container.querySelector(".grove-prose__loading")).toBeNull();
    expect(container.querySelector(".body")?.textContent).toBe("old body");

    // The read lands: the new bytes commit.
    await act(async () => h.release?.());
    await flush();
    expect(container.querySelector(".body")?.textContent).toBe("new body");
    act(() => root.unmount());
  });
});
