# Creating a new Grove component

How to add a new **import-free MDX component** to this wiki — a piece of UI
vocabulary that any `.mdx` entry can use with no import line, like `<Callout>`,
`<DocList>`, or `<Toc>`. We build a real one end to end: **`<Quote>`**, a
pull-quote that can link back to the entry it came from.

This is written so a **human or a coding agent** can follow it verbatim. Every
step names the exact file and the convention behind it.

## What "a component" means in Grove

Grove renders each entry's MDX against a fixed component vocabulary registered in
[`src/mdxComponents.ts`](../../src/mdxComponents.ts) (the `GROVE_MDX` map). Adding
a component means: write a React component, give it styles, and register it in
that map. After that, authors write `<Quote>…</Quote>` in any entry with no
import — `boot()` wires the map into the MDX provider.

There are five edits, always the same shape:

1. **The component** — `src/components/<Name>.tsx`
2. **The styles** — rules in `src/GroveApp.css`
3. **The registration** — one import + one line in `src/mdxComponents.ts`
4. **A demonstration** — use it in a content entry so it renders
5. **Verify** — `npm run build` + `npm run lint`, then look at it

## The hard rules (these break *only* on immediately.run if violated)

From [`CLAUDE.md`](../../CLAUDE.md) — the failure mode is "works in `vite dev`,
breaks in the sandbox," so honor them up front:

- **One component per file, default-exported**, named for what it renders.
- **A component file exports ONLY the component.** No mixing in exported
  constants/data/helpers — that trips React Fast Refresh and `npm run lint`
  fails. `interface`/`type` are erased at compile time and are fine. Put data in
  `src/data/`, helpers in `src/lib/`, hooks in `src/hooks/`.
- **Pull design tokens from `src/index.css`** (`--bg`, `--panel`, `--ink`,
  `--accent`, `--grad`, `--r-lg`, the `--disp`/`--sans`/`--mono` families, …).
  Don't hard-code colors, radii, or fonts. Apply the signature gradient to text
  with `className="grad-text"`. **No emoji**; icons come from `<Icon>` (Lucide).
- **No Node / build-only APIs** in the rendered tree — it runs in a browser
  iframe. `localStorage`, `document`, `window`, `fetch` are available.

## Step 1 — Write the component

Create `src/components/Quote.tsx`. Note how it **reuses `<WikiLink>`** for the
source link instead of hand-rolling an `href` — `WikiLink` resolves a content
path to the right in-app link and renders the correct *resolved / broken / self*
state, so a moved or deleted target degrades gracefully instead of 404-ing.

```tsx
import type { ReactNode } from 'react';
import WikiLink from './WikiLink';

interface Props {
  /** Attribution — a person, role, or document. Rendered in mono as "— cite". */
  cite?: string;
  /** Wiki path of the entry the quote is drawn from, e.g.
   *  "content/handbook/onboarding.mdx". When set, a "Source →" link is shown. */
  source?: string;
  children?: ReactNode;
}

export default function Quote({ cite, source, children }: Props) {
  const href = source ? (source.startsWith('/') ? source : `/${source}`) : null;
  return (
    <figure className="grove-quote">
      <blockquote className="grove-quote__body">{children}</blockquote>
      {(cite || href) && (
        <figcaption className="grove-quote__cap">
          {cite ? <span className="grove-quote__cite">{cite}</span> : null}
          {href ? (
            <WikiLink href={href} className="grove-quote__src">
              Source →
            </WikiLink>
          ) : null}
        </figcaption>
      )}
    </figure>
  );
}
```

Conventions worth copying:

- **Props are an `interface`** (erased at compile time — does not violate the
  "components only" rule). Make optional props genuinely optional and degrade
  when absent (`<Quote>` works with no `cite` and no `source`).
- **Link into the wiki via `<WikiLink>`**, not a raw `<a>`. `WikiLink` wants an
  href like `/content/handbook/onboarding.mdx`; we normalize the author-facing
  `source="content/…"` to that. Path translation helpers (key ↔ href ↔ repo-rel)
  live in [`src/lib/content.ts`](../../src/lib/content.ts) if you need them.
- **Reach for existing components** (`<Icon>`, `<WikiLink>`) before writing new
  primitives.

## Step 2 — Style it with tokens

Grove **centralizes component styles** in
[`src/GroveApp.css`](../../src/GroveApp.css) (imported once from `App.tsx`) — the
existing `.grove-callout`, `.grove-lede`, `.grove-wikilink` rules all live there.
Add your block there too (don't add a per-component `import './Quote.css'`; the
centralized sheet is the established pattern and is guaranteed to be present at
runtime).

