// The layout-starter sweep (R3-309, bucket A's gate) — PURE analysis over a starter's
// source and its rendered markup, so the same checker drives the real starters from
// disk AND fault-injected fixtures in the test.
//
// WHY A GATE AT ALL. A starter is a file people COPY, which makes it teaching
// material: whatever it does, corpora will do. The safe renderer fails QUIETLY in
// four ways (ENGINE_BOUNDARY §6 / 03-layout-catalogue §3) — expression props
// dropped, unregistered tags collapsed to their children, `import` lines rendered
// as visible prose, mid-line block tags eaten as literal angle brackets — and a
// shipped starter that trips any of them teaches the failure with no error
// anywhere. Worse than no starter.
//
// The render itself is INJECTED (`render(body) → markup`) because the real one is
// the published safe renderer plus Grove's component map — exactly what
// SafeLayout sends a `_layout.mdx` through — and the test wires that up; keeping
// it out of this module keeps the analysis pure and runnable over strings.

/** Which marker substring an ALWAYS-RENDERING primitive must leave in the markup. A
 *  primitive whose marker is absent either collapsed (unregistered) or changed its
 *  root — both are drift a copy would inherit. Data-dependent components
 *  (`DocList`, `ChildPages`) are deliberately absent: with no corpus in the sweep
 *  they render nothing BY DESIGN, and their registration is checked through
 *  `knownTags` instead. */
export const STARTER_MARKERS: Record<string, string> = {
  GroveNav: 'grove-nav',
  GroveSidebar: 'grove-sidebar',
  GroveFooter: 'grove-footer',
};

/** Strip a leading frontmatter block — the render path never sees it (the sweep
 *  asserts the BODY a reader would get). */
export function stripStarterFrontmatter(src: string): string {
  return src.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

/** Every capitalized component tag a starter uses (`<GroveNav`, `<DocList`). */
export function componentTagsOf(body: string): string[] {
  return [...body.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1]!);
}

/** The text a reader sees, once every element is stripped away — what "visible
 *  prose" checks run over. Entities are decoded so an eaten tag shows up as '<'. */
export function visibleTextOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export interface StarterSweepDeps {
  /** Render a starter BODY through the real safe renderer + component map. Async:
   *  the real parser is. */
  render: (body: string) => string | Promise<string>;
  /** The component names the map actually registers (off-vocabulary detection). */
  knownTags: ReadonlySet<string>;
}

/**
 * Sweep one starter. Returns one violation string per finding — empty means the
 * starter survives the interpreter.
 */
export async function starterViolations(
  source: string,
  deps: StarterSweepDeps,
): Promise<string[]> {
  const body = stripStarterFrontmatter(source);
  const markup = await deps.render(body);
  const text = visibleTextOf(markup);
  const out: string[] = [];

  // (3) an unresolved import renders as visible prose — a copy would teach it.
  if (/^\s*(import|export)\s/m.test(text)) out.push('an import/export line renders as visible prose');

  // (4) a block tag that does not open on its own line is eaten by micromark and
  // shows up as literal angle brackets. Starters carry no raw HTML, so ANY '<' in
  // the visible text is this failure.
  if (text.includes('<')) out.push(`literal angle brackets in the visible text (${JSON.stringify(text.match(/.{0,24}<.{0,24}/)?.[0])})`);

  // Starters are structural: braces belong to no tag we document, and under the
  // interpreter they stay characters — a `{/* comment */}` renders as prose.
  if (text.includes('{') || text.includes('}')) {
    out.push('braces render as visible text (an expression or JSX comment the interpreter does not consume)');
  }

  for (const tag of componentTagsOf(body)) {
    if (!deps.knownTags.has(tag)) {
      out.push(`<${tag}> is not in the component map — under the interpreter it collapses to its children`);
      continue;
    }
    const marker = STARTER_MARKERS[tag];
    if (marker && !markup.includes(marker)) {
      out.push(`<${tag}> rendered without its "${marker}" marker — the wrapper collapsed or drifted`);
    }
  }
  return out;
}
