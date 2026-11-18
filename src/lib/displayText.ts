// Frontmatter values as the text a reader shows (R3-1350).
//
// Frontmatter is YAML 1.2 on every path now: the host's metadata scan always was (the
// transpiler's `yaml`), and Grove's dispatch-mode scan is too since mdx-plugins 0.8.0
// (R3-1347). So `title: 1984` arrives as a number and `tags: [2026, notes]` holds one, and
// a reader that assumed strings either threw (`parseInlineProse(1984)`, `1984.startsWith`)
// or silently dropped the value. These helpers are the one place that turns a scalar into
// display text; every reader that shows a title, a label or a tag goes through them.
//
// The text is the VALUE's, not the author's spelling: `1.10` shows as `1.1` and `0x10` as
// `16`. Quote a value to keep its spelling.

/** A scalar frontmatter value as display text: a string as is, a finite number or a
 *  boolean as `String(v)`. Lists, maps, null and anything else are not text. */
export function displayText(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if ((typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean') return String(v);
  return undefined;
}

/** A frontmatter list as display texts; a non-list is empty, a non-scalar item is skipped. */
export function textList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(displayText).filter((t): t is string => t !== undefined) : [];
}

/** An entry's subject tags: its `tags` as text, without the `ui/…` wiring tags (nav
 *  placement), the filter every tag surface applies. */
export function visibleTags(meta: { tags?: unknown } | null | undefined): string[] {
  return textList(meta?.tags).filter((t) => !t.startsWith('ui/'));
}
