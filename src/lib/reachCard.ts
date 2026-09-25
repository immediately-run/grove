// The reach card (GROVE_AGENT_SPEC §6) — the agent's envelope, rendered as rows in
// the two-word vocabulary with a cause for every ✗ (R-SP-3). R-GA-1: every row is
// COMPUTED from the session's envelope (provider four-state, chat grant, mount
// writability, packaging, source trust); no capability claim on any pixel of this
// surface is hand-written copy. The four old banners collapse into these rows; chips
// render only for rows that are ✓ — derived, not curated.
//
// R3-752: a row whose outcome is a destination is not a denial — the apply row
// renders `→ elsewhere` (R-GA-3 still holds: never from this panel), the packaging
// substrate is its own neutral row, the source-trust sentence is its own line keyed
// on WHY the source reads as shared (R-SP-3/R-SP-6), and the tool-less degrade is a
// visible qualifier on the Q&A row instead of a silent downgrade (SPEC_AUDIT §2.8u).

import type { AgentContextBlock, ChatProviderState } from '@immediately-run/sdk';

/** Why `sourceShared` reads as it does — the SDK's own union, indexed off the
 *  exported block so the two can never drift (R6: one home, the SDK's). */
export type SourceSharedBasis = AgentContextBlock['sourceSharedBasis'];

/** The visually-hidden word for a row's state — one home for the map the panel
 *  renders per row and announces through its live region (R6). */
export function stateWord(state: ReachRow['state']): string {
  return state === 'ok' ? 'available' : state === 'blocked' ? 'unavailable' : state === 'elsewhere' ? 'opens elsewhere' : 'not applicable';
}

/** One reach-card row. `state: 'neutral'` renders neither ✓ nor ✗ — used only for
 *  the unknown provider state (rendering a cause there re-creates the false banner
 *  R3-300 fixed: `unknown` means unanswered, not ungranted) and, since R3-752, for
 *  the packaging row (substrate context, not a capability claim). `state:
 *  'elsewhere'` is the apply row: the outcome happens at another surface, which is
 *  where to go — never a ✗. */
export interface ReachRow {
  key: 'packaging' | 'answer' | 'read' | 'draft' | 'apply';
  label: string;
  state: 'ok' | 'blocked' | 'neutral' | 'elsewhere';
  cause?: string;
  /** Where a `'elsewhere'` row's outcome happens — rendered after `→`, never a ✗. */
  destination?: string;
  /** Chips this row contributes when ✓ — the panel renders exactly these. */
  chips?: string[];
}

export interface ReachInputs {
  providerState: ChatProviderState;
  /** Whether the grant-filtered catalog advertises `llm:chat` (the consented
   *  capability — absent on an ungranted fork, a distinct cause from "no key").
   *
   *  Since R3-688 this is the BELT, not the primary discriminator: a 0.72.0 host marks
   *  the grantless answer on the provider channel itself, and that mark is read first.
   *  But it is still checked BEFORE `not-configured`, not after, because a host
   *  predating the mark answers an ungranted fork with `{ provider: null }` — the same
   *  payload as keyless — so not-configured would otherwise win and send a user who HAS
   *  a key to Settings. See the ordering note in `computeReachRows` for the one
   *  imprecision that buys, and why gating this on "the catalog answered" does not fix
   *  it. */
  chatGranted: boolean;
  writable: boolean;
  /** Fail-closed source trust (git ⇒ indeterminate ⇒ treated as shared). Not
   *  rendered on any row since R3-752 — it is the source-trust LINE's input (see
   *  `sourceTrustLine`) — but part of the envelope, so the cross-product over the
   *  card's inputs can assert no input re-blocks the apply row. */
  sourceShared: boolean;
  /** The corpus mount id (`getCorpusMountId()`): `null` is a fork reading its own
   *  bundled corpus, an id is a wiki mounted into it. One fact, decided once at
   *  boot by the same delegation as the root — never a second source of truth. */
  mountId: string | null;
  /** Whether the configured provider advertises `features.tools`. `false` with a
   *  configured provider degrades the agent to context-stuffing (G-GA-8) — a real
   *  capability change the card must show, not hide (SPEC_AUDIT §2.8u). */
  toolsSupported: boolean;
}

/** The rows, computed. Order is the card's display order: the substrate first
 *  (context for every row under it), then the capability rows. */
