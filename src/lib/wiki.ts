// Pure wiki helpers — no React, no components (kept out of component files per the
// Fast-Refresh rule). Shared by the reading-view, index, and agent surfaces.
import { contentDir, keyToHref } from './content';

/** Extract the path strings from a `useMetadataQuery` result. The hook returns a
 *  `{ path, meta }[]` array directly (or `{ error }`), NOT a `{ result }` wrapper —
 *  centralising the unwrap here keeps every consumer honest. */
export function queryPaths(q: unknown): string[] {
  return Array.isArray(q) ? (q as { path: string }[]).map((e) => e.path) : [];
}

/** Average adult reading speed; `→ N min read` is rounded up, min 1. */
export function readingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// Heading ids come from the CANON (R3-277). `@immediately-run/mdx-plugins` owns the
// slug grammar — it is the plugin the compiled and safe render paths both run, so its
// `headingId` is by definition the id a reader lands on. Grove reproduced it locally
// (per §15.5 "specified precisely so a consumer can reproduce it") and the two agreed
// because they were written from the same paragraph, which is a promise rather than a
// mechanism: the failure mode is a `<Toc>` entry that scrolls nowhere, silently.
//
// This deliberately relaxes "grove depends on the SDK, not the transpiler" for the
// PLUGINS package only. That package is the byte-canon, is dependency-free, and is
// consumed here for a pure function — none of the transpiler's machinery comes with
// it. Re-exported so every existing import site in this repo is unchanged.
export { textSlug, sectionId, headingId } from '@immediately-run/mdx-plugins';

/** A content key → its namespace breadcrumb, e.g.
 *  `/app/content/handbook/onboarding.mdx` → `handbook / onboarding`. */
export function crumb(key: string): string {
  return key
    .replace(contentDir(), '')
    .replace(/\.mdx?$/, '')
    .split('/')
    .join(' / ');
}

/** The namespace folder of a key, e.g. `handbook` (or '' for a root entry). */
export function namespaceOf(key: string): string {
  const rel = key.replace(contentDir(), '').replace(/\.mdx?$/, '');
  const parts = rel.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

/** Drop a leading `--- … ---` YAML frontmatter block from raw MDX source. */
export function stripFrontmatter(src: string): string {
  const m = src.match(/^---\n[\s\S]*?\n---\n?/);
  return m ? src.slice(m[0].length) : src;
}

/** Does `body` link to the entry at `targetKey`? Matches the canonical
 *  `/content/….mdx` href the runtime <Link> uses, with or without the prefix. */
export function bodyLinksTo(body: string, targetKey: string): boolean {
  const href = keyToHref(targetKey); // /content/….mdx
  const slug = href.replace(/^\/content\//, '').replace(/\.mdx?$/, '');
  return (
    body.includes(`(${href})`) ||
    body.includes(`(/files${href})`) ||
    body.includes(`[[${slug}]]`)
  );
}

/** A ~160-char snippet of `body` around the first link to `targetKey`, with the
 *  linking phrase wrapped in <mark>… (returned as an HTML string for the snippet). */
export function backlinkSnippet(body: string, targetKey: string): string {
  const text = stripFrontmatter(body)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const href = keyToHref(targetKey);
  // Find a markdown link [label](href) and keep its label as the mark.
  const re = new RegExp(`\\[([^\\]]+)\\]\\((?:/files)?${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`);
  const linkified = stripFrontmatter(body).replace(/\s+/g, ' ');
  const m = linkified.match(re);
  if (!m) {
    return text.slice(0, 160) + (text.length > 160 ? '…' : '');
  }
  const idx = text.toLowerCase().indexOf(m[1].toLowerCase());
  const start = Math.max(0, idx - 70);
  const end = Math.min(text.length, idx + m[1].length + 70);
  const before = (start > 0 ? '…' : '') + text.slice(start, idx);
  const after = text.slice(idx + m[1].length, end) + (end < text.length ? '…' : '');
  return `${before}<mark>${m[1]}</mark>${after}`;
}
