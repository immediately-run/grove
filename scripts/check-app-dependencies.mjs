#!/usr/bin/env node
/*
 * Everything `src/` imports at runtime must be in `dependencies`.
 *
 * Grove is BOTH a library and an app, and the two roles want opposite things from
 * package.json:
 *
 *   · as a LIBRARY, `react`/`react-dom`/`@immediately-run/sdk` are peers — the
 *     consumer supplies one React and one SDK, and grove must not bring a second;
 *   · as an APP, the immediately.run sandbox resolves the dependency tree from
 *     `dependencies` ALONE (`bundler.loadNodeModules` → `parsedPackageJSON.dependencies`).
 *     A peer is not fetched: at the ROOT of a run there is no consumer to supply it.
 *
 * R3-280 packaged the library role and moved those three out of `dependencies`. The
 * app role then died at boot — and not with "react is missing", but with
 *
 *     Cannot find module 'react' from '/node_modules/react-error-boundary/…'
 *
 * because the React preset injects `react-error-boundary` (an SDK dependency) into
 * every app, and IT imports react. The name in the error is a package grove never
 * mentions, which is why the cause is not obvious from the symptom. `npm run verify`,
 * `vite build` and every test passed the whole time: a bundler resolves from
 * node_modules, where devDependencies are just as present.
 *
 * So this check reads what the SOURCE imports and asserts the manifest declares it.
 * It is the only gate here that can see the difference, because it is the only one
 * that reads package.json instead of node_modules.
 *
 * Usage: node scripts/check-app-dependencies.mjs [--self-test]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Node builtins and virtual specifiers no manifest declares. */
const BUILTIN = /^(node:|bun:)/;
/** Vite/toolchain specifiers that never resolve through node_modules at runtime. */
const VIRTUAL = new Set(['virtual:', 'vite/client']);
/**
 * Modules the SANDBOX itself preloads, so an app imports them without declaring
 * anything (`bundler.preloadModules`). `fs` is the notable one: it is not a CDN
 * polyfill but the shared filesystem backed by the parent window over the Port —
 * the thing every Grove read goes through. Kept as an explicit list rather than a
 * blanket "node builtins are fine", because these are provided by THIS platform
 * and the set is a contract that could change.
 */
const SANDBOX_PROVIDED = new Set(['fs', 'path', 'util', 'assert', 'module', 'os']);

/** The package name a specifier belongs to: `react-dom/client` → `react-dom`,
 *  `@scope/pkg/sub` → `@scope/pkg`. */
export const packageOf = (spec) => {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

/** Every bare package a source file imports (static, dynamic, and re-export). */
export const importedPackages = (source) => {
  const out = new Set();
  const patterns = [
    /(?:^|[\s;}])(?:import|export)\b[^;'"]*?\sfrom\s*["']([^"']+)["']/g,
    /(?:^|[\s;}])import\s*["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) {
      const spec = m[1];
      if (spec.startsWith('.') || spec.startsWith('/')) continue;
      if (BUILTIN.test(spec) || VIRTUAL.has(spec) || spec.startsWith('virtual:')) continue;
      if (SANDBOX_PROVIDED.has(packageOf(spec))) continue;
      out.add(packageOf(spec));
    }
  }
  return out;
};

/** Runtime source files — the app's own code. Tests are excluded: they run under
 *  vitest in node, where devDependencies are exactly the right home. */
const sourceFiles = (dir, rel = '') => {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...sourceFiles(join(dir, entry.name), childRel));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.test\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(childRel);
    }
  }
  return out;
};

export const findMissing = (readFile, files, declared) => {
  const missing = new Map();
  for (const file of files) {
    for (const pkg of importedPackages(readFile(file))) {
      if (declared.has(pkg)) continue;
      if (!missing.has(pkg)) missing.set(pkg, []);
      missing.get(pkg).push(file);
    }
  }
  return missing;
};

const selfTest = () => {
  const cases = [
    { name: 'a relative import needs no declaration', src: 'import { a } from "./x";', declared: [], want: 0 },
    { name: 'a node builtin needs no declaration', src: 'import { join } from "node:path";', declared: [], want: 0 },
    { name: 'a declared package is fine', src: 'import React from "react";', declared: ['react'], want: 0 },
    { name: 'THE R3-280 REGRESSION: react imported, not declared', src: 'import React from "react";', declared: [], want: 1 },
    { name: 'a SUBPATH counts as its package', src: 'import { createRoot } from "react-dom/client";', declared: ['react-dom'], want: 0 },
    { name: '…and is reported under the package name', src: 'import x from "@immediately-run/sdk/boot";', declared: [], want: 1 },
    { name: 'a scoped package keeps both segments', src: 'import x from "@scope/pkg/deep/path";', declared: ['@scope/pkg'], want: 0 },
    { name: 'a dynamic import counts', src: 'const m = await import("some-pkg");', declared: [], want: 1 },
    { name: 'a re-export counts', src: 'export { x } from "some-pkg";', declared: [], want: 1 },
    { name: 'the sandbox-preloaded `fs` needs no declaration', src: 'import fs from "fs";', declared: [], want: 0 },
    { name: '…and so do the other preloaded builtins', src: 'import { join } from "path";', declared: [], want: 0 },
  ];
  let failed = 0;
  for (const c of cases) {
    const got = findMissing(() => c.src, ['f.ts'], new Set(c.declared)).size;
    const ok = got === c.want;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name} (expected ${c.want}, got ${got})`);
  }
  console.log(`\n${cases.length - failed}/${cases.length} self-test cases.`);
  return failed === 0;
};

if (process.argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const declared = new Set(Object.keys(pkg.dependencies ?? {}));
const files = sourceFiles(join(ROOT, 'src'));
const missing = findMissing((f) => readFileSync(join(ROOT, 'src', f), 'utf8'), files, declared);

if (missing.size === 0) {
  console.log(
    `OK: every package src/ imports is in "dependencies" (${files.length} file(s), ${declared.size} declared).`,
  );
  process.exit(0);
}
console.error(
  `::error::${missing.size} package(s) imported by src/ but absent from "dependencies".\n` +
    'The sandbox resolves an app\'s modules from `dependencies` alone — a peer or a\n' +
    'devDependency is NOT fetched, and the app dies at boot naming some other package\n' +
    'that needed it. Declare them in `dependencies`; keep the peer entry too if the\n' +
    'library role needs it (both is legal, and what `file-explorer` does).\n',
);
for (const [pkgName, files_] of missing) {
  const where = pkg.peerDependencies?.[pkgName]
    ? ' (declared as a PEER only)'
    : pkg.devDependencies?.[pkgName]
      ? ' (declared as a devDependency only)'
      : '';
  console.error(`  ${pkgName}${where}\n    ${files_.slice(0, 4).join('\n    ')}`);
}
process.exit(1);
