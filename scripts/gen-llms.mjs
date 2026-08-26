#!/usr/bin/env node
/*
 * Generate `llms.txt` for @immediately-run/grove — the agent-facing API map
 * (the SDK set the pattern: a concise, generated index of every public export,
 * fetchable in one read; grove's CLAUDE.md routes agents to it).
 *
 * WHY THIS IS GENERATED FROM THE MANIFEST, NOT TYPEDOC: grove's contract surface
 * is the DECLARED manifest (`viewer.manifest.json`) plus the package exports map —
 * both already gate-checked against reality (`check-manifest.mjs`,
 * `check-engine-api.mjs`, both in `verify`). Deriving the doc from the same sources
 * means it cannot rot: changing the vocabulary without regenerating fails `verify`
 * (`--check`), exactly like the api-snapshot discipline.
 *
 * Usage:
 *   node scripts/gen-llms.mjs            (write llms.txt)
 *   node scripts/gen-llms.mjs --check    (fail if the committed file is stale)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'llms.txt');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'viewer.manifest.json'), 'utf8'));

/** Named exports of src/lib.ts — the same brace-matched parse check-engine-api uses. */
function libExports() {
  const src = readFileSync(join(ROOT, 'src/lib.ts'), 'utf8');
  const out = [];
  for (const m of src.matchAll(/^export (?:type )?\{([^}]*)\}/gm)) {
    for (let spec of m[1].split(',')) {
      spec = spec.trim();
      if (!spec) continue;
      const asMatch = spec.match(/\sas\s+(\w+)$/);
      out.push(asMatch ? asMatch[1] : spec.split(/\s+/)[0]);
    }
  }
  return [...new Set(out)].sort();
}

const lines = [];
lines.push(`# ${pkg.name} — the viewer kit for directory-as-content wikis`);
lines.push('');
lines.push(`> ${pkg.description ?? 'A (plugin-extensible) kit of React components, prebuilt layouts and themes that make a wiki easy to build.'} (v${pkg.version})`);
lines.push('');
lines.push('Grove is NOT a wiki engine: routing, MDX compilation, the frontmatter index, link');
lines.push('spaces and heading anchors live in the sandbox + `@immediately-run/sdk`. What this');
lines.push('package owns is the component vocabulary, the chrome, the layout chain, the themes,');
lines.push('and the defaults. Three composition modes (PLATFORM_LAYERING_SPEC §1.1):');
lines.push('');
lines.push('- **M1 dispatch** — a content repo with `opensWith: {task: "open-wiki"}` resolves here;');
lines.push('  you write no code, the host mounts the corpus.');
lines.push('- **M2 fork** — engine + corpus in one repo (the docs wiki shape).');
lines.push('- **M3 library** — a thin shell imports this package pinned and composes it:');
lines.push('  see `examples/thin-shell/`, and the override contract below.');
lines.push('');
lines.push('## Import surface (package.json exports)');
lines.push('');
for (const [sub, target] of Object.entries(pkg.exports ?? {})) {
  lines.push(`- \`@immediately-run/grove${sub === '.' ? '' : sub.replace(/^\./, '')}\` → ${target}`);
}
lines.push('');
lines.push('## Composition entry (src/lib.ts)');
lines.push('');
for (const name of libExports()) {
  lines.push(`- \`${name}\``);
}
lines.push('');
lines.push('## Component vocabulary — the override contract (viewer.manifest.json)');
lines.push('');
lines.push('This is THE two-way surface: what a corpus may use, and what a library-composing');
lines.push('shell may override. `composeComponents(base, overrides)` THROWS on a name that is');
lines.push('not declared here or is declared `overridable: false` — overriding never silently');
lines.push('no-ops. Tiers: `engine` renders any corpus · `chrome` is site furniture · `corpus`');
lines.push('is one corpus\'s conventions (declared by that corpus, not this repo).');
lines.push('');
for (const [name, c] of Object.entries(manifest.components ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
  const props = Object.entries(c.props ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ');
  lines.push(
    `- \`${name}\` (${c.tier}${c.overridable ? ', overridable' : ', LOCKED'}${c.sanitizing ? ', sanitizing' : ''})` +
      `${c.summary ? ` — ${c.summary}` : ''}${props ? ` Props: ${props}.` : ''}`
  );
}
lines.push('');
lines.push('## Frontmatter keys the engine reads');
lines.push('');
const fm = manifest.frontmatter ?? {};
for (const k of fm.engine ?? []) lines.push(`- \`${k}\``);
lines.push('');
lines.push(
  fm.passThrough
    ? 'Unknown keys pass through (carried, unread) — a corpus may keep its own vocabulary.'
    : 'The vocabulary is CLOSED: unknown keys are rejected.'
);
lines.push('');
lines.push('## What lives one layer down (do not reimplement here)');
lines.push('');
lines.push('- Platform client (RPC, capabilities, mounts, fs, editor, LLM): `@immediately-run/sdk`');
lines.push('  — its llms.txt: https://immediately-run.github.io/immediately-run-sdk/llms.txt');
lines.push('- Link-space resolver + grammar canon: `@immediately-run/mdx-plugins`');
lines.push('- Non-executable MDX rendering: `@immediately-run/safe-content`');
lines.push('');
lines.push('---');
lines.push('_Generated from viewer.manifest.json + package.json by `scripts/gen-llms.mjs`; regenerate on vocabulary changes (verify checks freshness)._');

const content = lines.join('\n') + '\n';

if (process.argv.includes('--check')) {
  let committed = '';
  try {
    committed = readFileSync(OUT, 'utf8');
  } catch {
    console.error('error: llms.txt missing — run `node scripts/gen-llms.mjs` and commit it.');
    process.exit(1);
  }
  if (committed !== content) {
    console.error('error: llms.txt is stale — run `node scripts/gen-llms.mjs` and commit the result.');
    process.exit(1);
  }
  console.log('OK llms.txt is current.');
} else {
  writeFileSync(OUT, content);
  console.log(`✓ Wrote ${OUT} (${Object.keys(manifest.components ?? {}).length} components, ${libExports().length} lib exports).`);
}
