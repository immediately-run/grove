import { describe, it, expect } from 'vitest';
import { hrefKeyCandidates, hrefTargetKey, keyToHref, linkKind, splitFragment } from './content';

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

// R3-268 under dispatch — the viewed-document declaration's PATH SPACE. The regression:
// `keyToRepoRel` only knows the fork's `/app/` anchor, so a dispatched key leaked its
// sandbox mount path (`mnt/<hash>/themes.mdx`) into the declaration; the host's existence
// check (against the corpus repo's real `/content/themes.mdx`) missed, and the explorer
// highlight silently degraded to none. The contract now: fork declares REPO-relative,
// dispatch declares CORPUS-relative (the host joins its chroot prefix — the corpus's
// repo-side location is host knowledge this app cannot see).
import { viewedDocumentForTarget } from './content';
import { setContentRoot, resetContentRoot } from './contentRoot';
import { afterEach } from 'vitest';

describe('viewedDocumentForTarget — the R3-268 declaration path space', () => {
  afterEach(resetContentRoot);

  const HOST = 'https://immediately.run/edit/github/ns/repo/main';

  it('fork: an entry target declares the REPO-relative path (the /app anchor strips)', () => {
    // Fork URL keys are REPO-relative (`files/content/…`) — the engine repo is the tree.
    expect(viewedDocumentForTarget(`${HOST}/files/content/themes.mdx`)).toBe('content/themes.mdx');
    expect(viewedDocumentForTarget(`${HOST}/files/content/plot/index.mdx`)).toBe('content/plot/index.mdx');
  });

  it('dispatch: an entry target declares the CORPUS-relative path — never the mount path', () => {
    setContentRoot('/mnt/0a1b2c3d');
    expect(viewedDocumentForTarget(`${HOST}/files/themes.mdx`)).toBe('themes.mdx');
    expect(viewedDocumentForTarget(`${HOST}/files/plot/index.mdx`)).toBe('plot/index.mdx');
    // The regression shape: the mount path must not leak into the declaration.
    expect(viewedDocumentForTarget(`${HOST}/files/themes.mdx`)).not.toMatch(/^mnt\//);
  });

  it('the wiki root declares the HOME entry (the root route renders home.mdx)', () => {
    expect(viewedDocumentForTarget(`${HOST}/files/`)).toBe('content/home.mdx');
    setContentRoot('/mnt/0a1b2c3d');
    expect(viewedDocumentForTarget(`${HOST}/files/`)).toBe('home.mdx');
  });

  it('a non-entry target (not .mdx) declares null, in both packagings', () => {
    expect(viewedDocumentForTarget(`${HOST}/files/content/llms.txt`)).toBeNull();
    setContentRoot('/mnt/0a1b2c3d');
    expect(viewedDocumentForTarget(`${HOST}/files/llms.txt`)).toBeNull();
  });

  it('a traversal in the target degrades to HOME — an out-of-tree path never leaks', () => {
    // sandboxPathToKey resolves traversals BEFORE the containment check; anything
    // outside the corpus resolves to the home key, so the declaration is home, never
    // a `..`-bearing or out-of-corpus path.
    setContentRoot('/mnt/0a1b2c3d');
    const declared = viewedDocumentForTarget(`${HOST}/files/../../app/src/App.tsx`);
    expect(declared).toBe('home.mdx');
  });
});

// A folder is a destination since directory listings landed, so link resolution has to
// answer "which PATH?" as well as "which entry?" — `[the handbook](handbook)` names
// something real and must not render as a broken link.
describe('hrefTargetKey — resolution without the entry-file requirement', () => {
  it('resolves a folder href the entry-candidate list rejects', () => {
    expect(hrefKeyCandidates('handbook', HOME)).toEqual([]);
    expect(hrefTargetKey('handbook', HOME)).toBe('/app/content/handbook');
    expect(hrefTargetKey('../teams', '/app/content/handbook/onboarding.mdx')).toBe('/app/content/teams');
  });

  it('still resolves entries, identically to the candidate list', () => {
    expect(hrefTargetKey('roadmap/index.mdx', HOME)).toBe('/app/content/roadmap/index.mdx');
    expect(hrefTargetKey('/files/content/about.mdx', HOME)).toBe('/app/content/about.mdx');
  });

  it('denotes nothing for an external scheme, a bare anchor, or an escape', () => {
    expect(hrefTargetKey('https://example.com', HOME)).toBeNull();
    expect(hrefTargetKey('#sec-1', HOME)).toBeNull();
    expect(hrefTargetKey('', HOME)).toBeNull();
    // Confinement: the result flows into fs reads, and under dispatch the href is
    // foreign content. RELATIVE climbs out of the corpus still denote nothing.
    expect(hrefTargetKey('../../src/App.tsx', HOME)).toBeNull();
    // An ABSOLUTE traversal no longer escapes to null, it CLAMPS inside the corpus
    // (R3-273's closed-space rule, adopted by R3-277b — the corpus space is closed
    // under traversal; the old escape-to-null reading is superseded).
    expect(hrefTargetKey('/../../src/App.tsx', HOME)).toBe('/app/content/src/App.tsx');
    expect(hrefTargetKey('/../package.json', HOME)).toBe('/app/content/package.json'); // clamped INSIDE, not escaped
  });
});

// R3-277b — the link-resolution parity harness: grove's runtime resolution
// (`hrefTargetKey`) must agree with the SHARED fixture (and therefore with the
// SDK resolver and the docs checker, which assert against the same cases).
import { LINK_SPACE_FIXTURE } from '@immediately-run/mdx-plugins';

describe('link-space parity (LINK_SPACE_FIXTURE, R3-277b)', () => {
  // The corpus-rooted cases, run through grove's own resolution with the fork
  // packaging's root. The mount-absolute corpus of the fixture is '/app/content'
  // — exactly the fork's — so the corpus-space cases translate verbatim; the
  // fs-rooted/no-corpus case and the chroot collapse are resolver-level (the
  // checker + SDK suites own them) and are skipped by corpusRoot here.
  const FORK_ROOT = '/app/content';
  const contentCases = LINK_SPACE_FIXTURE.filter(
    (c) => c.corpusRoot === FORK_ROOT && !c.bundleChrooted && c.currentFile !== undefined,
  );

  it('the fixture still reaches this harness (non-vacuous)', () => {
    expect(contentCases.length).toBeGreaterThanOrEqual(7);
  });

  for (const c of contentCases) {
    it(`${c.raw} from ${c.currentFile ?? '<unknown>'} — ${c.why}`, () => {
      const got = hrefTargetKey(c.raw, c.currentFile ?? '/app/content/home.mdx');
      if (c.expect.state === 'resolved') {
        // grove confines default-space targets to the corpus; the fixture's one
        // escapes-corpus case ('../specs/A.mdx') therefore maps to null here —
        // an existence-denial, not a disagreement (the resolver case above
        // proved the path arithmetic; entry checks would reject it anyway).
        const insideCorpus = c.expect.path.startsWith(FORK_ROOT);
        expect(got).toBe(insideCorpus || c.raw.startsWith('$fs:') ? c.expect.path : null);
      } else {
        expect(got).toBe(null);
      }
    });
  }

  it('legacy repo-root absolute spellings are accepted inbound (R3-272 rule)', () => {
    expect(hrefTargetKey('/content/handbook/onboarding.mdx', '/app/content/home.mdx')).toBe(
      '/app/content/handbook/onboarding.mdx'
    );
    // canonical corpus-absolute still wins
    expect(hrefTargetKey('/handbook/onboarding.mdx', '/app/content/home.mdx')).toBe(
      '/app/content/handbook/onboarding.mdx'
    );
  });
});
