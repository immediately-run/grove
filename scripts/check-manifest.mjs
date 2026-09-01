#!/usr/bin/env node
// The manifest ↔ reality gate (R3-277c: "the manifest is validated against reality — a
// component exported but missing from the manifest, or vice versa, fails the engine's own
// `npm run verify`").
//
// A manifest that drifts from the code is worse than no manifest: a corpus checker would
// flag a component that works, or pass one that does not, and a composing shell would be
// told it may override something that no longer exists. So this runs in `verify`, before
// lint and build, because it is the cheapest of the three and the one whose failure is
// most confusing to debug later.
//
// It reads GROVE_MDX's keys by parsing the module rather than importing it (the module
// pulls in TSX, CSS and the SDK — not loadable from plain node), but it parses the OBJECT
// LITERAL's keys, not a regex over the whole file. That is the distinction R3-277c asks
// for: reformatting `mdxComponents.ts` must not change the outcome.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'viewer.manifest.json'), 'utf8'));
const source = readFileSync(join(root, 'src/mdxComponents.ts'), 'utf8');

/**
 * Strip comments and string literals, replacing each with equivalent-length whitespace so
 * every offset in the result still lines up with the original. Brace-matching MUST run
 * over this and not the raw source: a `}` inside a comment or a string would otherwise end
 * the object literal early, and the failure mode is the worst kind — the gate reports the
 * whole manifest as drifted, which reads as "the manifest is broken" rather than "the
 * scanner is". (Found by planting a `}`-bearing comment; see the reformatting test.)
 */
function blankNonCode(src) {
  const out = src.split('');
  let i = 0;
  const blankTo = (end) => {
    for (; i < end && i < out.length; i++) if (out[i] !== '\n') out[i] = ' ';
  };
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const nl = src.indexOf('\n', i);
      blankTo(nl === -1 ? src.length : nl);
    } else if (two === '/*') {
      const close = src.indexOf('*/', i + 2);
      blankTo(close === -1 ? src.length : close + 2);
    } else if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
      const quote = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
      blankTo(Math.min(j + 1, src.length));
    } else {
      i++;
    }
  }
  return out.join('');
}

/** The keys of the `export const GROVE_MDX = { … }` object literal, brace-matched over the
 *  comment- and string-blanked source so reformatting cannot change the outcome. */
function groveMdxKeys(rawSrc) {
  const src = blankNonCode(rawSrc);
  const start = src.indexOf('export const GROVE_MDX = {');
  if (start === -1) throw new Error('GROVE_MDX object literal not found in src/mdxComponents.ts');
  const open = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) {
        end = j;
        break;
      }
    }
  }
  if (end === -1) throw new Error('GROVE_MDX object literal is unterminated');
  const keys = [];
  let nesting = 0;
  for (const line of src.slice(open + 1, end).split('\n')) {
    // Only TOP-level keys are the vocabulary; a nested object's keys are props, not
    // components.
    const before = nesting;
    for (const ch of line) {
      if (ch === '{' || ch === '[') nesting++;
      else if (ch === '}' || ch === ']') nesting--;
    }
    if (before !== 0) continue;
    const m = line.match(/^\s*([A-Za-z_$][\w$]*)\s*[,:]/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

const exported = new Set(groveMdxKeys(source));
const declared = new Set(Object.keys(manifest.components));

const errors = [];

for (const name of exported) {
  if (!declared.has(name)) {
    errors.push(
      `  ${name} — registered in GROVE_MDX but NOT in the manifest. A corpus can use it and ` +
        `a checker will flag it; a shell cannot override it. Declare it, or make it internal ` +
        `by removing it from GROVE_MDX.`,
    );
  }
}
for (const name of declared) {
  if (manifest.components[name].tier === 'corpus') continue; // declared by a corpus, not here
  if (!exported.has(name)) {
    errors.push(
      `  ${name} — declared in the manifest but NOT registered in GROVE_MDX. A corpus using ` +
        `it renders nothing, and a shell overriding it overrides a component that never runs.`,
    );
  }
}

// The viewer identity must match the package it ships in, or a shell resolving the
// manifest by package name gets someone else's contract.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (manifest.viewer.name !== pkg.name) {
  errors.push(`  viewer.name "${manifest.viewer.name}" ≠ package.json name "${pkg.name}".`);
}
const provides = (pkg['immediately.run']?.provides ?? []).map((p) => p.task);
if (manifest.viewer.task && !provides.includes(manifest.viewer.task)) {
  errors.push(
    `  viewer.task "${manifest.viewer.task}" is not in package.json immediately.run.provides ` +
      `(${provides.join(', ') || 'none'}).`,
  );
}

// Every export must be reachable, or a shell's import fails at compose time rather than here.
for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  try {
    readFileSync(join(root, target));
  } catch {
    errors.push(`  exports["${subpath}"] → ${target} does not exist.`);
  }
}

