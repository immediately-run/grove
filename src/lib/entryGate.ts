// Whether the entry body must still wait (MDX_FROM_MOUNT_SPEC D8).
//
// Pending while any file that decides how the entry renders is unread, or while the
// stylesheets home declares are still loading (D7) — the page paints once, styled.
import type { CorpusScanGate } from './corpusScan';

export function entryPending(
  critical: readonly string[],
  isSettled: CorpusScanGate['isSettled'],
  stylesheets: 'loading' | 'ready',
): boolean {
  return stylesheets === 'loading' || critical.some((key) => !isSettled(key));
}
