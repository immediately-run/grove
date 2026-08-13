/* eslint-disable @typescript-eslint/no-explicit-any */
import { useContext, useEffect } from 'react';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';
import { fragmentOf, resolveFragmentTarget } from '../lib/fragment';

/**
 * Land a deep-link on its section.
 *
 * **Mounted inside the entry body it belongs to** (`SafeEntryBody`), which is the whole
 * trick. The obvious placement — up in `PageView`, watching for the new content to arrive —
 * does not work: the component is unmounted by the very transition it is waiting on.
 * Measured on the real host, it polled 159 times and was torn down at the exact moment the
 * new body committed, so it never saw the thing it existed to see. Rendered *within* the
 * body, it mounts because the content did; the first attempt succeeds and there is nothing
 * to wait for.
 *
 * The target is still resolved against `data-entry` rather than looked up blindly, because
 * the outgoing document lingers briefly during a navigation and every document in this
 * corpus numbers its sections from 1 — `#sec-4` exists in almost all of them, so an
 * unscoped lookup can land on the page you just left (R3-249).
 *
 * Requires a host that forwards the fragment (`site-main` #272). Before that fix
 * `navigationState.hash` was always empty inside the sandbox, and no app could do this at
 * all. The SDK's own `<ScrollAfterNavigation>` is not used: it scrolls on its first hit and
 * returns, and with repeated section ids that first hit is the outgoing document's.
 */
export default function ScrollToFragment({ entryKey }: { entryKey: string }) {
  const ctx = useContext(TinkerableContext) as any;
  const hash = ctx?.navigationState?.hash ?? '';
  const frag = fragmentOf(hash);

  useEffect(() => {
    if (!frag || typeof document === 'undefined') return;
    let done = false;

    const attempt = () => {
      if (done) return true;
      const el = resolveFragmentTarget(document, entryKey, frag);
      if (!el) return false;
      el.scrollIntoView();
      done = true;
      return true;
    };

    // The first attempt succeeds on the safe path — that effect runs after the body has
    // committed. On the COMPILED path it cannot: `<Include>` owns an internal Suspense, so
    // this mounts while the entry is still being compiled in-browser, and the retry is the
    // whole mechanism rather than a fallback.
    //
    // The window is sized from measurement, not taste (R3-252). Time from mount to a
    // rendered body on the real host: ~2.6s for a 3K entry, ~12s for 37K, ~24s for the
    // 282K `UI_AS_APPS_SPEC`. The old 5s bound was tuned for the safe renderer (~2–10s)
    // and silently expired mid-compile on any large spec — the citation landed on the
    // page and never reached the section. 30s clears the largest entry with margin;
    // polling is 200ms, it stops on the first success, and it cannot outlive the entry.
    if (attempt()) return;
    const timer = setInterval(() => { if (attempt()) clearInterval(timer); }, 200);
    const stop = setTimeout(() => clearInterval(timer), 30_000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [entryKey, frag]);

  return null;
}
