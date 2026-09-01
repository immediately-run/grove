#!/usr/bin/env node
// check-theme-token-only.mjs — R3-310 (02-theme-contract §1): a theme file
// declares custom properties and NOTHING ELSE. No selectors beyond the theme's
// own root scoping, no `url(`, no `@import`, no `@font-face` — faces arrive as
// DECLARED assets the engine mints (R3-315), never as a location a theme names.
//
// WHY A SCRIPT. The token-only rule is what makes "CSS-only re-skin over the
// same DOM" true rather than aspirational, and a contributed theme reviewable in
// one screen — the adversarial exit plants a `url(`/`@import`/`@font-face` in a
// theme and requires the gate to fail. Prose cannot fail a build
// (ways_of_working §4).
//
// WHAT IT READS. The `[data-grove-theme=…]` blocks in src/GroveApp.css: each
// block's declaration list must be custom properties only.
//
// FAULT INJECTION. `--self-test` plants each violation and asserts the checker
// rejects it for the reason claimed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS_PATH = join(root, 'src', 'GroveApp.css');

/** The violations in one theme-block text. Exported shape for the self-test. */
export function themeViolations(css) {
  const out = [];
  const blockRe = /\.grove-root\[data-grove-theme="[^"]+"\]([^\{]*)\{/g;
  let m;
  while ((m = blockRe.exec(css)) !== null) {
    const selectorSuffix = m[1];
    // The block's body: track braces to find the matching close.
    let depth = 1;
    let end = blockRe.lastIndex;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}') depth--;
      end++;
    }
    const body = css.slice(blockRe.lastIndex, end - 1);
    const label = `data-grove-theme block at ${m.index}`;
    // A theme block may carry its polarity pairing ([data-theme=…]) and nothing
    // else — any further compound selector is a component reaching into the
    // theme, which is the fork-with-a-friendly-name failure.
    if (!/^\s*(\[data-theme="[^"]+"\])?\s*$/.test(selectorSuffix)) {
      out.push({ theme: label, why: `unexpected selector suffix: ${selectorSuffix.trim()}` });
    }
    if (/@import|@font-face|url\(/i.test(body)) {
      out.push({ theme: label, why: 'theme names a location or rule (url(/@import/@font-face) — faces are declared assets, not URLs' });
    }
    for (const line of body.split('\n')) {
      const decl = line.replace(/\/\*.*?\*\//g, '').trim();
      if (!decl || decl.startsWith('/*') || decl === '') continue;
      if (!/^--[\w-]+\s*:/.test(decl)) {
        out.push({ theme: label, why: `non-token declaration: ${decl.slice(0, 60)}` });
      }
    }
  }
  return out;
}

function run() {
  const css = readFileSync(CSS_PATH, 'utf8');
  const v = themeViolations(css);
  if (v.length > 0) {
    console.error(`✗ check-theme-token-only: ${v.length} violation(s) in the catalogue themes:`);
    for (const { theme, why } of v) console.error(`  ${theme}: ${why}`);
    process.exit(1);
  }
  console.log('OK: every catalogue theme block is token-only (custom properties, nothing else).');
}

function selfTest() {
  let ok = 0;
  const check = (name, cond) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
    if (cond) ok++;
  };
  check('a clean token block passes', themeViolations('.grove-root[data-grove-theme="x"] {\n  --bg: #111;\n}\n').length === 0);
  check('a polarity-paired block passes', themeViolations('.grove-root[data-grove-theme="x"][data-theme="dark"] {\n  --bg: #111;\n}\n').length === 0);
  check('a planted url( fails', themeViolations('.grove-root[data-grove-theme="x"] {\n  --wash: url(paper.jpg);\n}\n').length === 1);
  check('a planted @font-face fails', themeViolations('.grove-root[data-grove-theme="x"] {\n  @font-face { src: url(a.woff2); }\n}\n').length >= 1);
  check('a planted @import fails', themeViolations('.grove-root[data-grove-theme="x"] {\n  @import url(x.css);\n}\n').length >= 1);
  check('a non-token rule fails', themeViolations('.grove-root[data-grove-theme="x"] {\n  .sidebar { display: none; }\n}\n').length >= 1);
  check('a compound component selector fails', themeViolations('.grove-root[data-grove-theme="x"] .sidebar {\n  --bg: #111;\n}\n').length === 1);
  console.log(`\n${ok}/7 self-test cases.`);
  if (ok !== 7) process.exit(1);
}

if (process.argv.includes('--self-test')) selfTest();
else run();
