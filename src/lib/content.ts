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

export const APP_PREFIX = '/app';
export const FILES_PREFIX = '/files';
export const CONTENT_DIR = '/app/content/';
export const HOME_KEY = '/app/content/home.mdx';

/** Is this a content-entry metadata key? */
export function isEntryKey(key: string): boolean {
  return key.startsWith(CONTENT_DIR) && /\.mdx?$/.test(key);
}

/** `handbook/onboarding` → `/app/content/handbook/onboarding.mdx` (the canonical key). */
export function slugToKey(slug: string): string {
  return CONTENT_DIR + slug.replace(/^\//, '') + '.mdx';
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

/** Current navigation sandboxPath → the canonical metadata/Include key. */
export function sandboxPathToKey(sandboxPath: string): string {
  if (!sandboxPath || sandboxPath === '/') return HOME_KEY;
  let p = sandboxPath;
  if (p.startsWith(FILES_PREFIX)) p = p.slice(FILES_PREFIX.length); // /files/content/x → /content/x
  if (!p.startsWith(APP_PREFIX + '/')) p = APP_PREFIX + p; // /content/x → /app/content/x (and /app/content/x stays)
  if (p === APP_PREFIX || p === APP_PREFIX + '/') return HOME_KEY;
  return p.startsWith(CONTENT_DIR) ? p : HOME_KEY;
}

/** A sandboxPath → the absolute fs base for resolving relative assets. */
export function toFsPath(sandboxPath: string): string {
  return keyToFsPath(sandboxPathToKey(sandboxPath));
}
