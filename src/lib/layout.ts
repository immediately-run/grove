// Layout resolution — the "outlet chain" for a content entry. Pure helpers (no
// React), so the same rules drive rendering and any future manifest/validation.
//
// A LAYOUT is an MDX file (`…/_layout.mdx`) that renders shared chrome — nav,
// section hero, footer — around an `<Outlet/>` where the page (or an inner
// layout) renders. This is Grove's answer to React Router's nested layout
// routes: the URL always names the *leaf content file*, and the layout chain is
// resolved *around* it at render time, invisible to routing.
//
// Association is FOLDER CONVENTION, nested up the namespace: a `_layout.mdx` in a
// directory wraps every entry in that subtree, and directories nest
// (`content/_layout.mdx` wraps `content/people/_layout.mdx` wraps the page).
// The `frame` frontmatter key OVERRIDES the convention on a per-entry basis; the
// existing `layout` field (the CSS `data-layout` variant) is unrelated and
// untouched.
import { contentDir, slugToKey, isLayoutKey } from './content';

/** The `_layout.mdx` key for a directory key (which ends in `/`). */
function layoutKeyForDir(dir: string): string {
  return dir + '_layout.mdx';
}

/** Does an entry/layout opt out of an inherited layout chain? `frame: none`
 *  (or `frame: false`) means "render me bare / stop inheritance above here". */
function optsOut(meta: Record<string, unknown> | undefined): boolean {
  const f = meta?.frame;
  return f === 'none' || f === false;
}

/**
 * Resolve the ordered chain of layout files that wrap `entryKey`, **outermost
 * first** (root → nearest). The caller nests them so the last one is closest to
 * the page and the page renders at the innermost `<Outlet/>`.
 *
 * Rules, in precedence order:
 *   1. `frame: none` / `frame: false` on the entry → `[]` (render bare, no chrome).
 *   2. `frame: '<slug>'` on the entry → exactly that one layout, if it exists.
 *   3. Otherwise folder convention: every `_layout.mdx` from the content root down to
 *      the entry's own directory that exists in `allKeys`. A `_layout.mdx` whose
 *      own frontmatter opts out (`frame: none`) becomes a new root — layouts above
 *      it are dropped.
 *
 * Layout files never wrap themselves (a `_layout.mdx` gets no layout chain).
 */
export function layoutChainForKey(
  entryKey: string,
  filesMetadata: Record<string, Record<string, unknown> | undefined>,
): string[] {
  if (isLayoutKey(entryKey)) return [];

  const allKeys = Object.keys(filesMetadata);
  const metaOf = (key: string) => filesMetadata[key];
  const entryMeta = metaOf(entryKey);
  if (optsOut(entryMeta)) return [];

  const explicit = entryMeta?.frame;
  if (typeof explicit === 'string' && explicit && explicit !== 'none') {
    const key = slugToKey(explicit);
    return allKeys.includes(key) ? [key] : [];
  }

  const present = new Set(allKeys.filter(isLayoutKey));
  const root = contentDir();
  if (!entryKey.startsWith(root)) return [];

  // Directories from the content root down to (but not including) the entry file.
  const rel = entryKey.slice(root.length); // e.g. "people/ada.mdx"
  const segs = rel.split('/').slice(0, -1); // e.g. ["people"]
  const dirs = [root];
  let dir = root;
  for (const s of segs) {
    dir = dir + s + '/';
    dirs.push(dir);
  }

  const chain: string[] = [];
  for (const d of dirs) {
    const lk = layoutKeyForDir(d);
    if (!present.has(lk)) continue;
    if (optsOut(metaOf(lk))) chain.length = 0; // this layout is a new root
    chain.push(lk);
  }
  return chain;
}
