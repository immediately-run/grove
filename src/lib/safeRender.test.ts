import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseSafeMdast } from '@immediately-run/sdk/safeContent/index';

// The NON-EXECUTABLE surface, proven rather than asserted (R3-217 / R3-219 exit).
//
// **This sweep is deliberately independent of how the app renders (R3-252).** The wiki
// itself left interpreter mode — `render: safe` is gone from `content/home.mdx` and
// entries go through the compiled `<Include>` path, because the corpus and the app ship
// from the same repo under the same author identity, so there is no origin boundary here
// for the safe renderer to defend (`TRUST_MODES §5`: interpreter-vs-executor is a design
// choice, not a capability gate). What the safe renderer *does* need is a large, real,
// multi-author corpus to be exercised against, and that is what this file is: the SDK's
// regression harness, run on every `npm run verify`, keeping the platform's signal after
// the app stopped depending on it — and keeping the flip reversible by one frontmatter
// line. Do not delete these because "the wiki doesn't render this way any more."
//
// These cases drive the REAL published safe renderer — the same
// `@immediately-run/sdk` build the sandbox resolves on immediately.run, because the
// host resolves the app's *pinned* dependency — over the REAL generated corpus. They
// establish two things the wiki's safety claim rests on:
//
//   1. author JavaScript in an entry never executes and never reaches the DOM as
//      markup (TRUST_MODES §5.1), and
//   2. a `§`-citation deep-link lands on a heading id that actually exists.
//
// What they deliberately do NOT prove is the browser half: that the resolved fragment
// *scrolls*. That is `scrollToId` in the host, and it needs a real page — the
// on-host verification the item calls for. Everything upstream of it is checked here,
// so an on-host failure can only be the scroll, never the renderer or the ids.

const CONTENT = join(process.cwd(), 'content');

function read(rel: string): string {
  return readFileSync(join(CONTENT, rel), 'utf8').replace(/^---\n[\s\S]*?\n---\n?/, '');
}

// Parsing ~350 entries takes seconds, and two cases need the same trees, so the sweep
// runs once and both await it.
const CORPUS_TIMEOUT = 60_000;

/** Every content entry in the wiki — generated and hand-authored alike. Walked rather
 *  than listed, so a corpus that grows (specs, context, status) is covered without
 *  anyone remembering to extend this test. */
function allEntries(dir = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(CONTENT, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...allEntries(rel));
    else if (e.name.endsWith('.mdx') && !e.name.startsWith('_')) out.push(rel);
  }
  return out.sort();
}

