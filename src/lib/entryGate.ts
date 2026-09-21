// Whether the entry body must still wait (MDX_FROM_MOUNT_SPEC D8).
//
// Pending while any file that decides how the entry renders is unread, or while the
// stylesheets home declares are still loading (D7) — the page paints once, styled. And
// FAILED — not painted — when one of those files could not be read for a reason other than
// its absence: an unread home or entry reads as `render` unset, which is the executing
// path, so a transient failure must not quietly become "no frontmatter".
import type { CorpusScanGate } from './corpusScan';

export function entryPending(
  critical: readonly string[],
  isSettled: CorpusScanGate['isSettled'],
  stylesheets: 'loading' | 'ready',
): boolean {
  return stylesheets === 'loading' || critical.some((key) => !isSettled(key));
}

/** The reader-facing line for the first critical key whose read failed, or null. */
export function criticalFailure(
  critical: readonly string[],
  readFailure: CorpusScanGate['readFailure'],
): string | null {
  for (const key of critical) {
    const reason = readFailure(key);
    if (reason !== null) return `Could not read ${key} (${reason}). Reload to try again.`;
  }
  return null;
}
