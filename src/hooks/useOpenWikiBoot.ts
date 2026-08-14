// Boot resolution for the `open-wiki` provider (R3-169).
//
// Grove has two packagings and this is where they diverge, ONCE, before anything reads
// the corpus:
//
//   • FORK      — engine and corpus in one repo. No task input ever arrives; the content
//                 root stays `/app/content/` and this hook is a no-op.
//   • DISPATCH  — a caller invoked `open-wiki` with a directory delegation. The host
//                 mounts the corpus at a task-scoped chroot and we re-point the content
//                 root at it before the first entry renders.
//
// The distinction has to be settled BEFORE render, not during it: every helper that
// answers "is this key an entry / what is its href / which layouts wrap it" is built on
// the root, so a component that renders while the root is still the default would resolve
// against the VIEWER's corpus and then not re-resolve. Hence a gate, not a fallback.

import { useEffect, useState } from 'react';
import { useMounts, getAppMountPath } from '@immediately-run/sdk/mounts';
import { useTaskInput, cancelTask } from '@immediately-run/sdk/tasks';
import { setContentRoot, isDispatched, isContentReadOnly } from '../lib/contentRoot';
import { resolveOpenWiki, openWikiFailureMessage } from '../lib/openWiki';

/** How long a callee waits for its delegated mount before cancelling. Long enough for the
 *  host's mount announcement to land after the overlay mounts, short enough that a reader
 *  is not left looking at a blank frame until the §5.7.1 liveness bound fires. */
const MOUNT_GRACE_MS = 5_000;

export interface OpenWikiBoot {
  /** `fork` — render our own corpus · `waiting` — a callee whose mount hasn't arrived ·
   *  `ready` — the delegated root is set · `failed` — cancelled, show the message. */
  status: 'fork' | 'waiting' | 'ready' | 'failed';
  message: string;
  readOnly: boolean;
}

export function useOpenWikiBoot(): OpenWikiBoot {
  const input = useTaskInput();
  const mounts = useMounts();
  const [failed, setFailed] = useState('');
  const [gaveUp, setGaveUp] = useState(false);

  const resolution = resolveOpenWiki(input, mounts ?? [], getAppMountPath());
  if (resolution.ok) {
    // Setting the root is what makes the corpus readable, so it happens in render — an
    // effect would run AFTER the first content render, which is the whole failure this
    // gate exists to prevent. Idempotent and purely derived, so a StrictMode double
    // render sets the same value twice.
    setContentRoot(resolution.root, { readOnly: resolution.readOnly });
  }

  // The module IS the latch: once a root is set, the delegation is final for the life of
  // the instance. Deriving "resolved" from it rather than from local state is what stops
  // a momentarily empty mount set from cancelling a task that is already open and being
  // read — and it needs no ref, which the render rules would not allow anyway.
  const resolved = isDispatched();

  // ⚠ The repo-load form has a race the task form does not, and getting it wrong shows the
  // reader the WRONG CORPUS.
  //
  // A task callee always has a `useTaskInput()`, so "no input" reliably meant "a fork". On a
  // cold URL load there is no input either way, and the corpus mount is announced by a host
  // effect — so at first render "fork" and "dispatched, mount not yet announced" are the
  // same observation. Rendering the fork answer means flashing the VIEWER's own corpus at
  // someone who asked for a different one.
  //
  // The mount set itself disambiguates: the app's own repo mount is always announced, so an
  // EMPTY set means the announcement has not happened yet, not that there is nothing to
  // announce. Wait for it — and if it never comes, fall through to the fork rather than
  // hanging, because a fork with an unusual mount story is still a wiki we can render.
  const mountsAnnounced = (mounts?.length ?? 0) > 0;
  const undecided = !resolved && !resolution.ok && !input && !mountsAnnounced && !gaveUp;
  const pendingReason = resolved || resolution.ok || !input ? null : resolution.reason;

  // The cold-load wait: bounded, and it ends in the FORK answer rather than an error.
  useEffect(() => {
    if (!undecided) return;
    const t = setTimeout(() => setGaveUp(true), MOUNT_GRACE_MS);
    return () => clearTimeout(t);
  }, [undecided]);

  useEffect(() => {
    if (!pendingReason) return;
    // A callee whose delegation never arrives must not silently render its OWN corpus —
    // the reader asked for THEIR folder. Give the mount a moment (it arrives on a host
    // message just after the overlay mounts), then cancel with a typed error so the
    // caller's `invokeTask` rejects `cancelled` instead of hanging to the liveness bound.
    const t = setTimeout(() => {
      setFailed(openWikiFailureMessage(pendingReason));
      cancelTask();
    }, MOUNT_GRACE_MS);
    return () => clearTimeout(t);
  }, [pendingReason]);

  if (failed) return { status: 'failed', message: failed, readOnly: false };
  if (resolved) return { status: 'ready', message: '', readOnly: isContentReadOnly() };
  if (undecided) return { status: 'waiting', message: '', readOnly: false };
  if (!input) return { status: 'fork', message: '', readOnly: false };
  return { status: 'waiting', message: '', readOnly: false };
}
