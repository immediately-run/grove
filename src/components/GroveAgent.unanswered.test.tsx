// @vitest-environment jsdom
// ONE case, in its own file, because it needs a module registry where the catalog has
// never been answered.
//
// `useCatalogAnswered`'s flag is module-global and never resets — correct for an app, in
// which the host answers once per realm, but it means any test that has already pushed an
// `api-catalog` poisons this one. Every case in `GroveAgent.test.tsx` pushes one. Vitest
// isolates by file, so a separate file IS the isolation; the harness is shared rather
// than copied (`src/test/groveAgentHarness.tsx`).
//
// Why this case exists at all: round 3 showed the hook was not load-bearing for any
// component test — replacing `useCatalogAnswered()` with the literal `true`, i.e. exactly
// the behaviour the hook was written to replace, left all 506 tests green. The unit arm
// (`reachCard.test.ts`) and the hook itself were covered; the wire between them was not.
// That is round 1's blocking finding recurring one level up.
import { describe, it, expect, vi } from 'vitest';

// `useHeadings` scans the DOM; `fs` is read only on the stuffing path, never here.
vi.mock('fs', () => ({ default: { promises: { readFile: vi.fn(async () => '') } } }));
vi.mock('@immediately-run/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@immediately-run/sdk')>()),
  runAgent: vi.fn(),
}));

const { renderAgent, openPanel, push } = await import('../../test/groveAgentHarness');

describe('R3-688 — before the catalog answers, the Q&A row names no cause', () => {
  it('renders neutral: not a guessed consent state, not a guessed key state, no chips', async () => {
    // No catalog push at all. The provider HAS answered `{ provider: null }`, which on a
    // pre-mark host is what both a keyless frame and an ungranted fork receive — so the
    // grant is genuinely unknown and the card must say nothing rather than pick one.
    const { container } = await renderAgent({ writable: true });
    await push({ type: 'llm-provider', provider: null });
    await openPanel(container);
    const text = container.textContent ?? '';

    expect(text).toContain('Answer questions about this wiki');
    expect(text).not.toContain("wasn't granted chat");
    expect(text).not.toContain('no model key connected');
    // No Q&A chips. Not "no chips at all": `writable: true` makes the Draft row ✓ and it
    // contributes its own, which is correct and has nothing to do with the catalog.
    const chips = [...container.querySelectorAll('.ga-chip')].map((c) => c.textContent ?? '');
    expect(chips.some((c) => /summarize|tagged security/i.test(c))).toBe(false);
  });
});
