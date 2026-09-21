// The files that decide how an entry renders — the ones a dispatched viewer must have READ
// before it paints the entry (MDX_FROM_MOUNT_SPEC D8).
//
// Everything else in the index feeds the surfaces AROUND the entry (nav, sidebar, search,
// backlinks, index components), which may fill in as the scan continues. These do not: the
// entry's own row carries `layout`, `view`, `frame` and a per-entry `render: safe`; home
// carries the wiki-wide `site`, `theme`, `render: safe` and `stylesheets`; the layouts on
// the entry's folder path are the chrome it renders inside. Painting before any of them is
// read either shows the wrong page or, for `render: safe`, runs code that must not run.
import { homeKey } from './content';
import { explicitFrameKey, layoutKeysOnPath } from './layout';

/**
 * The keys to read before `entryKey` paints, given the index as it stands. `metadata` holds
 * every LISTED key (read or not), so a layout that does not exist is never asked for. The
 * set grows once the entry's own row is read and turns out to name a `frame:` — the caller
 * recomputes on every index update, so it converges.
 */
export function criticalKeys(entryKey: string, metadata: Record<string, unknown>): string[] {
  const keys = [homeKey(), entryKey];
  for (const lk of layoutKeysOnPath(entryKey)) {
    if (lk in metadata) keys.push(lk);
  }
  const frame = explicitFrameKey(metadata[entryKey] as Record<string, unknown> | undefined);
  if (frame !== null && frame in metadata) keys.push(frame);
  return [...new Set(keys)];
}
