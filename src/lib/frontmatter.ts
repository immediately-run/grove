// Frontmatter parsing for the viewer-side corpus scan (R3-265).
//
// IMPORTED, not ported, since R3-277a. This file used to carry a documented port of
// the docs repo's `scripts/lib/wiki.mjs` parser — the one that has read the whole
// docs corpus for the generator and the conformance checker. The port was faithful,
// and that was the problem: the two agreed because someone kept them agreeing, and
// nothing would have reported the day that stopped. A viewer that parses frontmatter
// differently from the tooling that validates it renders a corpus the gate says is
// fine and the reader says is broken.
//
// The canon is `@immediately-run/mdx-plugins` — the package that already owns the
// slug grammar (R3-277), so a consumer gets both halves of the corpus contract from
// one place at one version.
//
// Why a parser at all, rather than the bundler's metadata: under DISPATCH the corpus
// is a mount, and the bundler only scans the app's own source. Nothing else has read
// these bytes.
//
// The re-export keeps every import site in this repo unchanged. `Frontmatter` is
// re-exported under its local name — the viewer's own code says `Frontmatter`, and
// renaming it across the repo would be churn for no reader's benefit.
export { parseFrontmatter } from '@immediately-run/mdx-plugins';
export type {
  FrontmatterValue,
  ParsedFrontmatter as Frontmatter,
} from '@immediately-run/mdx-plugins';
