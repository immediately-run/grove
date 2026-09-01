// The bucket-C gate (R3-309): every documented collection call uses LITERAL
// attributes only. The interpreter copies `paginate="infinite"` verbatim but
// drops `paginate={mode}` SILENTLY — the list renders whole with nothing saying
// why, which is the one failure a corpus author cannot diagnose from inside.
//
// The scanner is pure over strings (fault-injectable); the test drives it over
// every .mdx in content/ — the starters and the sample corpus alike — because a
// shipped example with an expression prop is a lesson in the failure.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** The components whose calls select collection shapes (the manifest's
 *  `collections` section rides on these). */
export const COLLECTION_COMPONENTS = ['DocList', 'Timeline', 'ChildPages', 'DocsByTag'] as const;

/** Every attribute written as an expression (`attr={…}`) on a collection call.
 *  MDX attribute syntax only; braces inside fenced code are never calls. */
export function expressionPropsOf(source: string): string[] {
  const out: string[] = [];
  const tagRe = new RegExp(`<(${COLLECTION_COMPONENTS.join('|')})[\\s>]`, 'g');
  for (const m of source.matchAll(tagRe)) {
    // The tag's span: from the match to the closing `/>` or the matching `>`.
    const start = m.index!;
    const end = source.indexOf('/>', start);
    const end2 = source.indexOf('>', start);
    const stop = end === -1 ? end2 : Math.min(end, end2);
    if (stop === -1) continue;
    const tagText = source.slice(start, stop);
    for (const a of tagText.matchAll(/(\w+)\s*=\s*\{/g)) out.push(`${m[1]}.${a[1]}`);
  }
  return out;
}

function allMdx(dir = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(process.cwd(), 'content', dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...allMdx(rel));
    else if (e.name.endsWith('.mdx')) out.push(rel);
  }
  return out.sort();
}

describe('collection calls keep their attributes literal (R3-309 bucket C)', () => {
  it('the scanner finds the corpus (checked > 0), starters included', () => {
    const files = allMdx();
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.startsWith('_layouts/'))).toBe(true);
  });

  it('no expression prop on any collection call in content/', () => {
    const offenders: string[] = [];
    for (const f of allMdx()) {
      const bad = expressionPropsOf(readFileSync(join(process.cwd(), 'content', f), 'utf8'));
      for (const b of bad) offenders.push(`${f}: ${b}`);
    }
    expect(offenders).toEqual([]);
  });

  it('fault injection: a planted expression prop IS caught', () => {
    // `paginate="infinite"` is copied verbatim; `paginate={mode}` is dropped
    // silently. The gate exists for exactly this shape.
    expect(expressionPropsOf('<DocList shape="grid" paginate={mode} />')).toEqual(['DocList.paginate']);
    expect(expressionPropsOf('<Timeline limit={n}>x</Timeline>')).toEqual(['Timeline.limit']);
    // Literals — including string numerals — pass.
    expect(expressionPropsOf('<DocList shape="grid" limit="4" sort="date" />')).toEqual([]);
  });
});
