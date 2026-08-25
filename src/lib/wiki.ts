// Pure wiki helpers — no React, no components (kept out of component files per the
// Fast-Refresh rule). Shared by the reading-view, index, and agent surfaces.
import { contentDir, hrefKeyCandidates, splitFragment } from './content';
// The canonical `[[label|target]]` grammar (MARKDOWN_SYNTAX_SPEC §13.1) — the SAME
// parser the safe renderer splits wiki-links with, so the backlink index and the link
// a reader clicks can never disagree about what a target is.
import { parseWikiInner } from '@immediately-run/sdk/safeContent/index';

/** Extract the path strings from a `useMetadataQuery` result. The hook returns a
 *  `{ path, meta }[]` array directly (or `{ error }`), NOT a `{ result }` wrapper —
 *  centralising the unwrap here keeps every consumer honest. */
export function queryPaths(q: unknown): string[] {
  return Array.isArray(q) ? (q as { path: string }[]).map((e) => e.path) : [];
}

/** Records from a metadata query that returned records: the entries as given, or
 *  `[]` when the query threw (`{ error }` result). The record-shape twin of
 *  {@link queryPaths}. */
export function queryRecords<E extends object>(q: unknown): ({ path: string } & E)[] {
  return Array.isArray(q) ? (q as ({ path: string } & E)[]) : [];
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

// ── Backlinks (R3-283) ───────────────────────────────────────────────────────
//
// `bodyLinksTo` used to string-match three literal forms — `(/content/X.mdx)`,
// `(/files/content/X.mdx)` and `[[X]]` (corpus-relative, extension-less). The corpus
// writes NONE of them: it writes `[[../specs/X.mdx#sec-2]]` and `(ways_of_working.mdx)`,
// both RELATIVE to the linking entry, with the extension, sometimes with a fragment.
// Result: 9,030 wiki-links, 0 of 710 entries with a backlink — `<Backlinks/>`, the
// signature wiki affordance, had never worked on this corpus and rendered its empty
// state perfectly while doing so.
//
// So these do not pattern-match link SYNTAX any more. They EXTRACT each link and
// resolve it through `hrefKeyCandidates` — the same function the renderer routes
// clicks through, and the same rule `check-docs-wiki`'s `contentResolve` audits the
// corpus by. A backlink now means exactly "a link that would navigate here", which is
// the only definition that cannot drift from the links themselves.
//
// Deliberately DROPPED: the old corpus-relative reading of `[[specs/X]]`. Under the one
// resolution rule that link, written in `content/roadmap/foo.mdx`, denotes
// `content/roadmap/specs/X.mdx` — so honouring the old reading would credit a backlink
// to an entry the link does not go to. An extension-less target still works; it is just
// resolved like every other link.

/** Frontmatter, fenced code and inline code spans removed — the regions where a
 *  `[[…]]` or `[…](…)` is being QUOTED rather than linked. Without this the roadmap
 *  items that document link forms would manufacture backlinks out of their own prose. */
export function linkScannableBody(body: string): string {
  return stripFrontmatter(body)
    .replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[^\n]*$/gm, '')
    .replace(/`[^`\n]*`/g, '');
}

/** One extracted link: the raw href, plus the text a reader sees (the wiki label or
 *  the markdown label) — what `backlinkSnippet` marks. */
export interface BodyLink {
  href: string;
  label: string;
}

/** Every corpus link in `body`, in source order. Wiki targets are parsed with the SDK's
 *  canonical `parseWikiInner` (`[[label|target]]`, label first — MARKDOWN_SYNTAX §13.1)
 *  rather than a local regex, so this cannot drift from what the renderer links. */
export function bodyLinks(body: string): BodyLink[] {
  const scannable = linkScannableBody(body);
  const out: BodyLink[] = [];
  for (const m of scannable.matchAll(/\[\[([^[\]]+)\]\]/g)) {
    const token = parseWikiInner(m[1]);
    if (token) out.push({ href: token.target, label: token.label ?? token.target });
  }
  // `[label](href)`, skipping images (`![alt](src)`) and an optional "title".
  for (const m of scannable.matchAll(/(!?)\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
    if (m[1] === '!') continue;
    out.push({ href: m[3], label: m[2] });
  }
  return out;
}

/** The entry keys a body link denotes. An extension-less target also gets an `.mdx`
 *  candidate, so the legacy `[[slug]]` form keeps resolving — by the same rule, not a
 *  special case. */
function linkTargetKeys(href: string, fromKey: string): string[] {
  const keys = hrefKeyCandidates(href, fromKey);
  if (keys.length) return keys;
  const [path, frag] = splitFragment(href);
  return /\.mdx?$/.test(path) || !path ? [] : hrefKeyCandidates(`${path}.mdx${frag}`, fromKey);
}

/** Does the entry at `fromKey` link to the entry at `targetKey`? Resolves every link
 *  in the body the way the renderer does, then compares KEYS — so a near-miss
 *  (`[[specs/OTHER.mdx]]` against `specs/OTHER_SPEC.mdx`) cannot match. */
export function bodyLinksTo(body: string, targetKey: string, fromKey: string): boolean {
  return bodyLinks(body).some((l) => linkTargetKeys(l.href, fromKey).includes(targetKey));
}

/** Body prose as a READER sees it: HTML tags dropped, and a link reduced to the text
 *  it renders as. Without the second half a snippet reads
 *  `calls the target [[the layering contract|../specs/X.mdx#sec-2]] and carries`, which
 *  is the source, not the sentence — the noise was invisible while the index was empty
 *  and appeared the moment backlinks started resolving (R3-283). */
export function renderedText(body: string): string {
  return stripFrontmatter(body)
    .replace(/<[^>]+>/g, ' ')
    // `[[label|target]]` → label, `[[target]]` → target (the §13.1 order).
    .replace(/\[\[([^[\]]+)\]\]/g, (_, inner: string) => {
      const token = parseWikiInner(inner);
      return token ? (token.label ?? token.target) : inner;
    })
    // `[label](href)` → label; an image renders as its alt text.
    .replace(/!?\[([^\]]*)\]\(\s*[^)\s]+(?:\s+"[^"]*")?\s*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A ~160-char snippet of `body` around the first link to `targetKey`, with the
 *  linking phrase wrapped in <mark>… (returned as an HTML string for the snippet). */
export function backlinkSnippet(body: string, targetKey: string, fromKey: string): string {
  const text = renderedText(body);
  // The MARK is the linking phrase as the reader sees it: a wiki label (or its target
  // when unlabelled), or the markdown label. Matching on the resolved link rather than
  // on a literal href is what stops every hit falling back to "first 160 chars".
  const link = bodyLinks(body).find((l) => linkTargetKeys(l.href, fromKey).includes(targetKey));
  const phrase = link?.label.trim();
  const idx = phrase ? text.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  if (!phrase || idx === -1) {
    return text.slice(0, 160) + (text.length > 160 ? '…' : '');
  }
  const start = Math.max(0, idx - 70);
  const end = Math.min(text.length, idx + phrase.length + 70);
  const before = (start > 0 ? '…' : '') + text.slice(start, idx);
  const after = text.slice(idx + phrase.length, end) + (end < text.length ? '…' : '');
  return `${before}<mark>${phrase}</mark>${after}`;
}
