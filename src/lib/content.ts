// Path conventions for Grove content.
//
// The CANONICAL KEY in this app is the file's ABSOLUTE module/fs path, e.g.
// `/app/content/handbook/onboarding.mdx`. This is the SAME identifier used by:
//   • the metadata store — `useFileMetadata(key)` / `useMetadataQuery` are keyed
//     by it (since the bundler change "Key MDX metadata by the absolute /app
//     module path", sandbox #41 — metadata and modules now share one path);
//   • the fs / `<Include>` / `module.dynamicImport` / `fs.readFile` path space.
//
// So an entry's metadata is read and its body is rendered with the identical
// string — no more juggling two path spaces. The ONLY place a different space
// appears is the URL/href layer, which owns the `/files`↔APP_ROOT translation:
// `keyToHref` strips `/app` (the runtime <Link> then prepends `/files`), and
// `keyToRepoRel` strips `/app/` for requestEdit. Pure helpers — no components.

import { getContentRoot } from './contentRoot';

export const APP_PREFIX = '/app';
export const FILES_PREFIX = '/files';

/** Where this instance's corpus lives — `/app/content/` for a fork, the delegated
 *  directory for a dispatched viewer. A FUNCTION, not a constant: see
 *  [[contentRoot]] for why capturing it at module scope is the bug it replaces. */
export function contentDir(): string {
  return getContentRoot();
}

/** The site root entry — the home page of whichever corpus is mounted. */
export function homeKey(): string {
  return `${getContentRoot()}home.mdx`;
}

/** Is this a content-entry metadata key? */
export function isEntryKey(key: string): boolean {
  return key.startsWith(contentDir()) && /\.mdx?$/.test(key);
}

/** Is this a folder-convention layout file (`…/_layout.mdx`)? These are structure,
 *  not entries: they wrap pages at an `<Outlet/>` and are excluded from every
 *  content enumeration (routing, nav, sidebar tree, index, search, backlinks). */
export function isLayoutKey(key: string): boolean {
  return /(^|\/)_layout\.mdx?$/.test(key);
}

/** Is this a *content entry* — an `.mdx` under content that a reader can navigate to?
 *  Excludes layout files and any other `_`-prefixed structural file. This is the
 *  single predicate every enumeration (nav, sidebar, 404 index, search, indexes)
 *  should filter on, so layout files never leak into reader-facing surfaces. */
export function isContentEntry(key: string): boolean {
  if (!key.startsWith(contentDir()) || !/\.mdx?$/.test(key)) return false;
  return !(key.split('/').pop() || '').startsWith('_');
}

/** `handbook/onboarding` → `/app/content/handbook/onboarding.mdx` (the canonical key). */
export function slugToKey(slug: string): string {
  return contentDir() + slug.replace(/^\//, '') + '.mdx';
}

/** Canonical key → href for the runtime <Link>. The key is the absolute fs path
 *  (`/app/content/x.mdx`); the URL space drops `/app` and <Link> prepends `/files`
 *  itself, so we hand it the APP_ROOT-relative path (`/content/x.mdx`). */
export function keyToHref(key: string): string {
  return key.startsWith(APP_PREFIX) ? key.slice(APP_PREFIX.length) : key;
}

/** Canonical key → the absolute fs/module path for <Include> / dynamicImport /
 *  fs.readFile. The canonical key already IS that path, so this is identity. */
export function keyToInclude(key: string): string {
  return key;
}

/** Canonical key → absolute fs path (alias of {@link keyToInclude}, for reads). */
export function keyToFsPath(key: string): string {
  return key;
}

/** Canonical key → repo-relative path for requestEdit (`content/…`). */
export function keyToRepoRel(key: string): string {
  return key.replace(/^\/app\//, '').replace(/^\//, '');
}

/** Split a link target into its path part and its `#fragment` (the `#` kept), e.g.
 *  `"FOO.mdx#sec-8-9"` → `["FOO.mdx", "#sec-8-9"]`. Only the FIRST `#` splits. */
export function splitFragment(href: string): [string, string] {
  const i = href.indexOf('#');
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i)];
}

