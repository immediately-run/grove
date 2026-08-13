import { createElement } from 'react';
import type { ComponentType, ReactNode } from 'react';

// The structural HTML tags a CONTENT file may use under the interpreter (safe) renderer,
// each wrapped so only allow-listed attributes reach the DOM. (R3-263)
//
// WHY WRAPPERS AND NOT RAW TAGS. `renderMdast` looks a JSX tag up in the component map by
// name and, on a hit, spreads the element's literal attributes onto it. The SDK's
// `literalProps` does **no name filtering and no URL sanitizing** — it copies every literal
// `mdxJsxAttribute` verbatim. So registering `main: 'main'` would hand a content author a
// direct channel to a real DOM element's props. Measured against React 19 before choosing
// this design:
//
//   <main onclick="alert(1)">      → React DROPS it (lowercase `on*` is never emitted)
//   <a href="javascript:alert(1)"> → React BLOCKS it (replaced with a throwing sentinel)
//   <img onerror="alert(1)">       → React DROPS it
//   <main style="color:red">       → **THROWS** — "style prop expects a mapping … not a string"
//   <main dangerouslySetInnerHTML="…"> → **THROWS** — cannot set with children
//   <iframe srcdoc="<script>…">    → **PASSES THROUGH** — a live XSS
//
// So React defends the two vectors people think of first and defends neither of the last
// two. The two throwing cases are not XSS but they are worse than they look: the throw is
// in the LAYOUT, so one content file takes down the entire shell for every page. And the
// `iframe` case is only absent here because `iframe` is not on the list — which is exactly
// the argument for a closed list rather than a filter people extend ad hoc.
//
// The rule, therefore: a closed set of purely structural tags, an allow-list of inert
// attributes, and no reliance on React's internal defenses as the only barrier.
//
// NOT REGISTERED, deliberately:
//   • `a` / `img` — already in the map as <WikiLink>/<AssetImage>, which resolve and
//     sanitize. Registering the raw tags would silently bypass both.
//   • `iframe`, `object`, `embed`, `script`, `style`, `link`, `meta`, `form`, `input`,
//     `button` — executable, navigational, or capable of carrying markup (`srcdoc`).
//   • `h1`–`h6` — a JSX heading skips the shared heading-anchor plugin, so it would carry
//     no `sec-…` id and no `data-slug`, and every citation to it would dangle. Author
//     headings as markdown (`## 8.9 …`) and the ids come for free.
const ALLOWED_TAGS = [
  'main', 'section', 'article', 'aside', 'nav', 'header', 'footer',
  'div', 'span', 'p', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'figure', 'figcaption', 'blockquote', 'strong', 'em', 'small', 'hr', 'br',
] as const;

/** Inert, presentational attributes. Anything not here — `style`, `on*`,
 *  `dangerouslySetInnerHTML`, `href`, `src`, `srcdoc` — is dropped before React sees it. */
const ALLOWED_ATTRS = new Set(['className', 'id', 'title', 'lang', 'dir', 'role']);

/** `data-*` and `aria-*` are open-ended by design and carry no behaviour, so they pass as
 *  a prefix rule rather than being enumerated. */
function isAllowedAttr(name: string): boolean {
  return ALLOWED_ATTRS.has(name) || name.startsWith('data-') || name.startsWith('aria-');
}

/** Drop every attribute not on the allow-list. Exported shape is a plain object so the
 *  caller can spread it; the filtering is the whole point, so it is tested directly. */
export function filterIntrinsicProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (k === 'children') continue;
    if (isAllowedAttr(k)) out[k] = v;
  }
  return out;
}

function wrap(tag: string): ComponentType<Record<string, unknown>> {
  const Safe = ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
    createElement(tag, filterIntrinsicProps(rest), children);
  Safe.displayName = `Safe(${tag})`;
  return Safe as ComponentType<Record<string, unknown>>;
}

/** `tag → sanitizing wrapper`, merged into the component map the safe renderer consumes.
 *  A tag absent from this map is not an error: `renderMdast` collapses an unknown JSX tag
 *  to a Fragment that KEEPS ITS CHILDREN, so an unregistered wrapper loses its element and
 *  its styling but never its content. */
export const SAFE_INTRINSICS: Record<string, ComponentType<Record<string, unknown>>> =
  Object.fromEntries(ALLOWED_TAGS.map((t) => [t, wrap(t)]));
