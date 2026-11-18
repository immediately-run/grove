// R3-1350 — frontmatter values as display text, and the component every title and
// description renders through.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { parseFrontmatter } from './frontmatter';
import { displayText, textList, visibleTags } from './displayText';
import InlineProse from '../components/InlineProse';

describe('displayText', () => {
  it('passes strings through and shows finite numbers and booleans', () => {
    expect(displayText('A title')).toBe('A title');
    expect(displayText(1984)).toBe('1984');
    expect(displayText(true)).toBe('true');
    expect(displayText(0)).toBe('0');
  });

  it('is not text for lists, maps, null, undefined or a non-finite number', () => {
    for (const v of [[1], { a: 1 }, null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(displayText(v)).toBeUndefined();
    }
  });

  it('shows the value, not the author\'s spelling — input from the real parser', () => {
    // YAML 1.2 reads these as numbers; the source spelling is not recoverable from the value.
    const { data } = parseFrontmatter('---\ntitle: 1.10\nid: 0x10\n---\n');
    expect(displayText(data.title)).toBe('1.1');
    expect(displayText(data.id)).toBe('16');
  });
});

describe('textList and visibleTags', () => {
  it('keep scalar items as text, skip the rest, and drop ui/ wiring tags', () => {
    const { data } = parseFrontmatter('---\ntags: [2026, notes, true, ui/nav, {a: 1}]\n---\n');
    expect(textList(data.tags)).toEqual(['2026', 'notes', 'true', 'ui/nav']);
    expect(visibleTags(data)).toEqual(['2026', 'notes', 'true']);
    expect(visibleTags({ tags: 'not-a-list' })).toEqual([]);
    expect(visibleTags(null)).toEqual([]);
  });
});

describe('InlineProse takes a typed frontmatter value', () => {
  it('renders a numeric title instead of throwing (parseInlineProse wants a string)', () => {
    const { data } = parseFrontmatter('---\ntitle: 1984\n---\n');
    expect(renderToStaticMarkup(createElement(InlineProse, { text: data.title }))).toBe('1984');
    expect(renderToStaticMarkup(createElement(InlineProse, { text: 'Ends here.', trimPeriod: true }))).toBe('Ends here');
    expect(renderToStaticMarkup(createElement(InlineProse, { text: undefined }))).toBe('');
  });
});
