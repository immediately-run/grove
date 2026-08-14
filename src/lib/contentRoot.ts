// WHERE THE CORPUS IS — the one place that answers it.
//
// Grove was written for a single packaging (Mode A, the FORK): engine and corpus ship
// from one repo, so the content root was the module constant `/app/content/` and every
// helper built on it inherited that assumption. Under DISPATCH the corpus is somebody
// else's repo, mounted at a host-minted chroot, and the engine is loaded from Grove's
// own repo — so the root is a RUNTIME value, and a constant is not merely inconvenient,
// it is wrong in a way that renders the viewer's own corpus while claiming to render
// yours (`docs/specs/REPO_CONTENT_DISPATCH_SPEC.mdx` §3; R3-169/R3-265).
//
// The root is resolved ONCE, before the first render, and never changes for the life of
// the instance: a task callee is invoked with one directory, and a fork reads its own.
// Deliberately module state rather than React context — the consumers are pure helpers
// (`lib/content.ts`, `lib/layout.ts`, `lib/wiki.ts`) that components call during render,
// and threading a context through them would put the render tree in the middle of a
// question that is settled at boot.
//
// **Call it, don't capture it.** `const dir = getContentRoot()` at module scope freezes
// the default before `setContentRoot` runs and silently restores the old bug — read it
// inside the function that needs it. `contentRoot.test.ts` pins that.

/** The fork packaging's root: the engine's own repo, at the sandbox's APP_ROOT. */
export const APP_CONTENT_ROOT = '/app/content/';

let root: string = APP_CONTENT_ROOT;
let readOnly = false;

/** Where this instance's corpus lives, with a trailing slash. Read at CALL time. */
export function getContentRoot(): string {
  return root;
}

/**
 * Point this instance at a corpus. Called once at boot — by the `open-wiki` task handler
 * with the delegated directory, or not at all (the fork, which keeps the default).
 * Normalizes the trailing slash so every `startsWith`/`slice` in the helpers holds.
 */
export function setContentRoot(dir: string, opts: { readOnly?: boolean } = {}): void {
  if (!dir) return;
  root = dir.endsWith('/') ? dir : `${dir}/`;
  readOnly = opts.readOnly ?? false;
}

/** Whether the mounted corpus was delegated read-only. Lives here rather than in React
 *  state because it is the same fact as the root — one delegation, decided at boot — and
 *  every consumer that asks "may I offer an edit?" already reads the root. */
export function isContentReadOnly(): boolean {
  return readOnly;
}

/** True when the corpus is NOT this app's own repo — i.e. we are a dispatched viewer.
 *  Surfaces where the two packagings genuinely differ (provenance, the edit target). */
export function isDispatched(): boolean {
  return root !== APP_CONTENT_ROOT;
}

/** Test-only: restore the fork default so cases don't leak into each other. */
export function resetContentRoot(): void {
  root = APP_CONTENT_ROOT;
  readOnly = false;
}
