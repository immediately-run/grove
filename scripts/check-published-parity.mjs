#!/usr/bin/env node
/*
 * If this version is ALREADY on npm, what we would publish must declare the same
 * dependencies as what IS published.
 *
 * `ci.yml`'s publish step skips when `package.json`'s version already exists, and says so
 * with a `::notice::` — not a failure. That skip is correct (a re-run of an old commit
 * must not try to republish) and it is also how `main` and the published package drifted
 * apart for weeks without a single red build: the SDK pin moved from `^0.52.0` to
 * `^0.65.0` on `main`, the version was never bumped, so `0.1.2` on npm kept declaring
 * `^0.52.0`. Every consumer installing the package got the OLD pin, npm nested a second
 * SDK copy under grove, and R3-556 — which composes this package — was blocked by it with
 * nothing anywhere reporting a problem.
 *
 * The invariant this restores: a skip is benign only when it is a NO-OP. Same version,
 * different dependencies, means the version number is a lie and the fix is to bump it.
 *
 * Why only the dependency blocks: they are the part of the manifest a consumer's install
 * resolves against, so a difference there changes what is on a consumer's disk. Comparing
 * whole tarballs would fail on every timestamp and prove nothing.
 *
 * Usage: node scripts/check-published-parity.mjs [--self-test]
 * Exit:  0 parity (or not published yet — nothing to compare) · 1 drift · 2 cannot answer
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The blocks a consumer's install actually resolves against. */
const BLOCKS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

/**
 * Compare two manifests' dependency blocks.
 *
 * Returns the differences as `{ block, name, published, local }` rows — empty means
 * parity. A missing block on either side is the empty object, never a reason to skip the
 * comparison: dropping `peerDependencies` wholesale is exactly the kind of change that
 * must not ride an unbumped version.
 */
export function dependencyDrift(published, local) {
  const rows = [];
  for (const block of BLOCKS) {
    const p = published?.[block] ?? {};
    const l = local?.[block] ?? {};
    for (const name of [...new Set([...Object.keys(p), ...Object.keys(l)])].sort()) {
      if (p[name] !== l[name]) {
        rows.push({ block, name, published: p[name] ?? '(absent)', local: l[name] ?? '(absent)' });
      }
    }
  }
  return rows;
}

function selfTest() {
  let ok = 0;
  let total = 0;
  const check = (label, cond) => {
    total += 1;
    if (cond) ok += 1;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  };
  const dep = (o) => ({ dependencies: o });

  check('identical manifests have no drift', dependencyDrift(dep({ a: '1.0.0' }), dep({ a: '1.0.0' })).length === 0);
  // The R3-556 case, verbatim.
  const moved = dependencyDrift(dep({ '@immediately-run/sdk': '^0.52.0' }), dep({ '@immediately-run/sdk': '^0.65.0' }));
  check('a moved pin is drift', moved.length === 1);
  check('…and names both sides', moved[0].published === '^0.52.0' && moved[0].local === '^0.65.0');
  check('an ADDED dependency is drift', dependencyDrift(dep({}), dep({ a: '1.0.0' }))[0]?.local === '1.0.0');
  check('a REMOVED dependency is drift', dependencyDrift(dep({ a: '1.0.0' }), dep({}))[0]?.local === '(absent)');
  check(
    'a peer moved while the dependency stayed is still drift',
    dependencyDrift(
      { dependencies: { a: '1.0.0' }, peerDependencies: { a: '^1.0.0' } },
      { dependencies: { a: '1.0.0' }, peerDependencies: { a: '^2.0.0' } },
    ).length === 1,
  );
  check(
    'dropping peerDependencies entirely is drift, not an excuse to skip',
    dependencyDrift({ peerDependencies: { a: '^1.0.0' } }, {}).length === 1,
  );
  check('devDependencies are not compared — they are not on a consumer disk', dependencyDrift({ devDependencies: { a: '1' } }, { devDependencies: { a: '2' } }).length === 0);
  check('order does not matter', dependencyDrift(dep({ a: '1', b: '2' }), dep({ b: '2', a: '1' })).length === 0);

  console.log(`\n${ok}/${total} self-test cases.`);
  return ok === total ? 0 : 1;
}

if (process.argv.includes('--self-test')) process.exit(selfTest());

const local = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const spec = `${local.name}@${local.version}`;

let published;
try {
  published = JSON.parse(
    execFileSync('npm', ['view', spec, 'dependencies', 'peerDependencies', 'optionalDependencies', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }) || '{}',
  );
} catch {
  // Not published, no registry, no network. "Cannot answer" is not "parity": the caller
  // (ci.yml) only runs this when `npm view` already said the version EXISTS, so a failure
  // here is a real problem with reading it, and exiting 0 would restore the silence this
  // check exists to end.
  console.error(`✗ cannot read ${spec} from the registry — not answering is not a pass.`);
  process.exit(2);
}

// `npm view <spec> a b c --json` returns a bare object keyed by the fields asked for.
const rows = dependencyDrift(published, local);
if (rows.length === 0) {
  console.log(`✓ ${spec} on npm declares the same dependencies as this tree.`);
  process.exit(0);
}

console.error(
  `::error::${spec} is already published, and this tree declares DIFFERENT dependencies. ` +
    `Publishing would be skipped, so the change would never reach npm — bump the version.`,
);
for (const r of rows) {
  console.error(`  ${r.block}.${r.name}: published ${r.published} · here ${r.local}`);
}
process.exit(1);
