// R3-531 — the parity assertion: `parseInlineProse` agrees with the SDK safe
// renderer's actual micromark path on the supported subset.
//
// The canon test lives in mdx-plugins; this one runs the SAME fixture through
// `parseSafeMdast` (the real producer — the same published bytes the sandbox
// resolves, inlined into these tests for exactly that reason) and asserts the
// first paragraph's inline children, normalised into `InlineProseNode`s, equal
// what the canon parses. Agreement by parallel implementation is a promise;
// this is the mechanism.
import { describe, expect, it } from 'vitest';
import { parseSafeMdast, type SafeMdastNode } from '@immediately-run/sdk';
import { INLINE_PROSE_FIXTURE, parseInlineProse, type InlineProseNode } from '@immediately-run/mdx-plugins';

// mdast inline vocabulary → InlineProseNode. Only the supported subset maps;
// anything else (a link, raw html) the fixture never produces, and a node of
// that shape failing the deep-equal is the drift alarm firing.
function toInlineProse(nodes: SafeMdastNode[]): InlineProseNode[] {
  return nodes.map((n): InlineProseNode => {
    switch (n.type) {
      case 'text':
        return { type: 'text', value: n.value ?? '' };
      case 'inlineCode':
        return { type: 'code', value: n.value ?? '' };
      case 'strong':
        return { type: 'strong', children: toInlineProse(n.children ?? []) };
      case 'emphasis':
        return { type: 'emphasis', children: toInlineProse(n.children ?? []) };
      default:
        throw new Error(`unexpected mdast node in a fixture paragraph: ${n.type}`);
    }
  });
}

describe('parseInlineProse matches the safe renderer on the supported subset', () => {
  for (const c of INLINE_PROSE_FIXTURE) {
    it(`agrees with parseSafeMdast: ${JSON.stringify(c.text).slice(0, 48)}`, async () => {
      const tree = await parseSafeMdast(`\n${c.text}\n`);
      const paragraph = tree.children?.find((n) => n.type === 'paragraph');
      if (!paragraph) {
        // The one case micromark renders as NO paragraph — an empty field —
        // and the canon agrees by returning no nodes at all.
        expect(c.tokens).toEqual([]);
        expect(parseInlineProse(c.text)).toEqual([]);
        return;
      }
      expect(toInlineProse(paragraph.children ?? [])).toEqual(c.tokens);
      // And the canon here in grove's own dependency graph — the version this
      // repo actually ships — produces the same shape the fixture pins.
      expect(parseInlineProse(c.text)).toEqual(c.tokens);
    });
  }
});
