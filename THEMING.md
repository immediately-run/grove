# Theming Grove

A Grove theme is **token-only**: one block of custom properties, no selectors, no
`url()`, no `@font-face` — nothing but declarations. This file is the single place
the contract is stated; `scripts/check-theme-token-only.mjs` enforces it in
`npm run verify`.

## The four looks

| id | opens in | reading face |
|---|---|---|
| `default` | dark | Public Sans (Gabarito display, Space Mono details) |
| `archive` | light | Source Serif 4 — dense, contents-forward |
| `journal` | light | Lora — warm, short measure |
| `editorial` | dark | Public Sans — loud through weight and colour |

Every look ships **both polarities**; the reader (or the host's own light/dark)
picks within it, and a corpus declares its own with `theme: <id>` on the home
entry (`frontmatter.engine` owns the key). Precedence: reader override → author
declaration → `default`; polarity: reader → host → the theme's preferred.

## The token surface

The palette (`--bg --panel --panel-2 --line --line-2 --ink --ink-2 --ink-3
--accent --accent-2 --accent-3 --grad --glow --wash`), the type roles
(`--disp --sans --mono` — `--sans` is the body face *whatever face that is*;
`archive` puts a serif in it), and the shape/reading knobs (`--disp-weight
--prose-measure --prose-leading --radius-shape`).

Two structural sets are **engine-owned**, never a theme's: the radii ladder
(`--r-xs … --r-pill`) and the shadow set — a theme reaches the visual radius
through `--radius-shape`.

## Faces and images are declared, never named

A theme that changes the reading face declares it (`src/data/themeFonts.ts`:

```ts
fonts: [{ family: 'Lora', src: '/app/assets/fonts/lora-latin-400-normal.woff2', weight: '400' }]
```

) and the **engine** reads the bytes and mints a `blob:` `@font-face` in the
`grove.engine` cascade layer. `blob:` passes `img-src`, `font-src` and `style-src`
in every composition mode, and nothing breaks offline. A remote `@import` is the
withdrawn exception — it fails both of those properties. Named image assets work
the same way (`assets:` → `--asset-<name>`).

## Contrast is checked, not eyeballed

`scripts/check-theme-contrast.mjs` asserts AA floors (body ink tiers 4.5:1 on
every ground; accent 3:1) for every catalogue theme in both polarities, from the
declared tokens, on every `npm run verify`. A palette that misses the floor fails
the build.

## Where themes live

The catalogue (`src/data/themes.ts`) and the token blocks
(`src/GroveApp.css`, `[data-grove-theme="<id>"]` + its polarity pair) must agree —
the contrast check reads both and fails if they drift. The composition modes
(fork · dispatch · pinned library) are described in the
[README](./README.md); the engine/content boundary in
[`docs/ENGINE_BOUNDARY.md`](./docs/ENGINE_BOUNDARY.md).