/** Every node of a type, anywhere in the tree. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodesOfType(tree: any, type: string): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === type) out.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  walk(tree);
  return out;
}

/** As {@link textOf}, but skipping `code`/`inlineCode` — the text a READER sees as prose.
 *  A `[[…]]` inside a fence is a documented example and must survive; one in prose is a
 *  citation the wiki-link plugin failed to consume. The two need different assertions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOfExcludingCode(tree: any): string {
  let s = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'code' || n.type === 'inlineCode') return;
    if (typeof n.value === 'string') s += n.value;
    for (const c of n.children ?? []) walk(c);
  };
  walk(tree);
  return s;
}

/** Flatten every literal string the tree would render as text. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOf(tree: any): string {
  let s = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (typeof n.value === 'string') s += n.value;
    for (const c of n.children ?? []) walk(c);
  };
  walk(tree);
  return s;
}

describe('non-executable surface — planted code is inert', () => {
  it('a `{fetch()}` expression is literal text, not an evaluated expression', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const tree = await parseSafeMdast('Before {fetch("/x")} after.\n');
    // No expression node exists at all: the mdx *expression* extension is off, so the
    // braces never even become a syntactic expression — they stay characters.
    expect(nodesOfType(tree, 'mdxFlowExpression')).toHaveLength(0);
    expect(nodesOfType(tree, 'mdxTextExpression')).toHaveLength(0);
    expect(textOf(tree)).toContain('{fetch("/x")}');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a `<script>` block survives as literal text, never as markup', async () => {
    const tree = await parseSafeMdast('<script>globalThis.__pwned = 1</script>\n');
    // Raw HTML is an `html` node, which renderMdast emits as a text Fragment — there is
    // no rehype-raw and no dangerouslySetInnerHTML anywhere on this path.
    const html = nodesOfType(tree, 'html');
    expect(html.length).toBeGreaterThan(0);
    expect(html.map((n) => n.value).join('')).toContain('<script>');
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it('an import/export line does not become an ESM node', async () => {
    const tree = await parseSafeMdast('import evil from "./evil.js"\n\nexport const x = 1\n');
    expect(nodesOfType(tree, 'mdxjsEsm')).toHaveLength(0);
  });

  it('an unknown component collapses to its children (no arbitrary element)', async () => {
    const tree = await parseSafeMdast('<Danger onClick="steal()">visible</Danger>\n');
    const el = nodesOfType(tree, 'mdxJsxFlowElement').concat(nodesOfType(tree, 'mdxJsxTextElement'));
    expect(el.length).toBeGreaterThan(0);
    // The NAME is all the renderer uses — it looks the name up in the component map and
    // renders the children when it finds nothing. The `onClick` attribute is a literal
    // string on an mdast node that is never applied to a DOM element.
    expect(textOf(tree)).toContain('visible');
  });

  it('holds over the real corpus: every entry parses, and none carries an executable node', async () => {
    const files = allEntries();
    // Non-vacuity guard, sized to THIS repo's sample corpus. The `docs` wiki runs the
    // same sweep over ~350 entries and keeps that guard at >280 (R3-252: a large, real,
    // multi-author corpus is the platform's regression signal, and it stays there). Here
    // the sweep proves the property holds over whatever the engine ships as its example
    // content — a smaller claim, honestly sized, not the same claim with the bar lowered.
    expect(files.length).toBeGreaterThan(10);
    // Collected rather than asserted per file: MDX throws on the FIRST malformed entry,
    // and a failure that names one file at a time turns a corpus sweep into N runs.
    const failures: string[] = [];
    for (const rel of files) {
      try {
        const tree = await parseSafeMdast(read(rel));
        for (const t of ['mdxFlowExpression', 'mdxTextExpression', 'mdxjsEsm']) {
          if (nodesOfType(tree, t).length) failures.push(`${rel}: executable ${t}`);
        }
      } catch (e) {
        // A parse error is not cosmetic — the entry renders nothing at all.
        failures.push(`${rel}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  }, CORPUS_TIMEOUT);
});

describe('deep-linking — the ids a citation targets really exist', () => {
  it('the renderer emits `sec-…` ids for numbered headings', async () => {
    const tree = await parseSafeMdast('## 8.9 Powerbox\n\nbody\n\n## Decisions\n');
    const ids = nodesOfType(tree, 'heading').map((h) => h.data?.hProperties?.id);
    expect(ids).toContain('sec-8-9');
    expect(ids).toContain('decisions');
  });

  it('a numbered heading also keeps its prose slug as a landing hook', async () => {
    const tree = await parseSafeMdast('## 8.9 Powerbox\n');
    const h = nodesOfType(tree, 'heading')[0];
    expect(h.data.hProperties.id).toBe('sec-8-9');
    expect(h.data.hProperties['data-slug']).toBe('89-powerbox');
  });

  it('`[[target#frag]]` becomes a WikiLink carrying the whole target', async () => {
    const tree = await parseSafeMdast('See [[../roadmap/R3-217.mdx#sec-1]].\n');
    const links = nodesOfType(tree, 'mdxJsxTextElement').filter((n) => n.name === 'WikiLink');
    expect(links).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = links[0].attributes.find((a: any) => a.name === 'target')?.value;
    expect(target).toBe('../roadmap/R3-217.mdx#sec-1');
  });

  it('a corpus entry`s `[[…]]` citations all become WikiLink nodes — none survive as text', async () => {
    // R3-252 recorded that `[[…]]` rendered as inert TEXT because the app passes no
    // `resolveWikiLink`. That read the wrong path: `renderMdast`'s `splitWikiLinks`
    // fallback only ever sees `[[…]]` that reach it AS TEXT, and `parseSafeMdast` runs
    // the shared wiki-link remark plugin first — so they are already `WikiLink` JSX
    // nodes, resolved from the component map. Measured here rather than argued, so the
    // claim cannot be re-litigated from reading alone.
    //
    // FIXTURE rather than a corpus read (R3-262): the `docs` wiki runs this against a
    // real citation-dense entry (`context/ways_of_working.mdx`, 10 WikiLink nodes) and
    // keeps doing so. This engine's sample corpus writes no `[[…]]` at all, so a corpus
    // read here would assert nothing — and an assertion that cannot fail is worse than
    // no assertion. The fixture is citation-dense on purpose and includes a fenced
    // literal, so the "strip code first" rule below is exercised, not merely stated.
    const src = [
      'Read [[home.mdx]] first, then [[handbook/onboarding.mdx]] and',
      '[[people/index.mdx#sec-2]] — and see [[the directory|directory.mdx]] for the rest.',
      'Also [[teams/index.mdx]], [[processes/index.mdx]] and [[reports/index.mdx#sec-1]].',
      '',
      'A documented example is not a live citation:',
      '',
      '```md',
      '[[some/target.mdx]]',
      '```',
      '',
      'Inline too: `[[not-a-citation.mdx]]`.',
    ].join('\n');
    const tree = await parseSafeMdast(src);
    const wikiLinks = nodesOfType(tree, 'mdxJsxTextElement').filter((n) => n.name === 'WikiLink');
    expect(wikiLinks.length).toBeGreaterThan(5);
    // Every one carries the author's target verbatim.
    for (const n of wikiLinks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(n.attributes.find((a: any) => a.name === 'target')?.value).toBeTruthy();
    }
    // Nothing is left as raw `[[` outside code — a `[[` surviving in prose is a citation
    // the plugin failed to consume, the exact failure R3-252 claimed was happening
    // everywhere. Code is excluded because the renderer emits `inlineCode`/`code` values
    // into the same walk and a DOCUMENTED example must survive verbatim; asserting both
    // halves here is stronger than the corpus version, which only ever saw the first.
    expect(textOfExcludingCode(tree)).not.toContain('[[');
    expect(textOf(tree)).toContain('[[some/target.mdx]]');
    expect(textOf(tree)).toContain('[[not-a-citation.mdx]]');
  }, CORPUS_TIMEOUT);

  it('every deep-link in the corpus resolves to a heading the renderer emits', async () => {
    // The check runs against the ids the SHIPPED renderer actually produces, closing the
    // gap between "the author believes the anchor exists" and "the anchor exists".
    //
    // R3-262: this engine's sample corpus writes no `[[…#frag]]` citations, so the sweep
    // has nothing to check and its `checked > 0` guard would FAIL — correctly, because a
    // green sweep over zero deep-links proves nothing. Rather than delete the guard (which
    // would leave a permanently vacuous test) or delete the case (which would drop the
    // property), the sweep runs over the corpus PLUS a fixture entry that does carry
    // citations, so the machinery is exercised here and the corpus is still covered the
    // moment it grows one. The `docs` wiki runs the same case over ~1000 real citations.
    const FIXTURE = '__deep-link-fixture__.mdx';
    const FIXTURE_SRC = [
      '## 1. First',
      'See [[#sec-2]] and [[home.mdx]].',
      '',
      '## 2. Second',
      'Back to [[#sec-1]].',
    ].join('\n');
    const files = allEntries();
    const idsByPath = new Map<string, Set<string>>();
    const sourceByPath = new Map<string, string>();
    for (const rel of [...files, FIXTURE]) {
      const src = rel === FIXTURE ? FIXTURE_SRC : read(rel);
      sourceByPath.set(rel, src);
      const tree = await parseSafeMdast(src);
      const ids = new Set<string>();
      for (const h of nodesOfType(tree, 'heading')) {
        const hp = h.data?.hProperties ?? {};
        if (hp.id) ids.add(hp.id);
        if (hp['data-slug']) ids.add(hp['data-slug']);
      }
      idsByPath.set(rel, ids);
    }

    const normalize = (from: string, target: string) => {
      const parts = from.split('/').slice(0, -1).concat(target.split('/'));
      const out: string[] = [];
      for (const seg of parts) {
        if (seg === '' || seg === '.') continue;
        if (seg === '..') out.pop();
        else out.push(seg);
      }
      return out.join('/');
    };

    const dangling: string[] = [];
    let checked = 0;
    for (const [rel, src] of sourceByPath) {
      const scrubbed = src.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
      for (const m of scrubbed.matchAll(/\[\[(?:[^\]|]*\|)?([^\]#|]*)#([^\]]+)\]\]/g)) {
        const path = m[1] === '' ? rel : normalize(rel, m[1]);
        const ids = idsByPath.get(path);
        if (!ids) continue; // outside the generated set — not this test's corpus
        checked++;
        if (!ids.has(m[2])) dangling.push(`${rel} → ${path}#${m[2]}`);
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(dangling).toEqual([]);
  }, CORPUS_TIMEOUT);
});