// ── R3-309 — the layout-catalogue gates ─────────────────────────────────────
//
// The manifest's `layouts` entries and the files under content/_layouts/ must agree
// in BOTH directions (the same two-way rule the components section enforces), and a
// shipping starter's OWN frontmatter must carry the `layoutRole` its entry declares.
// That is the job the field was given: it sat unread in the sample layouts for a
// year, and "an inert field in a file people copy is a field people will copy".

const LAYOUTS_DIR = join(root, 'content', '_layouts');
const starterIds =
  existsSync(LAYOUTS_DIR)
    ? readdirSync(LAYOUTS_DIR, { withFileTypes: true })
        .filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
        .map((e) => e.name.replace(/\.mdx?$/, ''))
    : [];

/** The frontmatter block of a starter, as key → value (scalars only — that is all a
 *  starter declares). */
function frontmatterOf(file) {
  const src = readFileSync(join(LAYOUTS_DIR, file), 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (m) for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return fm;
}

const declaredLayouts = manifest.layouts ?? {};
for (const [id, entry] of Object.entries(declaredLayouts)) {
  if (entry.ships && !starterIds.includes(id)) {
    errors.push(`  layouts.${id} — declared ships:true but content/_layouts/${id}.mdx does not exist.`);
  }
  if (entry.ships) {
    const fm = frontmatterOf(`${id}.mdx`);
    if (fm.layoutRole !== entry.layoutRole) {
      errors.push(
        `  layouts.${id} — manifest says layoutRole:${entry.layoutRole}, the starter's frontmatter says ` +
          `${JSON.stringify(fm.layoutRole)}. The two must agree.`,
      );
    }
    if (fm.nav && fm.nav !== 'top' && fm.nav !== 'side') {
      errors.push(`  layouts.${id} — nav:${fm.nav} is neither 'top' nor 'side'; resolveNavMode would silently fall back.`);
    }
  }
}
for (const id of starterIds) {
  if (!declaredLayouts[id]) {
    errors.push(
      `  content/_layouts/${id}.mdx — a starter on disk with NO manifest entry. It renders (when ` +
        `copied) but nothing declares it: a corpus checker cannot find it and an agent cannot discover it.`,
    );
  }
}

// Collection shapes ride on engine components; a declared component that is not in the
// vocabulary is the same lie as an undeclared one in the components section.
const collections = manifest.collections ?? {};
for (const [id, entry] of Object.entries(collections)) {
  if (entry.component && !exported.has(entry.component)) {
    errors.push(
      `  collections.${id} — rides on "${entry.component}", which is not registered in GROVE_MDX. ` +
        `A corpus writing the documented call renders nothing.`,
    );
  }
  for (const [prop, value] of Object.entries(entry.props ?? {})) {
    if (/^\{.*\}$/.test(value)) {
      errors.push(`  collections.${id} — props.${prop} is an EXPRESSION (${value}). The interpreter drops it silently.`);
    }
  }
}

if (errors.length) {
  console.error(`FAIL manifest ↔ reality (${errors.length}):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(
  `OK ${manifest.viewer.name}: ${declared.size} components declared, ` +
    `${[...declared].filter((n) => manifest.components[n].overridable).length} overridable, ` +
    `${Object.keys(pkg.exports ?? {}).length} export subpaths resolve, ` +
    `${starterIds.length} layout starter(s), ${Object.keys(collections).length} collection shape(s).`,
);
