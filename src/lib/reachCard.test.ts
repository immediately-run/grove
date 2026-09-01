// R-GA-1 / G-GA-1 / G-GA-6 / G-GA-10 — the reach card is a pure function of the
// envelope; no pixel claims a capability the session lacks, causes are distinct and
// concrete, and state flips recompute rows AND chips.
import { describe, it, expect } from 'vitest';
import { computeReachRows, reachChips, showEgressDisclosure } from './reachCard';
import type { ChatProviderState } from '@immediately-run/sdk';

const configured = (tools = true): ChatProviderState => ({
  status: 'configured',
  provider: { providerId: 'llm.chat.anthropic', hostVouched: true, features: { vision: false, tools, jsonMode: true, reasoning: false, maxContextTokens: 100000 } },
});

const row = (rows: ReturnType<typeof computeReachRows>, key: string) => rows.find((r) => r.key === key)!;

describe('G-GA-10 — the Q&A row renders the provider three-state honestly', () => {
  it('unknown renders NEUTRAL — no cause, no connect copy (the R3-300 rule)', () => {
    const rows = computeReachRows({ providerState: { status: 'unknown' }, chatGranted: true, writable: true, sourceShared: true });
    expect(row(rows, 'answer').state).toBe('neutral');
    expect(row(rows, 'answer').cause).toBeUndefined();
  });

  it('not-configured names the KEY cause; ungranted names the CONSENT cause — never conflated', () => {
    const noKey = computeReachRows({ providerState: { status: 'not-configured' }, chatGranted: true, writable: true, sourceShared: false });
    expect(row(noKey, 'answer').state).toBe('blocked');
    expect(row(noKey, 'answer').cause).toContain('add one in Settings');

    const forbidden = computeReachRows({ providerState: configured(), chatGranted: false, writable: true, sourceShared: false });
    expect(row(forbidden, 'answer').state).toBe('blocked');
    expect(row(forbidden, 'answer').cause).toContain("wasn't granted chat");
    expect(row(forbidden, 'answer').cause).not.toContain('Settings');
  });

  it('configured + granted is ✓ and carries the read-flavored chips', () => {
    const ok = computeReachRows({ providerState: configured(), chatGranted: true, writable: false, sourceShared: false });
    expect(row(ok, 'answer').state).toBe('ok');
    expect(row(ok, 'answer').chips).toBeDefined();
  });
});

describe('G-GA-1 — the read/draft/apply rows derive from writability, never copy', () => {
  it('read-only blocks Draft with the reader cause and yields NO write chip', () => {
    const rows = computeReachRows({ providerState: configured(), chatGranted: true, writable: false, sourceShared: false });
    expect(row(rows, 'draft').state).toBe('blocked');
    expect(row(rows, 'draft').cause).toContain('reader');
    const chips = reachChips(rows);
    expect(chips.some((c) => /add an entry|fix broken|reorganize|timeline|suggest an edit/i.test(c))).toBe(false);
  });

  it('writable turns Draft ✓ — and its chip is a DESCRIBE, not an apply', () => {
    const rows = computeReachRows({ providerState: configured(), chatGranted: true, writable: true, sourceShared: false });
    expect(row(rows, 'draft').state).toBe('ok');
    expect((row(rows, 'draft').chips ?? []).join(' ')).toMatch(/suggest an edit/i);
  });

  it('Apply is NEVER ok from this panel (R-GA-3) — the cause says where changes go', () => {
    for (const writable of [true, false]) {
      const rows = computeReachRows({ providerState: configured(), chatGranted: true, writable, sourceShared: false });
      expect(row(rows, 'apply').state).toBe('blocked');
      expect(row(rows, 'apply').cause).toContain('editor / workbench');
    }
  });

  it('the shared-source sentence rides the Apply cause only when trust says others can write', () => {
    const shared = computeReachRows({ providerState: configured(), chatGranted: true, writable: true, sourceShared: true });
    expect(row(shared, 'apply').cause).toContain('treated as if others can write');
    const solo = computeReachRows({ providerState: configured(), chatGranted: true, writable: true, sourceShared: false });
    expect(row(solo, 'apply').cause).not.toContain('others can write');
  });
});

describe('G-GA-6 — envelope flips recompute rows and chips together', () => {
  it('disconnecting the provider flips answer ✓→blocked and drops its chips', () => {
    const before = computeReachRows({ providerState: configured(), chatGranted: true, writable: true, sourceShared: false });
    const after = computeReachRows({ providerState: { status: 'not-configured' }, chatGranted: true, writable: true, sourceShared: false });
    expect(row(before, 'answer').state).toBe('ok');
    expect(row(after, 'answer').state).toBe('blocked');
    expect(reachChips(after)).not.toContain('Summarize this entry');
  });

  it('revoking write flips draft ✓→blocked on the next computation', () => {
    const before = computeReachRows({ providerState: configured(), chatGranted: true, writable: true, sourceShared: false });
    const after = computeReachRows({ providerState: configured(), chatGranted: true, writable: false, sourceShared: false });
    expect(row(before, 'draft').state).toBe('ok');
    expect(row(after, 'draft').state).toBe('blocked');
  });
});

describe('R-GA-6 — the egress disclosure is unconditional when a provider is bound', () => {
  it('shows for configured, not for unknown or not-configured, whatever the trust mode', () => {
    expect(showEgressDisclosure(configured())).toBe(true);
    expect(showEgressDisclosure({ status: 'unknown' })).toBe(false);
    expect(showEgressDisclosure({ status: 'not-configured' })).toBe(false);
  });
});
