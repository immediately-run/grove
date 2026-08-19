import { SLUG_PARITY_FIXTURE } from '@immediately-run/mdx-plugins';
import { describe, it, expect } from 'vitest';
import { backlinkSnippet, bodyLinks, bodyLinksTo, headingId, sectionId, textSlug } from './wiki';

// The heading ids Grove computes MUST match the kernel's heading-slug plugin
// (`@immediately-run/mdx-plugins` remarkHeadingAnchors, MARKDOWN_SYNTAX_SPEC §15.1 /
// R3-186 + R3-211) so a `<Toc>` link and the heading's own autolink anchor resolve
// to the same target (§15.5).
//
// Since R3-277 that is true by CONSTRUCTION — `wiki.ts` re-exports the canon rather
// than reproducing it — and the fixture below is what makes the claim testable
// instead of merely structural: if a future change reintroduces a local copy, or the
// canon moves under us, this fails here rather than in a reader's broken TOC link.
describe('the shared slug parity fixture (R3-277)', () => {
  it('grove agrees with the canon on every case', () => {
    for (const c of SLUG_PARITY_FIXTURE) {
      expect(textSlug(c.text), c.why).toBe(c.slug);
      expect(sectionId(c.text), c.why).toBe(c.section);
      expect(headingId(c.text), c.why).toBe(c.id);
    }
  });

  it('the fixture actually arrived (a vacuous loop would pass silently)', () => {
    expect(SLUG_PARITY_FIXTURE.length).toBeGreaterThan(10);
  });
});

// The cases below predate the fixture and are kept: they read as documentation of
// the grammar at the call site, and they would catch a fixture that lost a case.
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

// ── Backlinks (R3-283) ───────────────────────────────────────────────────────
//
// The index was dead: 9,030 wiki-links in the corpus, 0 of 710 entries with a
// backlink, because `bodyLinksTo` matched three literal link forms the corpus never
// writes. The failure shape is why it survived — a feature that renders its empty
// state perfectly, where "nothing links here yet" is indistinguishable from a correct
// answer. So these assert SPECIFIC counts per supported form: a matcher that resolves
// only one form fails here rather than looking plausible.
describe('bodyLinksTo — every link form the corpus actually writes (R3-283)', () => {
  const FROM = '/app/content/roadmap/R3-283.mdx';
  const SPEC = '/app/content/specs/PLATFORM_LAYERING_SPEC.mdx';
  const SIBLING = '/app/content/roadmap/R3-282.mdx';

  const forms: Array<{ why: string; body: string; target: string }> = [
    { why: 'relative wiki-link with ../ and the extension', body: 'see [[../specs/PLATFORM_LAYERING_SPEC.mdx]]', target: SPEC },
    { why: '…and with a #fragment', body: 'see [[../specs/PLATFORM_LAYERING_SPEC.mdx#sec-2]]', target: SPEC },
    { why: '…and with an explicit label (label|target, §13.1 order)', body: 'see [[layering|../specs/PLATFORM_LAYERING_SPEC.mdx#sec-2]]', target: SPEC },
    { why: 'sibling wiki-link, no path prefix', body: 'see [[R3-282.mdx]]', target: SIBLING },
    { why: 'extension-less target — the legacy [[slug]] form', body: 'see [[R3-282]]', target: SIBLING },
    { why: 'markdown link, relative', body: 'see [the spec](../specs/PLATFORM_LAYERING_SPEC.mdx)', target: SPEC },
    { why: 'markdown link, corpus-absolute', body: 'see [x](/content/specs/PLATFORM_LAYERING_SPEC.mdx)', target: SPEC },
    { why: 'markdown link, /files-prefixed', body: 'see [x](/files/content/specs/PLATFORM_LAYERING_SPEC.mdx)', target: SPEC },
    { why: 'markdown link with a fragment', body: 'see [x](../specs/PLATFORM_LAYERING_SPEC.mdx#sec-2)', target: SPEC },
  ];

  for (const f of forms) {
    it(`resolves: ${f.why}`, () => {
      expect(bodyLinksTo(f.body, f.target, FROM)).toBe(true);
    });
  }

  it('finds ALL of them in one body — the count is specific, not ">= 1"', () => {
    const body = forms.map((f) => f.body).join('\n\n');
    expect(bodyLinks(body)).toHaveLength(forms.length);
    expect(bodyLinksTo(body, SPEC, FROM)).toBe(true);
    expect(bodyLinksTo(body, SIBLING, FROM)).toBe(true);
  });
});

