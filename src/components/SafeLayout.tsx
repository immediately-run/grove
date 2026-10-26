import { Include } from '@immediately-run/sdk';
import { MDXProvider } from '@immediately-run/sdk/MDXProvider';
import { useSafeVocabulary } from '../hooks/useSafeVocabulary';

// A `_layout.mdx` rendered NON-EXECUTABLY — now a thin call to the PLATFORM's interpreter
// include rather than Grove's own reader. (R3-263: (a) built it here, (b) moved it into the
// SDK, this switch consumes it.)
//
// WHY THE LAYOUT NEEDS THIS AT ALL. `renderLayers` used to send every layer through
// `<Include>` — the compiled path — *regardless* of `render: safe`. So an interpreter-mode
// wiki still EXECUTED author JavaScript out of one content file, and the non-executable
// guarantee had a hole in the shell rather than in the entries. It was also inoperable under
// dispatch: the compiled path evaluates an app-source module, which a mount-resident layout
// is not.
//
// WHY IT IS NOW THE SDK'S JOB. The same capability is what whiteboard object bodies and the
// `AGENT_AUTHORING §10` MDX-from-mount gate need — a gate `TRUST_MODES §5.1` says MUST
// terminate in the safe renderer and never in compiled MDX. Keeping a second implementation
// here would let the platform path and the path Grove actually exercises drift apart; and
// because the SDK's own render-level coverage is bounded by its CJS test runner, this wiki
// exercising the real thing is what keeps the platform path honest.
//
// WHAT GROVE STILL OWNS: the component map, passed explicitly. It is the SHELL's vocabulary —
// the map `boot({ mdxComponents })` established, captured by App above the corpus's own
// provider (R3-1290, `hooks/useSafeVocabulary`) — layered by `lib/safeVocabulary` over the SDK
// defaults and the sanitizing structural tags (`lib/safeIntrinsics.tsx`); for stock Grove it
// is exactly `SAFE_MDX`. That is app policy and stays here.
//
// THE AUTHORING CONSTRAINTS ARE UNCHANGED and documented in `docs/ENGINE_BOUNDARY.md §6`:
// literal attributes only; an unregistered tag collapses to a Fragment that keeps its
// children; an `import` renders as visible prose rather than resolving; and a block tag must
// open on its own line or micromark consumes it as an HTML block.

/** Interpreter-mode layout layer: the raw `_layout.mdx` rendered as data (no author JS runs). */
export default function SafeLayout({ layoutKey }: { layoutKey: string }) {
  // The shell's vocabulary, as for entry bodies (R3-1290; `hooks/useSafeVocabulary`). The SDK's
  // interpreted include merges its `components` OVER the surrounding provider's map, which may
  // hold a corpus's declared components, so the include runs under a provider that does NOT
  // inherit: the interpreter then resolves exactly the shell's map, never the nearer one.
  const components = useSafeVocabulary();
  return (
    <MDXProvider components={components} disableParentContext>
      <Include filename={layoutKey} mode="interpreted" />
    </MDXProvider>
  );
}
