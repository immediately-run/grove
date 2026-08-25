#!/usr/bin/env node
/*
 * The engine-package API gate (R3-280): an api-snapshot-style check on the ENGINE as a
 * published package. The SDK's `api:check` guards its dist exports; this guards the
 * three contract surfaces a library-composing shell (§1.1 M3) consumes:
 *
 *   1. the package `exports` map (a removed subpath breaks a shell's import at build);
 *   2. the `viewer.manifest.json` component vocabulary + frontmatter keys (the override
 *      contract — a removed entry makes a documented override surface vanish);
 *   3. the named exports of `src/lib.ts` (the composition entry).
 *
 * Additive-only, like the SDK's gate: additions print and pass; REMOVALS/RENAMES fail.
 * The manifest↔reality direction is `check-manifest.mjs`'s (it compares against
 * GROVE_MDX); this file snapshots what is SHIPPED, so a release can be diffed against
 * the contract it claims.
 *
 * Usage:
 *   node scripts/check-engine-api.mjs [--update] [--self-test]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SNAP = join(ROOT, 'engine-api.snapshot.json');

const readExports = (src) => {
  const out = [];
  for (const m of src.matchAll(/^export \{([^}]*)\}/gm)) {
    for (let spec of m[1].split(',')) {
      spec = spec.trim().replace(/^type /, '');
      if (!spec) continue;
      const asMatch = spec.match(/\sas\s+(\w+)$/);
      out.push(asMatch ? asMatch[1] : spec.split(/\s+/)[0]);
    }
  }
  for (const m of src.matchAll(/^export \*\s+from\s+['"]([^'"]+)['"]/gm)) {
    out.push(`*:${m[1]}`);
  }
  return out.sort();
};

const collect = () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(ROOT, 'viewer.manifest.json'), 'utf8'));
  const lib = readFileSync(join(ROOT, 'src/lib.ts'), 'utf8');
  return {
    version: pkg.version,
    exports: Object.keys(pkg.exports ?? {}).sort(),
    manifestComponents: Object.keys(manifest.components ?? {}).sort(),
    manifestFrontmatter: {
      engine: (manifest.frontmatter?.engine ?? []).slice().sort(),
      corpusTooling: (manifest.frontmatter?.corpusTooling ?? []).slice().sort(),
    },
    libExports: readExports(lib),
  };
};

const run = () => {
  const now = collect();
  let prev;
  try {
    prev = JSON.parse(readFileSync(SNAP, 'utf8'));
  } catch {
    console.error('error: engine-api.snapshot.json missing — run `--update` once to baseline.');
    process.exit(1);
  }
  const errors = [];
  for (const surface of ['exports', 'manifestComponents', 'libExports']) {
    const removed = prev[surface].filter((x) => !now[surface].includes(x));
    if (removed.length) errors.push(`  ${surface}: REMOVED ${removed.join(', ')} — additive-only (an override surface or import path vanished)`);
    const added = now[surface].filter((x) => !prev[surface].includes(x));
    if (added.length) console.log(`  + ${surface}: ${added.join(', ')}`);
  }
  for (const key of ['engine', 'corpusTooling']) {
    const removed = prev.manifestFrontmatter[key].filter((x) => !now.manifestFrontmatter[key].includes(x));
    if (removed.length) errors.push(`  manifestFrontmatter.${key}: REMOVED ${removed.join(', ')}`);
  }
  if (errors.length) {
    console.error(`FAIL engine API is not additive-only:\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log(`OK engine API matches the snapshot (${now.exports.length} export paths, ${now.manifestComponents.length} manifest components, ${now.libExports.length} lib exports).`);
};

const selfTest = () => {
  // The comparator logic, driven on synthetic surfaces: removal fails, addition passes.
  const prev = { exports: ['./a', './b'], manifestComponents: ['A', 'B'], libExports: ['x', 'y'], manifestFrontmatter: { engine: ['nav'], corpusTooling: ['status'] } };
  const diff = (before, after) => {
    const errs = [];
    for (const surface of ['exports', 'manifestComponents', 'libExports']) {
      for (const r of before[surface]) if (!after[surface].includes(r)) errs.push(`${surface}:${r}`);
    }
    return errs;
  };
  const cases = [
    ['a removed export path fails', diff(prev, { ...prev, exports: ['./a'] }).length === 1],
    ['an added export path passes', diff(prev, { ...prev, exports: [...prev.exports, './c'] }).length === 0],
    ['a removed manifest component fails', diff(prev, { ...prev, manifestComponents: ['A'] }).length === 1],
    ['a removed lib export fails', diff(prev, { ...prev, libExports: ['y'] }).length === 1],
  ];
  let failed = 0;
  for (const [name, pass] of cases) {
    console.log(`${pass ? '✓' : '✗'} ${name}`);
    if (!pass) failed++;
  }
  console.log(`\n${cases.length - failed}/${cases.length} self-test cases.`);
  return failed === 0;
};

if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
if (process.argv.includes('--update')) {
  writeFileSync(SNAP, JSON.stringify(collect(), null, 2) + '\n');
  console.log(`✓ Wrote ${SNAP}`);
} else run();
