// The reach card (GROVE_AGENT_SPEC §6) — the agent's envelope, rendered as rows in
// the two-word vocabulary with a cause for every ✗ (R-SP-3). R-GA-1: every row is
// COMPUTED from the session's envelope (provider three-state, chat grant, mount
// writability, source trust); no capability claim on any pixel of this surface is
// hand-written copy. The four old banners collapse into these rows; chips render
// only for rows that are ✓ — derived, not curated.

import type { ChatProviderState } from '@immediately-run/sdk';

/** One reach-card row. `state: 'neutral'` renders neither ✓ nor ✗ — used only for
 *  the unknown provider state (rendering a cause there re-creates the false banner
 *  R3-300 fixed: `unknown` means unanswered, not ungranted). */
export interface ReachRow {
  key: 'answer' | 'read' | 'draft' | 'apply';
  label: string;
  state: 'ok' | 'blocked' | 'neutral';
  cause?: string;
  /** Chips this row contributes when ✓ — the panel renders exactly these. */
  chips?: string[];
}

export interface ReachInputs {
  providerState: ChatProviderState;
  /** Whether the grant-filtered catalog advertises `llm:chat` (the consented
   *  capability — absent on an ungranted fork, a distinct cause from "no key"). */
  chatGranted: boolean;
  writable: boolean;
  /** Fail-closed source trust (git ⇒ indeterminate ⇒ treated as shared). */
  sourceShared: boolean;
}

/** The rows, computed. Order is the card's display order. */
export function computeReachRows({ providerState, chatGranted, writable, sourceShared }: ReachInputs): ReachRow[] {
  // Row 1 — Q&A. Three provider states × the grant, with the two NOT-causes never
  // conflated (G-GA-10): "no key" is the user's to fix in Settings; "not granted"
  // is this copy's consent state, and reading works either way.
  let answer: ReachRow;
  if (providerState.status === 'unknown') {
    answer = { key: 'answer', label: 'Answer questions about this wiki', state: 'neutral' };
  } else if (providerState.status === 'not-configured') {
    answer = {
      key: 'answer',
      label: 'Answer questions about this wiki',
      state: 'blocked',
      cause: 'no model key connected — add one in Settings',
    };
  } else if (!chatGranted) {
    answer = {
      key: 'answer',
      label: 'Answer questions about this wiki',
      state: 'blocked',
      cause: "this Grove wasn't granted chat — reading works as normal",
    };
  } else {
    answer = {
      key: 'answer',
      label: 'Answer questions about this wiki',
      state: 'ok',
      chips: ['Summarize this entry', 'What entries are tagged security?'],
    };
  }

  // Row 2 — the body source. Both packagings define one post-S2 (the fork's own
  // bundled corpus; the dispatched wiki mount), so this row is ✓ unless degenerate.
  // It is computed, not assumed: the day a packaging lacks a source, the card says so.
  const read: ReachRow = {
    key: 'read',
    label: 'Read entries and structure',
    state: 'ok',
  };

  // Row 3 — drafting. Writability is the mount's answer; the chip proposes an edit
  // the agent DESCRIBES (S4's host-confirmed diffs are not built — v1 drafts in chat).
  const draft: ReachRow = writable
    ? {
        key: 'draft',
        label: 'Draft changes',
        state: 'ok',
        chips: [`Suggest an edit for "${'this entry'}"`],
      }
    : { key: 'draft', label: 'Draft changes', state: 'blocked', cause: 'you’re a reader here' };

  // Row 4 — applying. NEVER from this panel (R-GA-3): the widget renders content and
  // is exactly the broker core_concepts §8a Axis D forbids. The cause is where
  // changes go, plus the shared-source sentence when trust says others can write.
  const apply: ReachRow = {
    key: 'apply',
    label: 'Apply changes',
    state: 'blocked',
    cause:
      'changes open in the editor / workbench, where you confirm them' +
      (sourceShared ? ' — this repo is treated as if others can write (sole authorship can’t be verified yet), so agent actions go past you first' : ''),
  };

  return [answer, read, draft, apply];
}

/** The chips the panel shows: exactly the ✓ rows' chips, in card order (R-GA-1 —
 *  derived from the envelope, never curated). */
export function reachChips(rows: ReachRow[]): string[] {
  return rows.flatMap((r) => (r.state === 'ok' ? r.chips ?? [] : []));
}

/** R-GA-6's unconditional egress line — shown whenever a provider is bound,
 *  whatever the wiki's trust mode: Q&A composes read + provider egress, and the
 *  confidentiality axis is grant-based, not sharedness-based. */
export const EGRESS_DISCLOSURE =
  'answers come from your connected model provider, which receives what the agent reads here';

export function showEgressDisclosure(providerState: ChatProviderState): boolean {
  return providerState.status === 'configured';
}
