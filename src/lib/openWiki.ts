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

/** The mount `type` the host stamps on a corpus it dispatched by REPO LOAD (R3-172).
 *
 *  A cold URL load has no task invocation, so there is no `useTaskInput()` to learn from —
 *  the mount itself has to carry the role. We key on this mark and NOT on "the only foreign
 *  mount", which reads as clever and guesses wrong the moment the reader also holds a space
 *  or a worktree. If the host did not mark it, we are not dispatched. */
export const CONTENT_MOUNT_TYPE = 'content';

export type OpenWikiResolution =
  | {
      ok: true;
      root: string;
      readOnly: boolean;
      via: 'task' | 'repo-load';
      /** The corpus mount's id — what an onward delegation names (R3-266). Falls back to
       *  the mount PATH, which is exactly what the host publishes as the id for a task
       *  chroot (`mintDelegations` uses the mount point as the descriptor id). */
      mountId: string;
    }
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
  // REPO-LOAD dispatch (R3-172): the URL named a content repo, the host resolved this
  // viewer through the binding table and published the corpus as a marked mount. There is
  // no task to be a callee of — checked FIRST, because a repo-load dispatch has no task
  // input and would otherwise fall out as `not-a-callee` and render our own corpus.
  const marked = mounts.find((m) => m.type === CONTENT_MOUNT_TYPE);
  if (marked) {
    return {
      ok: true,
      root: marked.path,
      readOnly: marked.mode === 'ro',
      via: 'repo-load',
      mountId: marked.id ?? marked.path,
    };
  }

  if (!input) return { ok: false, reason: 'not-a-callee' };
  if (input.task !== OPEN_WIKI_TASK) return { ok: false, reason: 'wrong-task' };

  const foreign = mounts.filter((m) => m.path !== appMountPath && !m.path.startsWith(`${appMountPath}/`));
  const byParam = foreign.filter((m) => m.path === `/${DIR_PARAM}` || m.path.endsWith(`/${DIR_PARAM}`));
  const hit = byParam[0] ?? (foreign.length === 1 ? foreign[0] : undefined);
  if (!hit) return { ok: false, reason: 'no-mount' };

  // `mode` is absent on the primary repo mount and rw by default elsewhere. A read-only
  // delegation is a legitimate way to share a corpus — the reader still reads — so it
  // resolves normally and only the WRITE affordances consult this flag.
  return { ok: true, root: hit.path, readOnly: hit.mode === 'ro', via: 'task', mountId: hit.id ?? hit.path };
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
