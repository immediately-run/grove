#!/usr/bin/env node
/*
 * If this version is ALREADY on npm, what we would publish must declare the same
 * install surface as what IS published.
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
 * different declarations, means the version number is a lie and the fix is to bump it.
 *
 * ## What is compared, and what cannot be
 *
 * The dependency blocks, plus `main` and `exports`: the parts of the manifest a
 * consumer's install and resolution actually read, so a difference there changes what is
 * on a consumer's disk or which file they get when they import. `devDependencies` is
 * excluded because it is never on a consumer's disk. `files` is excluded from the
 * MANIFEST comparison because it CANNOT be compared there — npm does not keep it in the
 * packument, so the registry has no answer to compare against. Comparing whole tarballs
 * would fail on every timestamp and prove nothing.
 *
 * The manifest half closed the R3-556 hole and left the PAYLOAD half open, which then
 * produced a worse instance of the same failure (R3-751): a source-only change under an
 * already-published version passes the manifest comparison, the publish step skips with
 * a notice, and every consumer keeps the broken surface. So when the manifest is at
 * parity, the packed payload is compared too — per-entry content digests over `npm pack`
 * of both sides, `package.json` included (a change to `files` or `scripts` is invisible
 * to the manifest comparison but lands in the payload). Tarball bytes are never compared:
 * gzip framing, mtimes, uid/gid and mode differ on every pack of identical content; the
 * file contents are exact.
 *
 * ## Where it runs, and why in two places
 *
 * `build-test` (through `verify`), where it catches a pin that moves without a version
 * bump ON THE PULL REQUEST that does it — which is the only moment the fix is one line.
 * A version not yet published is the ordinary state there, so that is exit 0, not a
 * failure. And again in the publish job, where a drift means the release about to be
 * skipped would silently no-op.
 *
 * Usage: node scripts/check-published-parity.mjs [--self-test] [--offline-ok]
 * Exit:  0 parity (manifest and, once the version is published, payload), or this
 *        version is not published yet (nothing to compare)
 *        1 drift — same version, different manifest declarations or a different
 *        packed payload
 *        2 cannot answer (registry unreadable, offline, malformed reply; or the
 *        payload comparison could not run)
 *          …unless --offline-ok, which downgrades ONLY that case to 0.
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The dependency blocks a consumer's install resolves against. */
const BLOCKS = ['dependencies', 'peerDependencies', 'optionalDependencies'];
/** Non-block fields that decide WHICH FILE a consumer's import lands on. */
const FIELDS = ['main', 'exports'];

