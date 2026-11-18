// The safe-vs-compiled render decision, in ONE place (R3-872 review, round 1):
// interpreter mode is read from the HOME entry (wiki-wide) OR the current entry
// (per-entry), and the two answer different questions — wiki-wide is the
// interpreter declaration for foreign content; per-entry exists for the document
// that is only correct as data (R3-252's proof page). Three renderers decide on
// this — the layout chain's renderer pick, the entry body's pick, and the shell's
// `safe` field — and drift between them is a trust-boundary hole (an executing
// body inside a safe chain), never a style issue. Pure, so the rule is testable
// without a render.

/** The scan-row key that marks an entry whose frontmatter block the parser REJECTED
 *  (invalid YAML, not a map, a non-JSON value). Such a block yields no keys at all — so a
 *  `render: safe` in it is invisible — and the only safe reading of "this entry's
 *  declaration could not be read" is the non-executable one (R3-1350 review 1-A-1: under
 *  mdx-plugins 0.8.0 a home entry with one stray `key: a: b` line silently fell OPEN to
 *  compiled rendering). Written by `corpusScan`'s rows; a row the host's metadata scan
 *  produced never carries it (the host drops a rejected block's row instead — the fork
 *  path's half of this hole is a separate SEC item). */
export const FRONTMATTER_REJECTED = 'frontmatterRejected';

/** True when the entry renders through the non-executable interpreter path.
 *
 *  ONE-DIRECTIONAL (owner, 2026-11-18): the home entry's `render: safe` makes the whole wiki
 *  safe and no entry can turn it back to compiled; an entry may only opt ITSELF into safe
 *  within an otherwise compiled wiki. Hence an OR, and only the value `safe` counts. A
 *  rejected frontmatter block counts as `render: safe` for what it governs — the wiki for
 *  the home entry, that entry for any other — which moves in the safe direction only
 *  (fail closed). `renderMode.test.ts` pins all of it. */
export function resolveSafeRender(
  homeMeta: Record<string, unknown> | null | undefined,
  entryMeta: Record<string, unknown> | null | undefined,
): boolean {
  return (
    homeMeta?.render === 'safe' ||
    entryMeta?.render === 'safe' ||
    Boolean(homeMeta?.[FRONTMATTER_REJECTED]) ||
    Boolean(entryMeta?.[FRONTMATTER_REJECTED])
  );
}
