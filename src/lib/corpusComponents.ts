// Corpus-declared components — the parse half (R3-174; MDX_FROM_MOUNT_SPEC §2, §7 1b).
//
// A corpus may ship its own component vocabulary and have the viewer register it
// import-free, so `<ProjectIndex/>` works with no engine fork. This module owns the
// DECLARATION: reading `components` out of the corpus's own `immediately.run.json` and
// deciding which entries are usable. Evaluating them is `hooks/useContentComponents`.
//
// **Why the marker file and not a frontmatter scan.** §7 1b left the declaration form
// open and named three candidates (an `.mdx` module with `type: component` frontmatter, a
// per-component metadata entry, a `components/` path convention). The marker wins on four
// counts: it is already IN the corpus and already read, so discovery costs no scan and no
// sidecar — which matters because a private corpus has neither (the docs wiki has no Pages
// site, so no cache zip and no frontmatter sidecar; it loads over the REST API); a raw
// `.jsx` carries no frontmatter, so the frontmatter form would force a wrapper module for
// every component; it is one greppable place that states the corpus's whole vocabulary,
// which is what `viewer.manifest.json`'s `tier: "corpus"` entries were already reaching
// for; and it adds no non-component module export anywhere, so it cannot break Fast
// Refresh (the constraint §7 1b is bounded by).
//
// **The host does not read this key and must not start.** `site-main`'s
// `contentMarker.ts` parses `opensWith` and `kind` and ignores everything else, so the
// vocabulary is viewer policy, not part of the host's authority decision. That separation
// is the point: the marker names a CONTRACT to the host, and a component list to whoever
// honours the contract.

/** One usable declaration: an MDX component name bound to an absolute module path. */
export interface CorpusComponent {
  /** The name an entry writes as `<Name/>`. */
  name: string;
  /** Absolute module path inside the corpus, ready for `getModuleEvaluationContext`. */
  path: string;
}

/** A declaration that was thrown out, and why — surfaced, never silently dropped. */
export interface RejectedComponent {
  name: string;
  reason: string;
}

export interface CorpusComponentDecls {
  components: CorpusComponent[];
  rejected: RejectedComponent[];
}

/** MDX resolves a lowercase tag as an intrinsic element and only consults the provider for
 *  a CAPITALIZED reference, so a lowercase name could never be reached — and a name with a
 *  dot or a dash would not parse as a component reference at all. Rejecting them is the
 *  difference between "your component silently never renders" and a named error. */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9_]*$/;

/** Collapse `.`/`..`/empty segments. `..` cannot climb above the root: a virtual root's
 *  parent is itself, which is what keeps the corpus space closed under traversal (the same
 *  rule as the SDK's `normalizeAbsolute` and `lib/content`'s `normalizeKey`). */
function normalizeAbsolute(abs: string): string {
  const out: string[] = [];
  for (const seg of abs.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

/**
 * Resolve one declared path against the corpus root, or null if it does not name a file
 * inside the corpus.
 *
 * Under decision B (2026-08-26) a content component may import anything the viewer can,
 * so this containment check is **coherence, not confinement** — it stops a marker naming
 * `/app/src/App.tsx` and having the engine register its own module under a corpus name,
 * which would be baffling rather than dangerous. The confinement argument is recorded in
 * `MDX_FROM_MOUNT_SPEC` §2: inside an executor there is nothing to confine, because the
 * module reaches `globalThis.fetch` whatever the resolver allows.
 */
export function resolveComponentPath(raw: unknown, root: string): string | null {
  if (typeof raw !== 'string' || raw === '') return null;
  if (raw.includes('\0') || raw.includes('\\')) return null;
  if (raw.startsWith('/')) return null; // corpus-relative only — an absolute path is a different space
  const base = root.endsWith('/') ? root : `${root}/`;
  const resolved = normalizeAbsolute(base + raw.replace(/^\.\//, ''));
  // Containment, checked on the NORMALIZED path: `a/../../x` starts with the root as a
  // STRING and resolves outside it as a PATH (the hazard `sandboxPathToKey` documents).
  const contained = normalizeAbsolute(base);
  if (resolved !== contained && !resolved.startsWith(`${contained}/`)) return null;
  if (resolved === contained) return null; // the root itself is not a module
  return resolved;
}

/**
 * Read the `components` map out of a parsed `immediately.run.json`.
 *
 * Fails soft per entry: one bad declaration is reported and skipped, it never costs the
 * corpus its other components. A marker with no `components` key is the ordinary case and
 * yields an empty list with nothing rejected.
 */
export function parseCorpusComponents(marker: unknown, root: string): CorpusComponentDecls {
  const components: CorpusComponent[] = [];
  const rejected: RejectedComponent[] = [];
  const raw = (marker as { components?: unknown } | null | undefined)?.components;
  if (raw === undefined || raw === null) return { components, rejected };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { components, rejected: [{ name: '(components)', reason: 'not an object' }] };
  }
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!COMPONENT_NAME.test(name)) {
      rejected.push({ name, reason: 'not a capitalized component name' });
      continue;
    }
    const path = resolveComponentPath(value, root);
    if (path === null) {
      rejected.push({ name, reason: `not a corpus-relative path inside the corpus: ${String(value)}` });
      continue;
    }
    components.push({ name, path });
  }
  return { components, rejected };
}
