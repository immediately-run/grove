// R3-1350 — every page Grove ships must have frontmatter the host can parse.
//
// The host's metadata scan drops a block it cannot parse and only logs it, so a broken
// block renders as a page with no title, nav or layout role, and nothing in this repo
// said so: `content/_layouts/{hero,section,shell}.mdx` each carried an unquoted `key: value`
// mid-line (`nav: top`, `cover: lands`, `frame: none` — a YAML error) until grove e017647,
// while every check here passed. The parser
// below is the one the host calls (R3-1347/R3-1348), via Grove's own re-export.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from './frontmatter';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Every `.mdx`/`.md` under a directory — entries AND the `_`-prefixed structural files. */
function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : pages(p);
    return /\.mdx?$/.test(name) ? [p] : [];
  });
}

describe('the shipped corpus frontmatter parses', () => {
  const files = ['content', 'examples'].flatMap((d) => pages(join(ROOT, d)));

  it('walks the real trees, the layout starters included', () => {
    const rel = files.map((f) => relative(ROOT, f));
    expect(rel).toContain('content/_layouts/hero.mdx');
    expect(rel.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [relative(ROOT, f), f]))('%s', (_name, file) => {
    const { error } = parseFrontmatter(readFileSync(file, 'utf8'));
    // Same shape as the docs checker's message: where, what, and the kind.
    const at = error ? `line ${error.line ?? '?'}, column ${error.column ?? '?'}: ${error.message} (${error.kind})` : '';
    expect(at).toBe('');
  });
});
