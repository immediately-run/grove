import { describe, it, expect } from 'vitest';
import { hrefKeyCandidates, keyToHref, linkKind, splitFragment } from './content';

// `hrefKeyCandidates` is the runtime half of the corpus's link contract: an author writes
// links RELATIVE to the entry they sit in, and `scripts/lib/wiki.mjs` `contentResolve`
// (which `check-docs-wiki` audits `[[…]]` links by) resolves them that way. Before this,
// `<WikiLink>` only recognised absolute `/content/…` hrefs, so every relative markdown link
// fell through to a plain `<a>`; clicking one made the sandboxed iframe attempt a real
// navigation and the app died with "Failed to construct 'URL': Invalid URL". These cases
// are taken from the corpus as it actually is.

const HOME = '/app/content/home.mdx';

describe('hrefKeyCandidates — relative hrefs resolve against the current entry', () => {
  it('resolves the home page links that crashed the app', () => {
    // content/home.mdx line 31 — the reported bug.
    expect(hrefKeyCandidates('roadmap/index.mdx', HOME)).toEqual(['/app/content/roadmap/index.mdx']);
    expect(hrefKeyCandidates('specs/index.mdx', HOME)).toEqual(['/app/content/specs/index.mdx']);
    expect(hrefKeyCandidates('roadmap/archive/index.mdx', HOME)).toEqual([
      '/app/content/roadmap/archive/index.mdx',
    ]);
  });

  it('resolves sibling links inside a subdirectory', () => {
    // context/ways_of_working.mdx -> product_definition.md
    expect(hrefKeyCandidates('product_definition.md', '/app/content/context/ways_of_working.mdx')[0]).toBe(
      '/app/content/context/product_definition.md'
    );
  });

  it('walks ../ hops', () => {
    expect(hrefKeyCandidates('../specs/PERSISTENCE_SPEC.mdx', '/app/content/roadmap/R3-1.mdx')).toEqual([
      '/app/content/specs/PERSISTENCE_SPEC.mdx',
    ]);
    expect(
      hrefKeyCandidates('../../context/ways_of_working.mdx', '/app/content/roadmap/archive/R3-1.mdx')
    ).toEqual(['/app/content/context/ways_of_working.mdx']);
  });

  it('still accepts the absolute forms it always did', () => {
    expect(hrefKeyCandidates('/content/roadmap/index.mdx', HOME)).toEqual([
      '/app/content/roadmap/index.mdx',
    ]);
    expect(hrefKeyCandidates('/files/content/roadmap/index.mdx', HOME)).toEqual([
      '/app/content/roadmap/index.mdx',
    ]);
  });
});

describe('hrefKeyCandidates — the .md/.mdx split the cutover left behind', () => {
  it('offers the .mdx variant second, so a pre-cutover .md target still resolves', () => {
    // ~460 corpus links name `foo.md` whose entry is now `foo.mdx`.
    expect(hrefKeyCandidates('product_values.md', '/app/content/context/product_definition.mdx')).toEqual([
      '/app/content/context/product_values.md',
      '/app/content/context/product_values.mdx',
    ]);
  });

  it('offers the literal first, so the genuine GROVE.md entry is not rewritten away', () => {
    // content/GROVE.md really is a .md file; a blanket .md->.mdx rewrite would break it.
    const c = hrefKeyCandidates('GROVE.md', HOME);
    expect(c[0]).toBe('/app/content/GROVE.md');
    expect(c).toContain('/app/content/GROVE.mdx');
  });

  it('does not invent a variant for an .mdx target', () => {
    expect(hrefKeyCandidates('roadmap/index.mdx', HOME)).toHaveLength(1);
  });
});

describe('hrefKeyCandidates — what is deliberately NOT a content link', () => {
  it('ignores external, mail and anchor hrefs', () => {
    for (const h of ['https://github.com/x/y', 'http://example.com', 'mailto:a@b.c', 'tel:+1', '#sec-8-9']) {
      expect(hrefKeyCandidates(h, HOME)).toEqual([]);
    }
  });

  it('ignores non-entry targets (scripts, directories, retired trees)', () => {
    // Real corpus cases that must stay ordinary <a>, not wiki-links.
    expect(hrefKeyCandidates('../snippets/dualRead.mjs', '/app/content/context/x.mdx')).toEqual([]);
    expect(hrefKeyCandidates('../specs/', '/app/content/context/x.mdx')).toEqual([]);
    expect(hrefKeyCandidates('', HOME)).toEqual([]);
  });

  it('never escapes the content tree', () => {
    // A traversal that climbs out resolves to something outside /app/content and so is
    // not an entry key — it must not become a link into the app.
    expect(hrefKeyCandidates('../../../../etc/passwd', HOME)).toEqual([]);
  });
});

describe('fragments are carried, not resolved', () => {
  it('splits on the first # only', () => {
    expect(splitFragment('FOO.mdx#sec-8-9')).toEqual(['FOO.mdx', '#sec-8-9']);
    expect(splitFragment('FOO.mdx')).toEqual(['FOO.mdx', '']);
    expect(splitFragment('#sec-3')).toEqual(['', '#sec-3']);
  });

  it('resolves the path part while the fragment rides along', () => {
    expect(hrefKeyCandidates('../specs/FOO.mdx#sec-8-9', '/app/content/roadmap/R3-1.mdx')).toEqual([
      '/app/content/specs/FOO.mdx',
    ]);
    // What <WikiLink> hands <Link>: an absolute content path, never the author's text.
    const [key] = hrefKeyCandidates('roadmap/index.mdx', HOME);
    expect(keyToHref(key) + splitFragment('roadmap/index.mdx#sec-2')[1]).toBe(
      '/content/roadmap/index.mdx#sec-2'
    );
  });
});

describe('linkKind — which hrefs may become a navigating <a>', () => {
  // The R3-252 crash was a bare `<a href="roadmap/index.mdx">`: clicking it made the
  // sandboxed frame perform a real navigation out of the app. Only an href that MEANS to
  // leave the document may be an anchor; everything else is in-app and must be routed or
  // shown broken.
  it('absolute schemes are external', () => {
    expect(linkKind('https://immediately.run')).toBe('external');
    expect(linkKind('http://x.dev/a')).toBe('external');
    expect(linkKind('mailto:a@b.c')).toBe('external');
    expect(linkKind('tel:+123')).toBe('external');
    expect(linkKind('HTTPS://X.DEV')).toBe('external'); // scheme is case-insensitive
  });

  it('a bare fragment is a same-document anchor', () => {
    expect(linkKind('#sec-8-9')).toBe('anchor');
  });

  it('every other shape is in-app content — including the ones that used to crash', () => {
    expect(linkKind('roadmap/index.mdx')).toBe('content'); // the reported click
    expect(linkKind('../specs/FOO.mdx#sec-3')).toBe('content');
    expect(linkKind('/content/home.mdx')).toBe('content');
    expect(linkKind('../scripts/check-rename-transition.mjs')).toBe('content'); // not an entry
    expect(linkKind('.claude/memory/x.md')).toBe('content');
    expect(linkKind('')).toBe('content'); // an empty href is broken, not external
  });

  it('a scheme-like word in a path does not make it external', () => {
    expect(linkKind('plans/https-migration.mdx')).toBe('content');
  });
});