Use **only tokens** so light, dark, and the alternate themes all work for free:

```css
/* pull-quote */
.grove-quote {
  position: relative;
  margin: 22px 0;
  padding: 22px 24px 20px 28px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  overflow: hidden;
}
.grove-quote::before {                 /* gradient accent spine */
  content: "";
  position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: var(--grad);
}
.grove-quote__body {
  font-family: var(--disp); font-weight: 500;
  font-size: 1.18rem; line-height: 1.5; color: var(--ink);
  font-style: normal; border: 0; margin: 0; padding: 0;
}
.grove-quote__body::before {           /* large gradient opening quote mark */
  content: "\201C";
  font-family: var(--disp); font-weight: 900; font-size: 3.2rem; line-height: 0.1;
  margin-right: 0.06em; vertical-align: -0.42em;
  background: var(--grad); -webkit-background-clip: text; background-clip: text;
  color: transparent;
}
.grove-quote__cap {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px;
  margin-top: 14px; font-family: var(--mono); font-size: 0.8rem;
}
.grove-quote__cite { color: var(--ink-2); }
.grove-quote__cite::before { content: "— "; color: var(--ink-3); }
.grove-quote__src {
  color: var(--accent); white-space: nowrap;
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  transition: 0.12s;
}
.grove-quote__src:hover { border-bottom-color: var(--accent); }
.grove-quote__cap .grove-wikilink { font-family: var(--mono); font-size: 0.8rem; }
```

Because every value is a token (`--grad`, `--accent`, `--panel`, `--ink`,
`--line`, `--r-lg`, `--mono`), the component inherits the active theme — no
light-mode special-casing needed.

## Step 3 — Register it

In [`src/mdxComponents.ts`](../../src/mdxComponents.ts), add the import and put
the component in the `GROVE_MDX` map:

```diff
 import WikiLink from './components/WikiLink';
+import Quote from './components/Quote';
 import Toc from './components/Toc';
 …
   Directory,
+  Quote,
   Toc,
```

That single map is the whole vocabulary — once it's in there, every entry can use
`<Quote>` with no import.

## Step 4 — Demonstrate it

Use the component in a real entry so it renders and you can eyeball it. We added
one to [`content/home.mdx`](../../content/home.mdx):

```mdx
<Quote cite="Meridian onboarding guide" source="content/handbook/onboarding.mdx">
Your first week is about meeting people and shipping one small thing — not reading every page of the handbook.
</Quote>
```

## Step 5 — Verify

Run Grove's own gate — both must pass:

```bash
npm run build   # tsc -b && vite build — no type errors
npm run lint    # eslint — proves the Fast Refresh "components only" rule holds
```

Then **see it actually render** (not just compile):

- Quick local check: `npm run dev` (Vite) and open the home page.
- Real check on the platform — exercise the actual sandbox + MDX provider, which
  is where the "works locally, breaks on immediately.run" class of bug shows up.
  Serve the working tree with the CLI and open the printed link:

  ```bash
  immediately.run dev . --origin https://local.immediately.run --json
  # open the printed /present/local/<name>-<hash>/grove/live#… link
  ```

  Edits on disk hot-reload in the preview. For the worked example you should see
  the pull-quote with its gradient spine and a **"Source →"** link that resolves
  to the onboarding entry.

## Step 6 — Contribute

`immediately.run dev` is read-only and never writes your repo; your edits are the
files you changed on disk. Commit and open a PR the normal way:

```bash
git checkout -b quote-component
git add src/components/Quote.tsx src/GroveApp.css src/mdxComponents.ts content/home.mdx
git commit -m "Add <Quote> pull-quote component"
git push -u origin quote-component
```

## Checklist (copy this for the next component)

- [ ] `src/components/<Name>.tsx` — one default-exported component, **only** the
      component exported, props as an `interface`, degrades when optional props
      are absent.
- [ ] Links into the wiki go through `<WikiLink>` (resolved/broken/self), not raw
      `<a>`/hand-rolled hrefs.
- [ ] `.grove-<name>` styles added to `src/GroveApp.css` using **tokens only**
      (no hard-coded colors/radii/fonts), no emoji.
- [ ] Imported + added to `GROVE_MDX` in `src/mdxComponents.ts`.
- [ ] Used in a content entry as a live demo.
- [ ] `npm run build` and `npm run lint` pass; rendered and eyeballed (ideally on
      immediately.run, both light and dark).
