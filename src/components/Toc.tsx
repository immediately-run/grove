import TableOfContents from './TableOfContents';

// `<Toc/>` — the on-this-page rail, and the name every existing layout and entry uses.
//
// It is now an alias for `<TableOfContents/>`, which is the same list plus "keep the
// current entry in view". Kept as its own name rather than rewritten at the call sites
// because `Toc` is registered content vocabulary: a corpus may already say `<Toc/>`, and
// the engine's names are an interface (spec_style's §-number rule, applied to components).
//
// Deliberately NOT a second implementation. The two used to be one copy of the DOM scan
// each, which is precisely the drift ENGINE_BOUNDARY §4 was written about.
export default function Toc({ entryKey }: { entryKey?: string }) {
  return <TableOfContents entryKey={entryKey} />;
}
