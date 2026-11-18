// R3-531 — the one component that renders a frontmatter prose field: a
// `title`/`description`/`scope` parsed by `@immediately-run/mdx-plugins`'s
// `parseInlineProse` into `code`/`strong`/`em` and text. Every list row, card,
// header, search hit and sidebar label renders its metadata field through this,
// so a backtick in the corpus prints as a code span and never as body-font
// punctuation. The docs fork copies this file VERBATIM (its convention for
// engine components) — which is why it imports nothing grove-local.
//
// Links, images, HTML and JSX are not inline prose and never will be: a title
// is not a body. Fields that become attributes, labels or prompt strings use
// the parser's `plainProse` directly instead of this component.

import { Fragment } from 'react';
import { parseInlineProse, type InlineProseNode } from '@immediately-run/mdx-plugins';
import { displayText } from '../lib/displayText';

function renderNodes(nodes: InlineProseNode[]): React.ReactNode[] {
  return nodes.map((n, i) => {
    if (n.type === 'code') return <code key={i}>{n.value}</code>;
    if (n.type === 'strong') return <strong key={i}>{renderNodes(n.children)}</strong>;
    if (n.type === 'emphasis') return <em key={i}>{renderNodes(n.children)}</em>;
    return <Fragment key={i}>{n.value}</Fragment>;
  });
}

export default function InlineProse({
  text,
  trimPeriod = false,
}: {
  /** A frontmatter value: typed since mdx-plugins 0.8.0 (`title: 1984` is a number), so
   *  it is turned into display text here, once, for every caller (R3-1350). */
  text: unknown;
  /** Trim one trailing period, as the list components always have. */
  trimPeriod?: boolean;
}) {
  const str = displayText(text) ?? '';
  // Trim before parsing: the corpus ends titles on a period, and the period
  // sits OUTSIDE any code span, so a raw-string slice is the whole job.
  const src = trimPeriod && str.endsWith('.') ? str.slice(0, -1) : str;
  return <Fragment>{renderNodes(parseInlineProse(src))}</Fragment>;
}
