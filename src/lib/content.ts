// Path conventions for Grove content. There are TWO path spaces and they are NOT
// the same — conflating them is why metadata-driven UI silently renders empty:
//
//  • the METADATA-STORE key (what useFileMetadata/useMetadataQuery are keyed by)
//    is the APP_ROOT-relative path: `/content/handbook/onboarding.mdx`.
//  • the FS / <Include> / dynamicImport path is the absolute file-space path,
//    APP_PREFIX-prefixed: `/app/content/handbook/onboarding.mdx`.
//
// The canonical "key" in this app is the metadata-store key (`/content/…`). Helpers
// below convert it to the fs path, the <Link> href, and the repo-relative path.
// Pure helpers — no components.

export const APP_PREFIX = '/app';
export const FILES_PREFIX = '/files';
export const CONTENT_DIR = '/content/';
export const HOME_KEY = '/content/home.mdx';

/** Is this a content-entry metadata key? */
export function isEntryKey(key: string): boolean {
  return key.startsWith(CONTENT_DIR) && /\.mdx?$/.test(key);
}

/** `handbook/onboarding` → `/content/handbook/onboarding.mdx` (the canonical key). */
export function slugToKey(slug: string): string {
  return CONTENT_DIR + slug.replace(/^\//, '') + '.mdx';
}

/** Canonical key → href for the runtime <Link> (which prepends `/files` itself, so
 *  we pass the APP_ROOT-relative key as-is, e.g. `/content/onboarding.mdx`). */
export function keyToHref(key: string): string {
  return key;
}

/** Canonical key → the absolute fs/module path for <Include> / dynamicImport /
 *  fs.readFile (the key with the APP_PREFIX restored). */
export function keyToInclude(key: string): string {
  return APP_PREFIX + key;
}

/** Canonical key → absolute fs path (alias of {@link keyToInclude}, for reads). */
export function keyToFsPath(key: string): string {
  return APP_PREFIX + key;
}

/** Canonical key → repo-relative path for requestEdit (`content/…`). */
export function keyToRepoRel(key: string): string {
  return key.replace(/^\//, '');
}

/** Current navigation sandboxPath → the canonical metadata/Include key. */
export function sandboxPathToKey(sandboxPath: string): string {
  if (!sandboxPath || sandboxPath === '/') return HOME_KEY;
  let p = sandboxPath;
  if (p.startsWith(FILES_PREFIX)) p = p.slice(FILES_PREFIX.length); // /files/content/x → /content/x
  if (p.startsWith(APP_PREFIX + '/')) p = p.slice(APP_PREFIX.length); // /app/content/x → /content/x
  if (p === '' || p === '/') return HOME_KEY;
  return p.startsWith(CONTENT_DIR) ? p : HOME_KEY;
}

/** A sandboxPath → the absolute fs base for resolving relative assets. */
export function toFsPath(sandboxPath: string): string {
  return keyToFsPath(sandboxPathToKey(sandboxPath));
}
