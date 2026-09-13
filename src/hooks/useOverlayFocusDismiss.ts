// The dialog/menu contract for Grove's overlays (R3-608, R-IX-1): focus moves
// IN on open, Tab is trapped while open (unless the surface is a menu — menus
// do not trap Tab), Escape closes only the TOP of a module-level stack, and
// focus RETURNS to the element that opened the overlay. The stack exists
// because the surfaces overlap (GroveNav's own comment names drawer, search
// and theme menu as shared interactive state): one Escape closes one overlay.

import { useEffect, useRef } from 'react';

/** Elements that can hold focus inside the overlay. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The open-overlay stack, newest last. Only the top entry answers Escape —
 *  a nested pair closes one per key, never both at once. */
const stack: { close: () => void }[] = [];

interface OverlayFocusDismissOptions {
  /** Menus do not trap Tab (the APG menu pattern keeps Tab as leave); dialogs
   *  do. Default true. */
  trapTab?: boolean;
}

/**
 * Wire the contract to an overlay root. Attach the returned ref to the element
 * that bounds the overlay (its panel/menu box).
 *
 * @param open    the overlay's open state — the effect arms on true and cleans
 *                up (returning focus) on false/unmount.
 * @param onClose Escape's meaning: close without committing.
 */
export function useOverlayFocusDismiss(
  open: boolean,
  onClose: () => void,
  opts: OverlayFocusDismissOptions = {},
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // The latest close callback, kept current in an effect (never a render-time
  // ref write — the react-hooks compiler forbids it, correctly).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const trapTab = opts.trapTab !== false;

  useEffect(() => {
    if (!open) return;
    // The trigger to return to, captured BEFORE focus moves in.
    const trigger = document.activeElement as HTMLElement | null;
    const entry = {
      close: () => onCloseRef.current(),
    };
    stack.push(entry);
    const root = rootRef.current;
    const focusables = root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
    // Focus IN: the first control; a panel with no focusable content takes
    // focus itself so Escape has a home.
    (focusables[0] ?? root)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      const isTop = stack[stack.length - 1] === entry;
      if (e.key === 'Escape') {
        if (!isTop) return; // a nested overlay above owns this key
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (!trapTab && e.key === 'Tab') {
        // APG Menu: Tab is LEAVE — the focus move proceeds (no preventDefault)
        // and the menu closes behind it, never stranded over a scrim.
        if (isTop) onCloseRef.current();
        return;
      }
      if (!trapTab || e.key !== 'Tab' || !root) return;
      const list = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'));
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Capture phase: the contract runs before any app-level key handling.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      // Focus RETURNS to the trigger (R-IX-1). Guarded: it may be gone.
      if (trigger && document.contains(trigger)) trigger.focus();
    };
  }, [open, trapTab]);

  return rootRef;
}
