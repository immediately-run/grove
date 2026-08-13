// Deep-link fragment resolution — pure helpers, no React (the Fast-Refresh rule).
//
// The problem these solve is specific to a corpus whose documents share section ids. Every
// spec numbers its sections from 1, so `#sec-4` exists in almost every entry. A scroll
// fired when navigation *starts* therefore finds a perfectly good `#sec-4` — belonging to
// the document the reader is leaving — scrolls to it, reports success, and is then undone
// when the incoming entry renders. The reader lands at the top of the right page.
//
// The fix is to refuse to scroll until the element found belongs to the entry that is
// actually on screen, which the `data-entry` marker inside the suspended body makes
// checkable (see `SafeEntryBody`).

/** The fragment the current navigation is asking for, without its `#`. */
export function fragmentOf(hash: string | undefined | null): string {
  if (!hash) return '';
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  // The local dev provider appends its own `#ir-endpoint=…&ir-token=…` locator, so a
  // fragment can arrive with the locator glued onto it. Take the leading component.
  return raw.split(/[#&]/)[0].trim();
}

/**
 * The element a fragment names, but only once the body on screen is the one being asked
 * about. Returns null while the previous entry is still rendered, which is the signal to
 * wait rather than to scroll.
 *
 * Falls back to the whole document when no marked body is present — the compiled
 * (`<Include>`) path does not carry the marker, and scrolling imperfectly there is better
 * than not at all.
 */
export function resolveFragmentTarget(doc: Document, entryKey: string, frag: string): HTMLElement | null {
  if (!frag) return null;
  // Compare the attribute VALUE rather than selecting on it. An entry key is a path
  // (`/app/content/context/core_concepts.mdx`), and getting it through a CSS attribute
  // selector means trusting `CSS.escape` and the selector parser to agree about slashes
  // and dots — a silent no-match if they do not. Reading the attribute and comparing
  // strings has no such failure mode, and there are only a handful of marked bodies.
  const marked = Array.from(doc.querySelectorAll<HTMLElement>('[data-entry]'));
  const scope: ParentNode | null = marked.find((n) => n.getAttribute('data-entry') === entryKey) ?? null;
  // No marked body at all: the compiled (`<Include>`) path does not carry the marker, so
  // fall back to the document. A marked body for a DIFFERENT entry means the previous
  // document is still on screen — return null and wait, rather than scroll the wrong page.
  const root: ParentNode | null = scope ?? (marked.length === 0 ? doc : null);
  if (!root) return null;
  const byId = root.querySelector<HTMLElement>(`[id="${cssEscape(frag)}"]`);
  if (byId) return byId;
  // A numbered heading also carries its prose slug, which is a valid landing hook.
  return root.querySelector<HTMLElement>(`[data-slug="${cssEscape(frag)}"]`);
}

/** `CSS.escape`, with a conservative fallback for the characters ids here can contain. */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}