describe('bodyLinksTo — what must NOT count as a backlink (R3-283)', () => {
  const FROM = '/app/content/roadmap/R3-283.mdx';
  const OTHER = '/app/content/specs/OTHER_SPEC.mdx';

  it('a PREFIX of the target key is not the target', () => {
    // The bug this guards: substring matching would call these the same entry.
    expect(bodyLinksTo('see [[../specs/OTHER.mdx]]', OTHER, FROM)).toBe(false);
    expect(bodyLinksTo('see [[../specs/OTHER_SPEC_V2.mdx]]', OTHER, FROM)).toBe(false);
    expect(bodyLinksTo('see [[../specs/OTHER_SPEC.mdx]]', OTHER, FROM)).toBe(true);
  });

  it('a link inside a fenced code block is being QUOTED, not written', () => {
    const body = ['```ts', 'body.includes(`[[../specs/OTHER_SPEC.mdx]]`)', '```'].join('\n');
    expect(bodyLinksTo(body, OTHER, FROM)).toBe(false);
  });

  it('a link inside an inline code span is quoted too', () => {
    // Verbatim from this very item's prose, which documents the forms it fixes.
    expect(bodyLinksTo('it wants `[[../specs/OTHER_SPEC.mdx]]` instead', OTHER, FROM)).toBe(false);
  });

  it('a link in the frontmatter is metadata, not body prose', () => {
    const body = ['---', 'reads-first:', '  - ../specs/OTHER_SPEC.mdx', 'title: "[[../specs/OTHER_SPEC.mdx]]"', '---', 'nothing here'].join('\n');
    expect(bodyLinksTo(body, OTHER, FROM)).toBe(false);
  });

  it('an image is not a link, and an external href is not a corpus link', () => {
    expect(bodyLinksTo('![alt](../specs/OTHER_SPEC.mdx)', OTHER, FROM)).toBe(false);
    expect(bodyLinksTo('[x](https://example.com/specs/OTHER_SPEC.mdx)', OTHER, FROM)).toBe(false);
  });

  it('relative means relative TO THE LINKING ENTRY, not to the corpus root', () => {
    // `[[specs/X.mdx]]` written in roadmap/ denotes roadmap/specs/X.mdx. Reading it as
    // corpus-relative (what the old matcher did for `[[slug]]`) would credit a backlink
    // to an entry the link does not navigate to.
    expect(bodyLinksTo('see [[specs/OTHER_SPEC.mdx]]', OTHER, FROM)).toBe(false);
    expect(bodyLinksTo('see [[specs/OTHER_SPEC.mdx]]', '/app/content/roadmap/specs/OTHER_SPEC.mdx', FROM)).toBe(true);
  });
});

describe('backlinkSnippet — marks the linking phrase, not the first 160 chars (R3-283)', () => {
  const FROM = '/app/content/roadmap/R3-283.mdx';
  const SPEC = '/app/content/specs/PLATFORM_LAYERING_SPEC.mdx';
  const lead = 'A paragraph of preamble that exists only to push the link past the first 160 characters of the entry, so a snippet that fell back to a prefix would be visibly wrong. ';

  it('uses the markdown label', () => {
    const snip = backlinkSnippet(`${lead}and then [the layering spec](../specs/PLATFORM_LAYERING_SPEC.mdx) closes it.`, SPEC, FROM);
    expect(snip).toContain('<mark>the layering spec</mark>');
    expect(snip).toContain('closes it');
  });

  it('uses the wiki label when one is given', () => {
    const snip = backlinkSnippet(`${lead}and then [[the layering spec|../specs/PLATFORM_LAYERING_SPEC.mdx]] closes it.`, SPEC, FROM);
    expect(snip).toContain('<mark>the layering spec</mark>');
  });

  it('falls back to a prefix only when the phrase is not in the rendered text', () => {
    const snip = backlinkSnippet(`${lead}[[../specs/PLATFORM_LAYERING_SPEC.mdx]]`, SPEC, FROM);
    // An unlabelled wiki-link's "phrase" is its target path, which the stripped text
    // does contain — so this marks it rather than degrading.
    expect(snip).toContain('<mark>');
  });
});

describe('backlinkSnippet — a snippet is prose, not source (R3-283)', () => {
  const FROM = '/app/content/roadmap/R3-283.mdx';
  const SPEC = '/app/content/specs/TARGET_SPEC.mdx';

  it('drops the link syntax around the marked phrase', () => {
    const snip = backlinkSnippet(
      'The link itself calls the target [[the layering contract|../specs/TARGET_SPEC.mdx#sec-2]] and carries a fragment.',
      SPEC,
      FROM,
    );
    expect(snip).toContain('calls the target <mark>the layering contract</mark> and carries');
    for (const noise of ['[[', ']]', '../specs/TARGET_SPEC.mdx']) expect(snip).not.toContain(noise);
  });

  it('does the same for a markdown link', () => {
    const snip = backlinkSnippet('This entry links to [the target spec](../specs/TARGET_SPEC.mdx) with ordinary markdown.', SPEC, FROM);
    expect(snip).toContain('links to <mark>the target spec</mark> with ordinary markdown');
    expect(snip).not.toContain('](');
  });

  it('an UNLABELLED wiki-link renders as its target, and that is what gets marked', () => {
    const snip = backlinkSnippet('This entry mentions [[../specs/TARGET_SPEC.mdx]] once.', SPEC, FROM);
    expect(snip).toContain('mentions <mark>../specs/TARGET_SPEC.mdx</mark> once');
    expect(snip).not.toContain('[[');
  });

  it('other links in the same sentence are reduced too, not just the matched one', () => {
    const snip = backlinkSnippet(
      'See [the other one](../specs/OTHER.mdx) and then [the target spec](../specs/TARGET_SPEC.mdx).',
      SPEC,
      FROM,
    );
    expect(snip).toContain('See the other one and then <mark>the target spec</mark>');
  });
});
