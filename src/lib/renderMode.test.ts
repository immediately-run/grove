// The safe-vs-compiled rule is ONE-DIRECTIONAL (owner, 2026-11-18): a wiki whose home entry
// declares `render: safe` renders every entry safely, and no entry's own frontmatter can
// turn that back to compiled; an entry may only opt ITSELF into safe within a wiki that is
// otherwise compiled. A frontmatter block the parser rejects counts as `render: safe` for
// whatever it governs (R3-1350), which moves in the same, safe direction only.
import { describe, it, expect } from 'vitest';

import { FRONTMATTER_REJECTED, resolveSafeRender } from './renderMode';

const rejected = { [FRONTMATTER_REJECTED]: { kind: 'yaml', message: 'x', line: 2 } };

describe('resolveSafeRender — safe only ever wins', () => {
  it('a safe wiki stays safe whatever the entry says', () => {
    const home = { render: 'safe' };
    for (const entry of [null, {}, { render: 'compiled' }, { render: 'unsafe' }, { render: false }, { render: '' }]) {
      expect(resolveSafeRender(home, entry as Record<string, unknown> | null)).toBe(true);
    }
  });

  it('an entry can opt itself into safe inside a compiled wiki', () => {
    expect(resolveSafeRender({ title: 'Home' }, { render: 'safe' })).toBe(true);
    expect(resolveSafeRender(null, { render: 'safe' })).toBe(true);
  });

  it('only the exact value `safe` opts in; nothing else changes a compiled wiki', () => {
    for (const entry of [null, {}, { render: 'compiled' }, { render: 'Safe' }, { render: true }]) {
      expect(resolveSafeRender({ title: 'Home' }, entry as Record<string, unknown> | null)).toBe(false);
    }
  });

  it('a rejected block counts as safe for what it governs: the wiki (home) or that entry', () => {
    expect(resolveSafeRender(rejected, null)).toBe(true);
    expect(resolveSafeRender(rejected, { render: 'compiled' })).toBe(true);
    expect(resolveSafeRender({ title: 'Home' }, rejected)).toBe(true);
    // A rejected ENTRY never makes another entry safe: it governs only itself.
    expect(resolveSafeRender({ title: 'Home' }, { title: 'Other' })).toBe(false);
  });
});
