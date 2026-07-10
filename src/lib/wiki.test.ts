import { describe, it, expect } from 'vitest';
import { headingId, sectionId, textSlug } from './wiki';

// The heading ids Grove computes MUST match the kernel's heading-slug plugin
// (`@immediately-run/transpiler` remarkHeadingAnchors, MARKDOWN_SYNTAX_SPEC §15.1 /
// R3-186 + R3-211) so a `<Toc>` link and the heading's own autolink anchor resolve
// to the same target (§15.5). These cases mirror the transpiler's golden suite.
describe('headingId — byte-identical with the kernel (§15.5)', () => {
  it('prose heading → GitHub text slug', () => {
    expect(headingId('Getting started')).toBe('getting-started');
    expect(headingId('The **bold** heading'.replace(/\*\*/g, ''))).toBe('the-bold-heading');
  });

  it('numbered heading → prose-independent section id (R3-211)', () => {
    expect(headingId('8.9 Powerbox')).toBe('sec-8-9');
    expect(headingId('8.9 Renamed entirely')).toBe('sec-8-9'); // prose-independent
    expect(headingId('7. The guarantee')).toBe('sec-7');
    expect(headingId('7A. Filesystem trust mode')).toBe('sec-7a'); // distinct from sec-7
    expect(headingId('A.0 Branding')).toBe('sec-a-0');
    expect(headingId('3.2.1 Something')).toBe('sec-3-2-1');
  });

  it('sectionId is null for prose (no false positives)', () => {
    expect(sectionId('Decisions & rejected alternatives')).toBeNull();
    expect(sectionId('Getting started')).toBeNull();
  });

  it('textSlug matches GitHub slugging (drops `.`, collapses hyphens)', () => {
    expect(textSlug('8.9 Powerbox')).toBe('89-powerbox'); // GitHub drops the dot
    expect(textSlug('Q & A: notes!')).toBe('q-a-notes');
    expect(textSlug('  spaced   out  ')).toBe('spaced-out');
  });
});
