// The selection precedence (02-theme-contract §4), pinned as a decision table —
// pure, so the whole cross-product of sources is cheap to assert. R3-308.
import { describe, expect, it } from 'vitest';
import { resolvePalette, resolvePolarity } from './themeSelection';
import { preferredPolarity, THEMES } from '../data/themes';

describe('resolvePalette — reader, else author, else default', () => {
  it('a reader override wins over the author declaration', () => {
    expect(resolvePalette({ reader: 'pixies', author: 'lotr' })).toBe('pixies');
  });

  it("a reader's explicit 'default' outranks a declaration — it is a choice, not an absence", () => {
    expect(resolvePalette({ reader: 'default', author: 'lotr' })).toBe('default');
  });

  it('the author declaration is the default a reader falls into', () => {
    expect(resolvePalette({ reader: null, author: 'family' })).toBe('family');
  });

  it('no reader, no author → default', () => {
    expect(resolvePalette({})).toBe('default');
    expect(resolvePalette({ reader: '', author: null })).toBe('default');
  });
});

describe('resolvePolarity — reader, else host, else the palette’s own preference', () => {
  it('a reader override wins over the host', () => {
    expect(resolvePolarity({ reader: 'light', host: 'dark', preferred: 'dark' })).toBe('light');
  });

  it('the host drives polarity when the reader is silent — palette untouched (theme:read is polarity-only)', () => {
    expect(resolvePolarity({ reader: null, host: 'light', preferred: 'dark' })).toBe('light');
    expect(resolvePolarity({ reader: null, host: 'dark', preferred: 'light' })).toBe('dark');
  });

  it('no reader, no host → the palette’s preferred polarity', () => {
    expect(resolvePolarity({ reader: null, host: null, preferred: 'light' })).toBe('light');
  });

  it('an unparseable stored override is silence, not a crash', () => {
    expect(resolvePolarity({ reader: null, host: 'light', preferred: 'dark' })).toBe('light');
  });
});

describe('the catalogue carries a preferred polarity for every theme (R3-308)', () => {
  it('every theme declares one, and unknown ids fall back to dark', () => {
    for (const t of THEMES) expect(['light', 'dark']).toContain(t.preferred);
    expect(preferredPolarity('pixies')).toBe('dark');
    expect(preferredPolarity('family')).toBe('light');
    expect(preferredPolarity('never-heard-of')).toBe('dark');
  });
});