export function computeReachRows({
  providerState,
  chatGranted,
  writable,
  mountId,
  toolsSupported,
}: ReachInputs): ReachRow[] {
  // Row 0 — packaging (R3-752). Context, not a claim: `neutral`, no chips, no
  // capability words. A pinned-library consumer is indistinguishable from a fork at
  // runtime and the distinction does not change reach, so the row states the
  // substrate — never a guess at how the app was assembled.
  const packaging: ReachRow = {
    key: 'packaging',
    label: mountId === null ? 'Reads its own entries' : 'Reads a wiki mounted into it',
    state: 'neutral',
  };

  // Row 1 — Q&A. The provider states × the grant, with the two NOT-causes never
  // conflated (G-GA-10): "no key" is the user's to fix in Settings; "not granted"
  // is this copy's consent state, and reading works either way. A configured
  // provider without `features.tools` keeps the ✓ — asking still works — and
  // carries the degrade as a qualifier (G-GA-8, SPEC_AUDIT §2.8u).
  //
  // R3-688: the host now marks the grantless answer on the provider channel itself
  // (`ungranted`), so the consent cause is computable even though an ungranted frame is
  // never told the provider — the host's grant decision IS the fact. The catalog check is
  // the BELT for a host predating the mark, and it is checked BEFORE not-configured
  // because a pre-mark host answers an ungranted fork with `{provider: null}` — the same
  // payload as keyless — so not-configured would win and send a user who has a key to
  // Settings.
  //
  // KNOWN IMPRECISION, grove#75 round 1, not fixable here. `useCatalog()` starts `[]` and
  // cannot distinguish "granted nothing" from "has not answered yet", and the provider
  // channel usually answers first — so between the two answers a keyless-but-GRANTED frame
  // reads `!chatGranted` and renders the consent cause for a moment before correcting.
  //
  // Gating the belt on `catalog.length > 0` does NOT fix it: an empty catalog is a
  // legitimate answer (a frame granted nothing), and the G-GA-10 case directly below in
  // `GroveAgent.test.tsx` pins exactly that state. Tried; it turns a permanent, correct ✗
  // into a permanent, unbacked ✓, which is the R-GA-1 violation the card exists to prevent.
  // The real fix is an answered/unanswered signal on the SDK's catalog channel; filed.
  //
  // Until then the transient errs toward claiming LESS capability than the session has,
  // which is the safe direction: R-GA-1 forbids claiming a capability the session lacks.
  let answer: ReachRow;
  const degrade = toolsSupported ? '' : ' (reads a summary of this wiki, not entries on demand)';
  if (providerState.status === 'unknown') {
    answer = { key: 'answer', label: 'Answer questions about this wiki', state: 'neutral' };
  } else if (providerState.status === 'ungranted' || !chatGranted) {
    answer = {
      key: 'answer',
      label: 'Answer questions about this wiki',
      state: 'blocked',
      cause: "this Grove wasn't granted chat — reading works as normal",
    };
  } else if (providerState.status === 'not-configured') {
    answer = {
      key: 'answer',
      label: 'Answer questions about this wiki',
      state: 'blocked',
      cause: 'no model key connected — add one in Settings',
    };
  } else if (providerState.status === 'configured') {
    answer = {
      key: 'answer',
      label: `Answer questions about this wiki${degrade}`,
      state: 'ok',
      chips: ['Summarize this entry', 'What entries are tagged security?'],
    };
  } else {
    // The ✓ arm is NARROWED to `configured` and this is the exhaustiveness check. The `||`
    // above defeats narrowing, so before R3-752 an open `else` meant a FIFTH provider
    // state would land on ✓ with chips — an unbacked capability claim (R-GA-1) that `tsc`
    // would not mention. A fourth state was just added; the fifth must be a compile error,
    // not a silent grant.
    const unreachable: never = providerState;
    void unreachable;
    answer = { key: 'answer', label: 'Answer questions about this wiki', state: 'neutral' };
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
  // is exactly the broker core_concepts §8a Axis D forbids. That is a DESTINATION,
  // not a denial — where to go, stated as one — so it renders `→`, never ✗. The
  // source-trust sentence does not ride here: it is a property of the source, and it
  // has its own line under the card (`sourceTrustLine`).
  const apply: ReachRow = {
    key: 'apply',
    label: 'Apply changes',
    state: 'elsewhere',
    destination: 'in the editor or workbench, where you confirm them',
  };

  return [packaging, answer, read, draft, apply];
}

/** The chips the panel shows: exactly the ✓ rows' chips, in card order (R-GA-1 —
 *  derived from the envelope, never curated). */
export function reachChips(rows: ReachRow[]): string[] {
  return rows.flatMap((r) => (r.state === 'ok' ? r.chips ?? [] : []));
}

/**
 * The source-trust line under the card (R3-752). It is a property of the SOURCE,
 * not of the apply row it used to be glued to, and its copy is chosen by WHY the
 * source reads as shared — a cause the reader can act on (R-SP-3), never a
 * classification (R-SP-6). `null` when the source is not shared: no line, no
 * reassurance about a regime that is not running.
 */
export function sourceTrustLine(shared: boolean, basis: SourceSharedBasis): string | null {
  if (!shared) return null;
  return basis === 'git-indeterminate'
    ? 'anyone who can push to this repo can change what the agent reads'
    : 'others can change what the agent reads here';
}

/** R-GA-6's unconditional egress line — shown whenever a provider is bound,
 *  whatever the wiki's trust mode: Q&A composes read + provider egress, and the
 *  confidentiality axis is grant-based, not sharedness-based. */
export const EGRESS_DISCLOSURE =
  'answers come from your connected model provider, which receives what the agent reads here';

export function showEgressDisclosure(providerState: ChatProviderState): boolean {
  return providerState.status === 'configured';
}
