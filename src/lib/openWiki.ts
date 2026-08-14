// The `open-wiki` provider (R3-169) — Grove as a task callee.
//
// A caller that finds `opensWith: { task: 'open-wiki' }` on a directory it can read
// invokes the contract with `dir: capDir(...)`. The host attenuates that against the
// CALLER's own grants, mints a task-scoped chroot, and mounts it for us. So everything
// below is downstream of authority we never asked for and cannot widen: the mount IS the
// grant (`docs/specs/REPO_CONTENT_DISPATCH_SPEC.mdx` §1/§4, UI_AS_APPS_SPEC §5.7).
//
// The marker named the CONTRACT, not this app — the host's binding table chose Grove and
// a user can rebind it to their own fork. Nothing here may assume it is the only viewer.

import type { SandboxMount } from '@immediately-run/sdk/mounts';
import type { TaskInput } from '@immediately-run/sdk/tasks';

/** The contract this module provides, and the param carrying the corpus. */
export const OPEN_WIKI_TASK = 'open-wiki';
export const DIR_PARAM = 'dir';

export type OpenWikiResolution =
  | { ok: true; root: string; readOnly: boolean }
  | { ok: false; reason: 'not-a-callee' | 'wrong-task' | 'no-mount' };

/**
 * Where the delegated corpus is, from the task input and the mount set — pure, so the
 * whole resolution is testable without a host.
 *
 * The host mounts a directory delegation at `/task/<slot>/<paramKey>` (§5.7: for a DIR
 * cap the mount point *is* the directory), so the param name is the hook. We match on the
 * path SUFFIX rather than reconstructing the slot, because the slot is the host's to
 * name and reconstructing it here would couple this app to a private path grammar.
 *
 * The single-non-app-mount fallback exists because that coupling is the failure we can't
 * see: if the host ever renames the segment, suffix-matching alone would resolve to
 * nothing and Grove would cancel a task the user really did ask for. One unambiguous foreign
 * mount is not a guess.
 */
export function resolveOpenWiki(
  input: TaskInput | null,
  mounts: readonly SandboxMount[],
  appMountPath = '/app',
): OpenWikiResolution {
  if (!input) return { ok: false, reason: 'not-a-callee' };
  if (input.task !== OPEN_WIKI_TASK) return { ok: false, reason: 'wrong-task' };

  const foreign = mounts.filter((m) => m.path !== appMountPath && !m.path.startsWith(`${appMountPath}/`));
  const byParam = foreign.filter((m) => m.path === `/${DIR_PARAM}` || m.path.endsWith(`/${DIR_PARAM}`));
  const hit = byParam[0] ?? (foreign.length === 1 ? foreign[0] : undefined);
  if (!hit) return { ok: false, reason: 'no-mount' };

  // `mode` is absent on the primary repo mount and rw by default elsewhere. A read-only
  // delegation is a legitimate way to share a corpus — the reader still reads — so it
  // resolves normally and only the WRITE affordances consult this flag.
  return { ok: true, root: hit.path, readOnly: hit.mode === 'ro' };
}

/** The message a failed resolution should show, in the reader's terms rather than the
 *  protocol's. `not-a-callee` never surfaces — it is the ordinary fork boot. */
export function openWikiFailureMessage(reason: Exclude<OpenWikiResolution, { ok: true }>['reason']): string {
  switch (reason) {
    case 'wrong-task':
      return 'This viewer was opened with a task it does not provide.';
    case 'no-mount':
      return 'The folder to open was not delivered. Try opening it again.';
    default:
      return '';
  }
}
