import type { Entry } from '../data/wikiData';

export interface Backlink {
  slug: string;
  title: string;
  crumb: string;
  snip: string;
}

export type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'wiki-link'; target: string; label: string }
  | { type: 'code'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'link'; label: string; target: string };

/**
 * Searches for all entries that link to a specific slug using double-bracket [[wiki-links]].
 * Returns snippets, titles, and paths.
 */
export function backlinksFor(slug: string, entries: Record<string, Entry>): Backlink[] {
  const out: Backlink[] = [];

  Object.values(entries).forEach((e) => {
    // Combine all text blocks in the entry body
    const txt = (e.body || [])
      .map((b) => b.text || (b.items ? b.items.join(' ') : ''))
      .join(' ');

    const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let m;
    const seen: Record<string, number> = {};

    while ((m = re.exec(txt)) !== null) {
      const tgt = m[1].trim();
      if (tgt === slug && !seen[e.slug] && e.slug !== slug) {
        seen[e.slug] = 1;
        const idx = txt.indexOf(m[0]);
        
        // Take a window of text around the match for context
        const start = Math.max(0, idx - 46);
        const end = idx + m[0].length + 30;
        const around = txt
          .slice(start, end)
          .replace(/\*\*/g, '')
          .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, target, label) => {
            return (label || target).trim();
          });

        out.push({
          slug: e.slug,
          title: e.title,
          crumb: (e.crumb || []).join('/'),
          snip: around,
        });
      }
    }
  });

  return out;
}

/**
 * Parses inline content containing [[wiki-links]], code, bold text, and standard markdown links
 * into a structured array of type-safe tokens.
 */
export function tokenizeInline(str: string): InlineToken[] {
  const nodes: InlineToken[] = [];
  const re = /(\[\[([^\]|]+)(?:\|([^\]]+))?\]\])|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  
  let m;
  let last = 0;

  while ((m = re.exec(str)) !== null) {
    if (m.index > last) {
      nodes.push({ type: 'text', content: str.slice(last, m.index) });
    }

    if (m[1]) {
      // Wiki Link [[target|label]]
      const target = m[2].trim();
      const label = (m[3] || m[2]).trim();
      nodes.push({ type: 'wiki-link', target, label });
    } else if (m[4]) {
      // Inline Code `code`
      nodes.push({ type: 'code', content: m[5] });
    } else if (m[6]) {
      // Bold **text**
      nodes.push({ type: 'bold', content: m[7] });
    } else if (m[8]) {
      // Markdown Link [label](target)
      nodes.push({ type: 'link', label: m[9], target: m[10] });
    }

    last = re.lastIndex;
  }

  if (last < str.length) {
    nodes.push({ type: 'text', content: str.slice(last) });
  }

  return nodes;
}
