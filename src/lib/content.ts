// Path conventions for Grove content. After the sandbox metadata-key fix, the
// metadata key, the Include/fs path, and `module.dynamicImport` all agree on ONE
// absolute file-space path (e.g. `/app/content/handbook/onboarding.mdx`). Only the
// URL layer differs: the file router serves it at `/files/content/...` and the
// SDK <Link> prepends `/files` itself, so links/edit use the APP_ROOT-stripped form.
// Pure helpers — no components.

export const APP_PREFIX = '/app';
export const FILES_PREFIX = '/files';
export const CONTENT_DIR = '/app/content/';
export const HOME_KEY = '/app/content/home.mdx';

/** Is this metadata key a content entry? */
export function isEntryKey(key: string): boolean {
  return key.startsWith(CONTENT_DIR) && /\.mdx?$/.test(key);
}

/** `handbook/onboarding` → `/app/content/handbook/onboarding.mdx` (the canonical key). */
export function slugToKey(slug: string): string {
  return CONTENT_DIR + slug.replace(/^\//, '') + '.mdx';
}

/** Canonical key → href for the runtime <Link> (which prepends `/files` itself, so
 *  we pass the APP_ROOT-stripped path, e.g. `/content/onboarding.mdx`). */
export function keyToHref(key: string): string {
  return key.slice(APP_PREFIX.length);
}

/** Canonical key → the path for <Include> / module.dynamicImport (identity: the key
 *  already IS the absolute `/app/...` module path). */
export function keyToInclude(key: string): string {
  return key;
}

/** Canonical key → repo-relative path for requestEdit (`content/...`). */
export function keyToRepoRel(key: string): string {
  return key.slice(`${APP_PREFIX}/`.length);
}

/** Current navigation sandboxPath → the canonical metadata/Include key. */
export function sandboxPathToKey(sandboxPath: string): string {
  if (!sandboxPath || sandboxPath === '/') return HOME_KEY;
  if (sandboxPath.startsWith(FILES_PREFIX)) {
    const rest = sandboxPath.slice(FILES_PREFIX.length); // e.g. `/content/x.mdx`
    return rest === '' || rest === '/' ? HOME_KEY : APP_PREFIX + rest;
  }
  if (sandboxPath.startsWith(CONTENT_DIR)) return sandboxPath;
  return HOME_KEY;
}

/** A sandboxPath → the absolute fs base for resolving relative assets. */
export function toFsPath(sandboxPath: string): string {
  return sandboxPathToKey(sandboxPath);
}
