import { Suspense, use } from 'react';
import {
  SafeContent,
  RenderExportedComponentContext,
  useFileMetadata,
} from '@immediately-run/sdk';
import { SAFE_MDX } from '../mdxComponents';
import { keyToRepoRel } from '../lib/content';
import { safeSources } from '../lib/safeSources';
import ScrollToFragment from './ScrollToFragment';

// The NON-EXECUTABLE (interpreter) body renderer — TRUST_MODES §5.1 / R3-213. It reads
// the entry's RAW `.mdx` and renders it through the SDK safe renderer (parseSafeMdast +
// renderMdast): **no author JavaScript executes** — a stray `{fetch(...)}` in any entry
// is inert literal text. This is the alternative to `<Include>` (the executable/executor
// path, where compiled MDX runs) that `PageView` uses when the wiki is NOT in interpreter
// mode. The engine keeps BOTH; the wiki declares which via the home entry's `render:` flag,
// so a trusted first-party grove deployment can still use standard, executable MDX.
//
// Uniformity (R3-213): the component map is `SAFE_MDX` — the SDK's DEFAULT_MDX_COMPONENTS
// (the platform Admonition / WikiLink / HeadingAnchor, carrying the R3-212 deep-link
// resolver) merged UNDER the Grove vocabulary, the SAME merge `boot()` does for the compiled
// path — so the admonitions / wiki-links / `sec-…` heading ids the shared remark plugins emit
// render identically in both standards. Since R3-263 that map lives in `mdxComponents.ts` and
// is shared with `SafeLayout`, so the body and the shell around it cannot resolve differently.
// We publish `RenderExportedComponentContext` with this entry's path so the WikiLink resolver
// learns the current file and a relative `[[target]]` (and its `#sec-…` fragment) resolves
// exactly as it does under `<Include>`.

/** Strip a leading YAML frontmatter block (and an optional BOM) so only the body reaches
 *  the safe renderer. */
function stripFrontmatter(src: string): string {
  return src.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, "");
}

function SafeBody({ entryKey }: { entryKey: string }) {
  const raw = use(safeSources.read(keyToRepoRel(entryKey)));
  // Consume the entry's metadata so this re-renders if frontmatter changes (parity with
  // the compiled path's reactivity); the body itself is the stripped source.
  useFileMetadata(entryKey);
  const body = stripFrontmatter(raw);
  return (
    <RenderExportedComponentContext
      value={{ evaluationContext: { evaluation: { module: { filepath: entryKey } } } } as never}
    >
      {/* `data-entry` marks WHICH entry these bytes are, and it is rendered INSIDE the
          suspended subtree — so it flips only when the new body actually commits, never
          while the previous entry is still on screen. `<ScrollToFragment>` waits for it
          before scrolling. Without that signal a deep-link scrolls the OUTGOING document:
          every spec has `sec-1 … sec-N`, so the id the incoming page wants is already in
          the DOM, and a scroll fired at navigation time lands on the wrong page's section
          and is then thrown away by the re-render (R3-249). */}
      <div className="grove-entry-body" data-entry={entryKey}>
        <SafeContent source={body} components={SAFE_MDX as never} fallback={<div className="grove-prose__loading" />} />
        {/* Deep-link landing lives INSIDE the committed body, not outside watching for it.
            Mounted anywhere above this boundary it is unmounted by the very transition it
            is waiting on — measured on the real host: it polled 159 times and was torn
            down at the exact moment the new body arrived. Here it mounts *because* the
            content did, so there is nothing to wait for. */}
        <ScrollToFragment entryKey={entryKey} />
      </div>
    </RenderExportedComponentContext>
  );
}

/** Interpreter-mode entry body: the raw `.mdx` rendered as data (no author JS runs). */
export default function SafeEntryBody({ entryKey }: { entryKey: string }) {
  return (
    <Suspense fallback={<div className="grove-prose__loading" />}>
      <SafeBody entryKey={entryKey} />
    </Suspense>
  );
}