/** Stable stringify, so key ORDER is not reported as a difference. */
const stable = (v) => {
  if (v === undefined) return undefined;
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
    .join(',')}}`;
};

/**
 * Compare two manifests' install surface.
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
  for (const field of FIELDS) {
    const p = stable(published?.[field]);
    const l = stable(local?.[field]);
    if (p !== l) rows.push({ block: '(root)', name: field, published: p ?? '(absent)', local: l ?? '(absent)' });
  }
  return rows;
}

/**
 * Compare two packed payloads, per entry.
 *
 * Takes two `Map<string, string>` of package-relative path → content digest, as
 * `entryDigests` returns. Returns the differences as `{ path, published, local }` rows —
 * empty means parity. A path on one side only is a row reading `(absent)` on the other,
 * in both directions: 80ff078 both changed and added files, and an added-only change
 * must not be silent (R3-751).
 */
export function payloadDrift(published, local) {
  const rows = [];
  for (const path of [...new Set([...published.keys(), ...local.keys()])].sort()) {
    const p = published.get(path);
    const l = local.get(path);
    if (p !== l) rows.push({ path, published: p ?? '(absent)', local: l ?? '(absent)' });
  }
  return rows;
}

/** sha256 of one extracted entry, hex — the per-entry content digest. */
function fileDigest(absPath) {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex');
}

/** Walk an extracted package root, returning `Map<relativePath, digest>` (regular files). */
function treeDigests(root) {
  const map = new Map();
  const walk = (rel) => {
    const abs = rel === '' ? root : join(root, rel);
    if (statSync(abs).isDirectory()) {
      for (const entry of readdirSync(abs)) walk(rel === '' ? entry : `${rel}/${entry}`);
    } else if (statSync(abs).isFile()) {
      map.set(rel, fileDigest(abs));
    }
  };
  walk('');
  return map;
}

/**
 * The impure half, one function: extract one packed tarball into a temp directory this
 * script creates and removes, and return `Map<package-relative path, content digest>`.
 * `tar` extracts with `--strip-components 1` so the archive's `package/` prefix is gone
 * and keys are package-root-relative (`package.json`, `src/lib.ts`, …).
 * Shells out to `tar -xzf` as the script shells out to `npm` — no new dependency.
 */
export function entryDigests(tarballPath) {
  const dir = mkdtempSync(join(tmpdir(), 'published-parity-payload-'));
  try {
    execFileSync('tar', ['-xzf', tarballPath, '-C', dir, '--strip-components', '1'], {
      stdio: ['ignore', 'ignore', 'pipe'],
      // Bounded like every other process this script spawns: a stalled extraction must
      // land in the cannot-answer catch, not hang the job (R17).
      timeout: 120_000,
    });
    return treeDigests(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The one tarball in a directory `npm pack` was pointed at. Thrown as its own error so
 * the "packed nothing" failure has a name the self-test can pin (R2).
 */
export function onlyTarball(dir) {
  const tarball = readdirSync(dir).find((f) => f.endsWith('.tgz'));
  if (!tarball) throw new Error('npm pack wrote no tarball');
  return tarball;
}

/**
 * Pack one side into a fresh temp directory and return the tarball's path. Both payload
 * sides come from `npm pack` so they are by construction the `files:` payload, and the
 * published side uses the same code path as the local side (npm downloads the registry
 * tarball for a `<name>@<version>` spec). A fresh directory per side, because the
 * published tarball and the local pack have the SAME filename and would collide.
 */
function packTarball(spec, cwd) {
  const dest = mkdtempSync(join(tmpdir(), 'published-parity-pack-'));
  try {
    execFileSync('npm', ['pack', ...spec, '--pack-destination', dest], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 120_000,
    });
    return { dir: dest, tarball: join(dest, onlyTarball(dest)) };
  } catch (e) {
    rmSync(dest, { recursive: true, force: true });
    throw e;
  }
}

/**
 * The one cannot-answer shape, shared by both sites that cannot run a comparison (R6):
 * a registry read that would not answer, and a payload comparison that could not run.
 * Both mean "parity was NOT checked", both are exit 2, and `--offline-ok` downgrades
 * ONLY this case — never a drift — with a line that says the comparison never ran.
 */
function cannotAnswerExit(subject, reason, offlineOk) {
  console.error(
    offlineOk
      ? `⚠ could not ${subject} (${reason}) — parity was NOT checked. ` +
          `Not failing the build (--offline-ok); the publish job checks this strictly.`
      : `✗ cannot ${subject} (${reason}) — not answering is not a pass.`,
  );
  return offlineOk ? 0 : 2;
}

/**
 * What the registry's answer MEANS — pure, so every branch is testable without a
 * network. `npm view <spec> … --json` has three shapes worth telling apart, and the
 * first two both exit non-zero, which is why the exit code alone is not the answer:
 *
 *  - **absent** — the version is not published. npm prints `{"error":{"code":"E404"}}`
 *    to STDOUT and exits non-zero. There is nothing to compare, and on a pull request
 *    this is the ordinary state, so it is a pass.
 *  - **unreadable** — no network, a private-registry auth failure, a malformed reply.
 *    Never a pass on its own: the publish job only reaches this once `npm view` has
 *    already said the version EXISTS, so failing to read it there is a real problem.
 *  - **published** — a JSON object of the requested fields. EMPTY stdout is this case
 *    too, and means a manifest declaring none of them.
 */
export function classifyRegistryReply({ stdout, failed }) {
  const text = (stdout ?? '').trim();
  if (text === '') return failed ? { kind: 'unreadable', reason: 'empty reply' } : { kind: 'published', manifest: {} };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'unreadable', reason: 'reply was not JSON' };
  }
  if (parsed && typeof parsed === 'object' && parsed.error) {
    return parsed.error.code === 'E404'
      ? { kind: 'absent' }
      : { kind: 'unreadable', reason: parsed.error.summary ?? parsed.error.code ?? 'registry error' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'unreadable', reason: 'reply was not an object' };
  }
  return { kind: 'published', manifest: parsed };
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

  // ── the comparison ─────────────────────────────────────────────────────────
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
  // `main`/`exports` decide which FILE an import lands on, so they are the same class of
  // change as a moved pin — and an exports map is nested, hence the stable compare.
  check('a moved `main` is drift', dependencyDrift({ main: 'src/a.tsx' }, { main: 'src/b.tsx' }).length === 1);
  check('a changed `exports` subpath is drift', dependencyDrift({ exports: { '.': './a.ts' } }, { exports: { '.': './b.ts' } }).length === 1);
  check('an ADDED `exports` subpath is drift', dependencyDrift({ exports: { '.': './a.ts' } }, { exports: { '.': './a.ts', './x': './x.ts' } }).length === 1);
  check(
    'the same exports map in a different key order is NOT drift',
    dependencyDrift({ exports: { '.': './a.ts', './x': './x.ts' } }, { exports: { './x': './x.ts', '.': './a.ts' } }).length === 0,
  );

  // ── what the registry's answer means ───────────────────────────────────────
  // The E404 body is the REAL one, captured from
  // `npm view @immediately-run/grove@0.1.3 dependencies --json` on 2026-09-15, when
  // 0.1.3 was unpublished — not a hand-written approximation of it.
  const e404 = JSON.stringify({
    error: {
      code: 'E404',
      summary: 'No match found for version 0.1.3',
      detail: "'@immediately-run/grove@0.1.3' is not in this registry.",
    },
  });
  check('an E404 body is ABSENT, not unreadable', classifyRegistryReply({ stdout: e404, failed: true }).kind === 'absent');
  // The published body is equally real: the SAME argv this script sends (`BLOCKS` +
  // `FIELDS`), against 0.1.2, captured 2026-09-15. Capturing a narrower command would
  // make the fixture stop being the producer's output the moment a field is added —
  // and would leave this case green with the whole `main`/`exports` comparison deleted.
  const real = JSON.stringify({
    dependencies: { '@immediately-run/mdx-plugins': '0.4.0', '@immediately-run/sdk': '^0.52.0', react: '^19.2.5', 'react-dom': '^19.2.5' },
    peerDependencies: { '@immediately-run/sdk': '^0.52.0', react: '^19.2.5', 'react-dom': '^19.2.5' },
    main: 'src/main.tsx',
    exports: {
      '.': './src/lib.ts',
      './app': './src/App.tsx',
      './manifest': './viewer.manifest.json',
      './components': './src/mdxComponents.ts',
      './styles.css': './src/GroveApp.css',
      './theme.css': './src/index.css',
      './package.json': './package.json',
    },
  });
  const pub = classifyRegistryReply({ stdout: real, failed: false });
  check('a real packument reply is PUBLISHED', pub.kind === 'published');
  // EXACTLY the three real drifts, and NO `(root)` row: 0.1.2's `main`/`exports` match
  // this tree, so a spurious root row would mean the comparison of those fields is wrong.
  const realRows = dependencyDrift(pub.manifest, JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')));
  check(
    '…and drifts against this tree in EXACTLY the three places 0.1.2 really drifted',
    JSON.stringify(realRows.map((r) => `${r.block}.${r.name}`)) ===
      JSON.stringify([
        'dependencies.@immediately-run/mdx-plugins',
        'dependencies.@immediately-run/sdk',
        'peerDependencies.@immediately-run/sdk',
      ]),
  );
  check('an absent-blocks manifest is published-with-nothing, not unreadable', classifyRegistryReply({ stdout: '', failed: false }).kind === 'published');
  check('…which then reads every local block as ADDED', dependencyDrift(classifyRegistryReply({ stdout: '', failed: false }).manifest, dep({ a: '1' })).length === 1);
  check('an empty reply that FAILED is unreadable', classifyRegistryReply({ stdout: '', failed: true }).kind === 'unreadable');
  check('a non-E404 registry error is unreadable, never absent', classifyRegistryReply({ stdout: JSON.stringify({ error: { code: 'E401', summary: 'auth' } }), failed: true }).kind === 'unreadable');
  check('a non-JSON reply is unreadable', classifyRegistryReply({ stdout: '<html>502</html>', failed: true }).kind === 'unreadable');
  check('a JSON ARRAY reply is unreadable, not an empty manifest', classifyRegistryReply({ stdout: '["0.1.1","0.1.2"]', failed: false }).kind === 'unreadable');

  // ── the payload comparison ─────────────────────────────────────────────────
  const map = (o) => new Map(Object.entries(o));
  check('identical payload Maps have no drift', payloadDrift(map({ a: 'h1', b: 'h2' }), map({ b: 'h2', a: 'h1' })).length === 0);
  const changed = payloadDrift(map({ a: 'h1', b: 'h2' }), map({ a: 'h9', b: 'h2' }));
  check('a changed digest is one row naming the path and both digests', changed.length === 1 && changed[0].path === 'a' && changed[0].published === 'h1' && changed[0].local === 'h9');
  const added = payloadDrift(map({ a: 'h1' }), map({ a: 'h1', 'src/new.ts': 'h2' }));
  check('an ADDED file is a row, (absent) on the published side', added.length === 1 && added[0].path === 'src/new.ts' && added[0].published === '(absent)' && added[0].local === 'h2');
  const removed = payloadDrift(map({ 'src/old.ts': 'h1' }), map({}));
  check('a REMOVED file is a row, (absent) on the local side', removed.length === 1 && removed[0].path === 'src/old.ts' && removed[0].published === 'h1' && removed[0].local === '(absent)');

  // Real producer: the fixture Maps for the identical-tree case are built by running
  // `entryDigests` over a tarball THIS repo packs right here through the production
  // `packTarball` path — a hand-typed Map would stay green with the digest function
  // deleted, and an inline duplicate of the pack call would stay green with
  // `packTarball` deleted (R3-751, R2). No `prepack` script exists, so the pack is
  // offline and side-effect-free.
  const emptyDir = mkdtempSync(join(tmpdir(), 'published-parity-empty-'));
  const synthDir = mkdtempSync(join(tmpdir(), 'published-parity-synth-'));
  let packed;
  try {
    let threw = null;
    try {
      onlyTarball(emptyDir);
    } catch (e) {
      threw = e;
    }
    check('onlyTarball refuses a directory with no tarball, by name', threw instanceof Error && threw.message === 'npm pack wrote no tarball');

    // The digest walk, pinned against DIRECT hashes of a synthetic tree (a file, and a
    // file one level down): a `fileDigest` that returned a constant, or a `treeDigests`
    // that skipped subdirectories, would otherwise leave every real-pack case green —
    // the gate could silently never fire, which is the exact failure R3-751 closes.
    mkdirSync(join(synthDir, 'package', 'sub'), { recursive: true });
    writeFileSync(join(synthDir, 'package', 'a.txt'), 'alpha');
    writeFileSync(join(synthDir, 'package', 'sub', 'b.txt'), 'beta');
    execFileSync('tar', ['-czf', join(synthDir, 'synth.tgz'), '-C', synthDir, 'package'], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 30_000,
    });
    const synth = entryDigests(join(synthDir, 'synth.tgz'));
    const direct = (p) => createHash('sha256').update(readFileSync(join(synthDir, 'package', p))).digest('hex');
    check(
      'entryDigests returns the exact content digests, nested keys included',
      synth.size === 2 && synth.get('a.txt') === direct('a.txt') && synth.get('sub/b.txt') === direct('sub/b.txt'),
    );

    packed = packTarball([], ROOT);
    const real = entryDigests(packed.tarball);
    check('entryDigests reads a real pack of this repo (non-empty, package.json included)', real.size > 0 && real.has('package.json'));
    check('…and the identical-tree case has no drift', payloadDrift(real, real).length === 0);
    const firstPath = [...real.keys()][0];
    const mutated = new Map(real);
    mutated.set(firstPath, 'deadbeef');
    const mutatedRows = payloadDrift(real, mutated);
    check('…a one-file mutation against the real Map is exactly one row', mutatedRows.length === 1 && mutatedRows[0].path === firstPath && mutatedRows[0].published === real.get(firstPath) && mutatedRows[0].local === 'deadbeef');
    check('…and the pack directory it made is the one `onlyTarball` finds', onlyTarball(packed.dir) === packed.tarball.split('/').pop());

    // The one downgrade policy, called directly: strict is exit 2 with the honest line,
    // `--offline-ok` is exit 0 and says the comparison never ran. A flipped ternary or a
    // re-pasted message turns these red (round-2 R2).
    const seen = [];
    const realError = console.error;
    console.error = (m) => seen.push(m);
    const strictCode = cannotAnswerExit('read X from the registry', 'boom', false);
    const offlineCode = cannotAnswerExit('read X from the registry', 'boom', true);
    console.error = realError;
    check(
      'cannotAnswerExit: strict is 2 and names what did not answer; --offline-ok is 0 and says parity was NOT checked',
      strictCode === 2 &&
        seen[0].includes('read X from the registry') &&
        seen[0].includes('not answering is not a pass') &&
        offlineCode === 0 &&
        seen[1].includes('parity was NOT checked'),
    );
  } finally {
    for (const dir of [emptyDir, synthDir, packed?.dir]) {
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log(`\n${ok}/${total} self-test cases.`);
  return ok === total ? 0 : 1;
}

if (process.argv.includes('--self-test')) process.exit(selfTest());

const offlineOk = process.argv.includes('--offline-ok');
const local = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const spec = `${local.name}@${local.version}`;

let stdout = '';
let failed = false;
try {
  stdout = execFileSync('npm', ['view', spec, ...BLOCKS, ...FIELDS, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    // The repo's only outbound call. Without a bound, a hung registry read holds the
    // job to its ceiling; a kill lands in the catch below and reads as unreadable.
    timeout: 30_000,
  });
} catch (e) {
  failed = true;
  stdout = typeof e?.stdout === 'string' ? e.stdout : '';
}

const reply = classifyRegistryReply({ stdout, failed });

if (reply.kind === 'absent') {
  console.log(`✓ ${spec} is not published yet — nothing to compare.`);
  process.exit(0);
}

if (reply.kind === 'unreadable') {
  // Under `--offline-ok` this IS a pass — the build is deliberately not failed for a
  // registry that would not answer — and a log that says "not answering is not a pass"
  // beside a zero exit tells a reader the opposite of what happened, and hides that the
  // comparison never ran at all. The one cannot-answer shape lives in `cannotAnswerExit`.
  process.exit(cannotAnswerExit(`read ${spec} from the registry`, reply.reason, offlineOk));
}

const rows = dependencyDrift(reply.manifest, local);
if (rows.length > 0) {
  console.error(
    `::error::${spec} is already published, and this tree declares a DIFFERENT install surface. ` +
      `Publishing would be skipped, so the change would never reach npm — bump the version.`,
  );
  for (const r of rows) {
    console.error(`  ${r.block}.${r.name}: published ${r.published} · here ${r.local}`);
  }
  process.exit(1);
}

// Manifest at parity — the exact hole R3-751 closed: a source-only change under an
// already-published version passes everything above while every consumer keeps the old
// bytes. Compare the packed payloads, `package.json` included.
//
// No `process.exit` inside the try: it terminates without unwinding, so the `finally`
// that removes the pack directories would never run and every strict comparison would
// leak both. Every path sets `exitCode` and falls through to the one exit at the end.
let publishedPack;
let localPack;
let exitCode = 0;
try {
  publishedPack = packTarball([spec], ROOT);
  localPack = packTarball([], ROOT);
  const payloadRows = payloadDrift(entryDigests(publishedPack.tarball), entryDigests(localPack.tarball));
  if (payloadRows.length === 0) {
    console.log(`✓ ${spec} on npm declares the same install surface and ships the same payload as this tree.`);
  } else {
    console.error(
      `::error::${spec} is already published, and this tree's packed PAYLOAD differs from the published package ` +
        `in ${payloadRows.length} file(s). Publishing would be skipped, so the change would never reach npm — bump the version.`,
    );
    for (const r of payloadRows.slice(0, 20)) {
      const short = (d) => (d === '(absent)' ? d : `${d.slice(0, 12)}…`);
      console.error(`  ${r.path}: published ${short(r.published)} · here ${short(r.local)}`);
    }
    if (payloadRows.length > 20) console.error(`  …and ${payloadRows.length - 20} more.`);
    exitCode = 1;
  }
} catch (e) {
  // The payload comparison could not RUN — the same class as an unreadable registry, and
  // never reported as a pass. Downgraded only by --offline-ok, like that case.
  exitCode = cannotAnswerExit(
    'compare the packed payload',
    e instanceof Error ? e.message : String(e),
    offlineOk,
  );
} finally {
  for (const pack of [publishedPack, localPack]) {
    if (pack) rmSync(pack.dir, { recursive: true, force: true });
  }
}
process.exit(exitCode);
