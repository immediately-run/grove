#!/usr/bin/env node
// check-theme-contrast.mjs — AA contrast asserted from the DECLARED tokens, for
// every catalogue theme, in BOTH polarities (R3-308; 02-theme-contract §5).
//
// WHY A SCRIPT AND NOT A REVIEWER. The alternates are where contrast breaks — the
// default palette has had a year of eyes on it and new polarities have not — so
// the check belongs in `verify` against the token values in GroveApp.css, not in a
// reviewer's judgement. A prose rule is not checkable (ways_of_working §4).
//
// WHAT IT READS. The theme token blocks in src/GroveApp.css, by selector shape:
//
//   .grove-root                                      → default, dark (the base)
//   .grove-root[data-theme="light"]                  → default, light
//   .grove-root[data-grove-theme="X"]                → X, its PREFERRED polarity
//   .grove-root[data-grove-theme="X"][data-theme=Y]  → X, the OTHER polarity
//
// The BOTH-POLARITIES rule is enforced structurally: a theme seen in the CSS must
// resolve to exactly a light and a dark token map — a bare block with no paired
// [data-theme] sibling (single-polarity by construction, the exact bug R3-308
// fixes) fails the check.
//
// THE PAIRS TABLE is the contract's coverage floor, stated once and test-visible:
// body ink tiers on every ground at AA (4.5:1); accent on the page grounds at
// 3:1 (accent is Grove's large/bold register — headings, icons, controls; body
// text and links are ink). `--ink-3` is deliberately NOT floored: it is the
// de-emphasized tier (timestamps, metas) and even the default palette holds it
// below AA by design — pretending otherwise would fail every theme on day one
// and teach everyone to ignore the check.
//
// FAULT INJECTION. `--self-test` plants a sub-AA pair, a missing-polarity theme,
// and an unsupported colour, and asserts each fails for the reason claimed — a
// checker nobody has watched reject anything is an assumption, not a guard.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_PATH = join(root, 'src', 'GroveApp.css');

/** The coverage floor: [token, ground, minRatio]. Exported shape for the self-test. */
export const PAIRS = [
  ['--ink', '--bg', 4.5],
  ['--ink', '--panel', 4.5],
  ['--ink', '--panel-2', 4.5],
  ['--ink-2', '--bg', 4.5],
  ['--ink-2', '--panel', 4.5],
  ['--ink-2', '--panel-2', 4.5],
  ['--accent', '--bg', 3.0],
  ['--accent', '--panel', 3.0],
];

// ── colour: everything resolves to linear-light sRGB triplets ────────────────

/** Gamma-decode one sRGB channel (0..1). */
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** WCAG relative luminance of an sRGB triplet (0..1 each). */
function luminance([r, g, b]) {
  const [R, G, B] = [r, g, b].map(srgbToLinear);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** The WCAG contrast ratio between two opaque colours. */
export const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/** oklch(L C H) → sRGB (0..1, clamped to sRGB gamut). CSS Color 4 matrices. */
function oklchToSrgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  // Clamp to gamut: the declared accents are in-gamut; a future theme that isn't
  // gets the nearest sRGB colour, which is also what the browser renders.
  return [r, g, bl].map((v) => Math.min(1, Math.max(0, v)));
}

/**
 * Parse one CSS colour value into an sRGB triplet, or `null` when it is a shape
 * this checker does not floor (rgba()/gradients/none — the non-text tokens).
 */
export function parseColor(value) {
  const v = value.trim().toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  const ok = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.-]+)/);
  if (ok) return oklchToSrgb(Number(ok[1]), Number(ok[2]), Number(ok[3]));
  return null;
}

// ── the token blocks ─────────────────────────────────────────────────────────

/** Parse `.grove-root…` blocks into { selector, decls: Map<token,value> }. */
export function parseTokenBlocks(css) {
  const out = [];
  const re = /\.grove-root[^{]*\{[^}]*\}/g;
  for (const m of css.matchAll(re)) {
    const block = m[0];
    const selector = block.slice(0, block.indexOf('{')).trim();
    const decls = new Map();
    for (const d of block.slice(block.indexOf('{') + 1, -1).split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    }
    // Only the token-only theme blocks carry custom properties at top level; the
    // shell blocks (buttons, links) are skipped by having no declarations we read.
    out.push({ selector, decls });
  }
  return out;
}

/**
 * Organize blocks into themes × polarities. The bare `[data-grove-theme="X"]`
 * block is X's PREFERRED polarity; the paired `[data-theme=Y]` block is the other
 * one. The base `.grove-root` block is default/dark; `[data-theme="light"]` alone
 * (single attribute, no grove-theme) is default/light.
 */
export function collectThemes(blocks) {
  const themes = new Map(); // id → { light?: decls, dark?: decls }
  const put = (id, polarity, decls) => {
    if (!themes.has(id)) themes.set(id, {});
    themes.get(id)[polarity] = decls;
  };
  for (const { selector, decls } of blocks) {
    const grove = selector.match(/\[data-grove-theme="([^"]+)"\]/);
    const theme = selector.match(/\[data-theme="([^"]+)"\]/);
    if (grove) {
      // The paired block names its polarity; the bare block is the OTHER one.
      if (theme) put(grove[1], theme[1], decls);
      else {
        // Filled in below, once we know which polarity the pair names.
        const bare = themes.get(grove[1]) ?? {};
        bare.bare = decls;
        themes.set(grove[1], bare);
      }
    } else if (theme) {
      put('default', theme[1], decls);
    } else if (selector === '.grove-root') {
      // EXACTLY the base block — the shell's compound selectors (`.grove-root a`,
      // `.grove-root button`, …) also reach here and must not overwrite it.
      put('default', 'dark', decls);
    }
  }
  for (const [id, t] of themes) {
    if (t.bare) {
      const other = t.light ? 'dark' : 'light';
      t[other] = t.bare;
      delete t.bare;
    }
  }
  return themes;
}