/** Collapse `.` and `..` segments in an absolute key. */
function normalizeKey(abs: string): string {
  const out: string[] = [];
  for (const seg of abs.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

/**
 * The canonical keys a link href may denote, most-specific first — empty when the href
 * is external, a bare anchor, or doesn't name a content entry.
 *
 * An author writes links RELATIVE to the entry they are in (`[Roadmap](roadmap/index.mdx)`
 * from `content/home.mdx`), which is the same rule `scripts/lib/wiki.mjs` `contentResolve`
 * applies to `[[…]]` links and `check-docs-wiki` audits them by. Resolving markdown links
 * the same way is what keeps the rendered wiki and the corpus gate agreeing: before this,
 * a relative href fell through to a plain `<a>`, the sandbox performed a real navigation,
 * and the app died with "Failed to construct 'URL': Invalid URL".
 *
 * Two candidates rather than one, so a `foo.md` still finds `foo.mdx`. R3-252 rewrote the
 * corpus off those pre-cutover names and `check-docs-wiki` now refuses new ones, so this
 * fallback should never fire from committed content — it is kept because the gate being
 * STRICTER than the renderer is the right asymmetry: a stale hand-typed link should still
 * land a reader somewhere, and only the corpus is held to the canonical name. The CALLER
 * picks the first candidate that exists, so this stays pure and testable.
 */
export function hrefKeyCandidates(href: string, fromKey: string): string[] {
  if (!href) return [];
  if (/^(https?:|mailto:|tel:|#)/i.test(href)) return [];
  const [rawPath] = splitFragment(href);
  if (!rawPath) return [];
  const path = rawPath.replace(/^\/files/, '');
  const dir = fromKey.slice(0, fromKey.lastIndexOf('/'));
  const abs = normalizeKey(path.startsWith('/') ? APP_PREFIX + path : `${dir}/${path}`);
  if (!isEntryKey(abs)) return [];
  return abs.endsWith('.md') ? [abs, abs + 'x'] : [abs];
}

/**
 * What an href in an entry body IS, which decides whether it may become a real `<a>`.
 *
 * A real `<a href>` performs a REAL NAVIGATION on click, which takes the sandboxed frame
 * out of the app — the R3-252 crash (`Failed to construct 'URL': Invalid URL`). So an
 * anchor is only ever correct for an href that genuinely means to leave the document:
 *
 * - `'external'` — an absolute scheme (`https:`, `mailto:`, `tel:`). Leaving is the point.
 * - `'anchor'`   — a bare `#fragment`. Same document; navigates nowhere.
 * - `'content'`  — anything else: a link INTO the corpus. It must be routed, and if it
 *   cannot be resolved to an entry it is BROKEN — never "external by default". That
 *   fallthrough is what made an unresolvable body link lethal instead of merely wrong,
 *   and it is the class the wiki still contains (`../scripts/x.mjs`, `.claude/…`).
 */
export function linkKind(href: string): 'external' | 'anchor' | 'content' {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return 'external';
  if (href.startsWith('#')) return 'anchor';
  return 'content';
}

/** Current navigation sandboxPath → the canonical metadata/Include key. */
export function sandboxPathToKey(sandboxPath: string): string {
  if (!sandboxPath || sandboxPath === '/') return homeKey();
  let p = sandboxPath;
  if (p.startsWith(FILES_PREFIX)) p = p.slice(FILES_PREFIX.length); // /files/content/x → /content/x
  if (!p.startsWith(APP_PREFIX + '/')) p = APP_PREFIX + p; // /content/x → /app/content/x (and /app/content/x stays)
  if (p === APP_PREFIX || p === APP_PREFIX + '/') return homeKey();
  return p.startsWith(contentDir()) ? p : homeKey();
}

/** A sandboxPath → the absolute fs base for resolving relative assets. */
export function toFsPath(sandboxPath: string): string {
  return keyToFsPath(sandboxPathToKey(sandboxPath));
}
