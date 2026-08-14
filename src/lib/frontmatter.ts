// Frontmatter parsing for the viewer-side corpus scan (R3-265).
//
// PORTED, not invented: this is `parseFrontmatter` from the docs repo's
// `scripts/lib/wiki.mjs`, the parser that has read the whole 671-entry docs corpus and the
// migrated book corpus. The grammar it accepts is the grammar Grove's own authoring
// contract (`content/GROVE.mdx`) documents — scalars, inline `[a, b]` lists, block lists,
// and one level of nesting for `owns:` — so re-deriving it here would be a second standard
// that drifts from the one the conformance gate enforces.
//
// Why a parser at all, rather than the bundler's metadata: under DISPATCH the corpus is a
// mount, and the bundler only scans the app's own source. Nothing else has read these bytes.

export type FrontmatterValue = string | string[] | Record<string, string | string[]> | null;
export type Frontmatter = Record<string, FrontmatterValue>;

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** A frontmatter value: an inline `[a, b]` list or a scalar. */
function parseScalarOrList(rawVal: string): string | string[] {
  if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
    const inner = rawVal.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((s) => stripQuotes(s.trim()));
  }
  return stripQuotes(rawVal);
}

/**
 * Split `--- … ---` frontmatter off the head of an entry. A file without it is not an
 * error — it is an entry with no metadata, and the corpus contains those (a draft, a
 * `_layout.mdx`), so this never throws and never discards the body.
 */
export function parseFrontmatter(content: string): { data: Frontmatter; body: string } {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return { data: {}, body: content };
  const end = lines.indexOf('---', 1);
  if (end === -1) return { data: {}, body: content };

  const fmLines = lines.slice(1, end);
  const body = lines
    .slice(end + 1)
    .join('\n')
    .replace(/^\n+/, '');
  const data: Frontmatter = {};
  let key: string | null = null;

  for (const line of fmLines) {
    // A block-list item under the current key.
    if (/^\s+-\s+/.test(line) && key !== null) {
      const item = stripQuotes(line.replace(/^\s*-\s+/, '').trim());
      if (!Array.isArray(data[key])) data[key] = [];
      (data[key] as string[]).push(item);
      continue;
    }
    // An indented `subkey: value` under the current key → a nested one-level object
    // (`owns:` then `  concepts: [...]`).
    const sub = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (sub && key !== null) {
      const cur = data[key];
      if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) data[key] = {};
      (data[key] as Record<string, string | string[]>)[sub[1]] = parseScalarOrList(sub[2].trim());
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    const rawVal = kv[2].trim();
    if (rawVal === '') {
      data[key] = null; // may be filled by following `- ` items or `  subkey:` lines
    } else if (rawVal === '{}') {
      data[key] = {};
      key = null;
    } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      data[key] = parseScalarOrList(rawVal);
    } else {
      data[key] = stripQuotes(rawVal);
      key = null; // a scalar cannot be extended by `- `/nested lines
    }
  }
  return { data, body };
}