/** Run the coverage floor over every theme × polarity. Returns failures[]. */
export function checkThemes(themes, pairs = PAIRS) {
  const failures = [];
  if (themes.size === 0) return [{ theme: '(none)', why: 'no theme token blocks found' }];
  for (const [id, polarities] of [...themes].sort()) {
    for (const polarity of ['light', 'dark']) {
      const decls = polarities[polarity];
      if (!decls || decls.size === 0) {
        failures.push({ theme: id, polarity, why: 'missing polarity — every theme ships BOTH' });
        continue;
      }
      for (const [fg, bg, min] of pairs) {
        const fgV = decls.get(fg);
        const bgV = decls.get(bg);
        if (!fgV || !bgV) {
          failures.push({ theme: id, polarity, why: `${!fgV ? fg : bg} not declared` });
          continue;
        }
        const fgC = parseColor(fgV);
        const bgC = parseColor(bgV);
        if (!fgC || !bgC) {
          failures.push({ theme: id, polarity, why: `${!fgC ? fg : bg}=${!fgC ? fgV : bgV} is not a contrast-checkable colour` });
          continue;
        }
        const ratio = contrast(fgC, bgC);
        if (ratio < min) {
          failures.push({
            theme: id,
            polarity,
            why: `${fg} on ${bg} = ${ratio.toFixed(2)}:1 < ${min}:1 (${fgV} on ${bgV})`,
          });
        }
      }
    }
  }
  return failures;
}

// ── entry points ─────────────────────────────────────────────────────────────

function runOn(css) {
  return checkThemes(collectThemes(parseTokenBlocks(css)));
}

const css = readFileSync(CSS_PATH, 'utf8');

if (process.argv.includes('--self-test')) {
  let failed = 0;
  const expect = (name, cond) => {
    if (cond) console.log(`  ✓ ${name}`);
    else {
      failed++;
      console.error(`  ✗ ${name}`);
    }
  };
  const GOOD = `
    .grove-root { --bg: #0a0b11; --panel: #13141d; --panel-2: #191b26; --ink: #ecebf4; --ink-2: #9b97b3; --accent: #f49ad4; }
    .grove-root[data-theme="light"] { --bg: #f6f4fb; --panel: #ffffff; --panel-2: #f0ecf8; --ink: #1c1726; --ink-2: #5d5670; --accent: #b02a6f; }
    .grove-root[data-grove-theme="x"] { --bg: #101010; --panel: #1a1a1a; --panel-2: #222222; --ink: #f0f0f0; --ink-2: #b0b0b0; --accent: #e06060; }
    .grove-root[data-grove-theme="x"][data-theme="light"] { --bg: #fafafa; --panel: #ffffff; --panel-2: #f0f0f0; --ink: #202020; --ink-2: #555555; --accent: #a03030; }
  `;
  // 1. the good fixture passes.
  expect('a both-polarity, AA fixture passes', runOn(GOOD).length === 0);
  // 2. a planted sub-AA pair fails — in an ALTERNATE theme, in the LIGHT polarity:
  // the exact regression this gate exists to catch.
  const PLANTED = GOOD.replace(
    '.grove-root[data-grove-theme="x"][data-theme="light"] { --bg: #fafafa;',
    '.grove-root[data-grove-theme="x"][data-theme="light"] { --bg: #0a0a0a;',
  );
  const planted = runOn(PLANTED);
  expect('a planted sub-AA pair fails', planted.length > 0 && /--ink on --bg/.test(planted[0].why));
  // 3. single-polarity by construction fails — the bare block with no pair.
  const SINGLE = GOOD.replace(
    /\n\s*\.grove-root\[data-grove-theme="x"\]\[data-theme="light"\][^\n]*/,
    '',
  );
  const single = runOn(SINGLE);
  expect('a theme missing one polarity fails', single.some((f) => /missing polarity/.test(f.why)));
  // 4. an unparseable colour fails LOUDLY rather than being skipped.
  const WEIRD = GOOD.replace('--accent: #e06060;', '--accent: var(--nope);');
  expect('an uncheckable accent colour fails', runOn(WEIRD).length > 0);
  // 5. the real stylesheet's shape parses into themes (the loader half).
  const themes = collectThemes(parseTokenBlocks(css));
  expect(
    'the shipped CSS yields default + 3 alternates, both polarities',
    themes.size === 4 && [...themes.values()].every((t) => t.light && t.dark),
  );
  console.log(failed === 0 ? 'theme-contrast self-test: 5/5' : `theme-contrast self-test: FAILED ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

const failures = runOn(css);
if (failures.length > 0) {
  console.error(`✗ theme contrast: ${failures.length} pair(s) below the floor`);
  for (const f of failures) console.error(`  · ${f.theme}/${f.polarity}: ${f.why}`);
  process.exit(1);
}
console.log(`✓ theme contrast: every theme, both polarities, at the floor (${[...collectThemes(parseTokenBlocks(css)).keys()].join(', ')})`);
