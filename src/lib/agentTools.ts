// Grove's agent tools (GROVE_AGENT_SPEC R-GA-2): the SDK grant-filtered catalog is
// the authority surface, and the two corpus tools here are mount-chrooted reads the
// catalog model cannot name — `read_entry` (bodies) and the SDK's `metadata:query`
// (the index). One corpus, two tools: the metadata tool's rows are confined to
// `read_entry`'s chroot, and no row whose body the read tool cannot legally open is
// ever returned.
//
// Everything the tools return is corpus-derived bytes entering the loop — fenced
// (R-GA-7) before the model sees it.

import fs from 'fs';
import {
  createMetadataQueryTool,
  fenceUntrusted,
  type AgentTool,
  type FilesMetadata,
} from '@immediately-run/sdk';
import { isContentEntry } from './content';

/** Strip a leading YAML frontmatter block (and optional BOM) — frontmatter is the
 *  index's job; `read_entry` returns the body. Mirrors SafeEntryBody's stripper. */
function stripFrontmatter(src: string): string {
  return src.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '');
}

/** A read bound: generous for a wiki entry, small enough that a stuffed body cannot
 *  swamp the prompt on a provider with a modest window. */
const MAX_ENTRY_BYTES = 120 * 1024;

/** The slice of fs the read tool needs — injected so tests spy on it (G-GA-4). */
export type EntryReader = (absPath: string) => Promise<string>;

export const READ_ENTRY_TOOL_NAME = 'read_entry';

/**
 * The corpus body read, chrooted to the content root (`getContentRoot()` at factory
 * time). Input is a path RELATIVE to that root; traversal and absolute escapes are
 * rejected — outside paths are unnameable, the same answer a genuine miss gets.
 */
export function createReadEntryTool(chroot: string, read: EntryReader = (p) => fs.promises.readFile(p, 'utf8') as Promise<string>): {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (raw: unknown) => Promise<{ content: string; isError?: boolean }>;
} {
  const root = chroot.endsWith('/') ? chroot : `${chroot}/`;
  return {
    name: READ_ENTRY_TOOL_NAME,
    description:
      `Read one wiki entry's body (Markdown/MDX, frontmatter stripped), by path relative to the corpus root ` +
      `(e.g. "wiki/security.mdx"). Paths outside the corpus are not readable.`,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: { path: { type: 'string', description: 'Entry path relative to the corpus root.' } },
    },
    async execute(raw: unknown) {
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { content: 'invalid-params: input must be an object', isError: true };
      }
      const rel = (raw as { path?: unknown }).path;
      if (
        typeof rel !== 'string' ||
        !rel ||
        rel.length > 512 ||
        rel.includes('\u0000') ||
        rel.startsWith('/') // an absolute path is an escape attempt, not a corpus key
      ) {
        return { content: 'invalid-params: path must be a non-empty corpus-relative string', isError: true };
      }
      // The chroot is the corpus: resolve relative, normalize, and re-verify the
      // prefix — belt-and-braces with the host's own scoping (ways_of_working §2).
      let abs: string;
      try {
        abs = new URL(`file://${root}${rel.replace(/^\//, '')}`).pathname;
      } catch {
        return { content: 'invalid-params: unresolvable path', isError: true };
      }
      if (!abs.startsWith(root)) {
        return { content: 'invalid-params: path escapes the corpus root', isError: true };
      }
      try {
        const rawBody = await read(abs);
        const body = stripFrontmatter(rawBody).slice(0, MAX_ENTRY_BYTES);
        if (!body.trim()) return { content: fenceUntrusted(`tool-result: ${rel}`, '(empty entry)'), isError: true };
        return { content: fenceUntrusted(`tool-result: ${rel}`, body) };
      } catch (e) {
        const code = (e as { code?: string })?.code;
        const msg = (e as Error).message ?? String(e);
        // ENOENT and a chroot rejection read the same to the model — no existence
        // oracle for what lies outside the grant (threat_model P7).
        return { content: code ? `${code}: ${rel}` : `read failed: ${msg}`, isError: true };
      }
    },
  };
}

/** Grove's row policy for the metadata tool: `_`-prefixed files are structure, not
 *  reader-facing entries (the `isContentEntry` cut the rest of the viewer uses). */
const rowPolicy = (absPath: string): boolean => isContentEntry(absPath);

/** The metadata query tool over the in-scope index, confined to the corpus chroot. */
export function createGroveMetadataTool(chroot: string, getIndex: () => FilesMetadata) {
  return createMetadataQueryTool({ chroot, getIndex, filter: rowPolicy });
}

/** Both tools in the loop's `AgentTool` shape. */
export function groveAgentTools(chroot: string, getIndex: () => FilesMetadata, read?: EntryReader): AgentTool[] {
  const entry = createReadEntryTool(chroot, read);
  const meta = createGroveMetadataTool(chroot, getIndex);
  return [
    { name: entry.name, description: entry.description, input_schema: entry.inputSchema },
    { name: meta.name, description: meta.description, input_schema: meta.inputSchema },
  ];
}

/** Execute by name across the tool set — the loop's `ToolExecutor`. */
export function toolExecutor(
  tools: Array<{ name: string; execute: (raw: unknown) => Promise<{ content: string; isError?: boolean }> | { content: string; isError?: boolean } }>,
): (name: string, input: Record<string, unknown>) => Promise<{ content: string; isError?: boolean }> {
  const byName = new Map(tools.map((t) => [t.name, t]));
  return async (name, input) => {
    const t = byName.get(name);
    if (!t) {
      // An off-list call is the model hallucinating a tool — answer as the host
      // would (R-GA-2: an off-catalog call is forbidden and stays that way).
      return { content: `forbidden: no such tool (${name})`, isError: true };
    }
    return t.execute(input);
  };
}
