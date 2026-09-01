// Transcript mapping (GROVE_AGENT_SPEC S2): the loop's AgentMessage[] → the rows
// the panel renders. Tool traffic becomes compact activity rows ("read
// wiki/security.mdx", "queried the index") — the model's own text streams as
// assistant rows, and nothing from a tool result is rendered unfenced into the
// transcript surface.

import type { AgentMessage } from '@immediately-run/sdk';
import { READ_ENTRY_TOOL_NAME } from './agentTools';
import { METADATA_QUERY_TOOL_NAME } from '@immediately-run/sdk';

export type AgentRow =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'activity'; text: string };

/** One tool call, as a line the reader can scan. */
export function toolActivityLine(name: string, input: Record<string, unknown>): string {
  if (name === READ_ENTRY_TOOL_NAME) return `read ${String(input.path ?? '?')}`;
  if (name === METADATA_QUERY_TOOL_NAME) {
    const w = input.where;
    if (Array.isArray(w) && w.length) {
      const first = w[0] as { key?: unknown; value?: unknown };
      return `queried the index — ${String(first.key ?? '')} ${String(first.value ?? '')}`.trim();
    }
    return 'queried the index';
  }
  return name;
}

export function transcriptToRows(messages: AgentMessage[]): AgentRow[] {
  const rows: AgentRow[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      const toolResults = m.content.filter((b) => b.type === 'tool_result');
      if (toolResults.length) continue; // activity, rendered at its tool_use site
      const text = m.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('');
      if (text.trim()) rows.push({ kind: 'user', text: text.trim() });
    } else {
      const blocks = m.content;
      for (const b of blocks) {
        if (b.type === 'text' && b.text.trim()) rows.push({ kind: 'assistant', text: b.text.trim() });
        else if (b.type === 'tool_use') rows.push({ kind: 'activity', text: toolActivityLine(b.name, b.input) });
      }
    }
  }
  return rows;
}
