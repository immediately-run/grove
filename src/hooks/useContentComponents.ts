// Corpus-declared components — the LOAD half (R3-174; MDX_FROM_MOUNT_SPEC §2).
//
// Reads the corpus's own `immediately.run.json`, evaluates each declared module out of the
// corpus filesystem, and hands back a `name → component` map for the MDX provider. The
// declaration half (what counts as a usable entry) is `lib/corpusComponents`.
//
// **Why this can evaluate a module that lives in someone else's repo.** It is the same
// call `<Include>` already makes for every entry body: `getModuleEvaluationContext` on an
// absolute path. Under dispatch that path is in the corpus mount, and the bundler
// transpiles and evaluates it exactly as it does an `/app` module — the two filesystems
// differ in where the bytes come from, not in how a module is made from them.
//
// **What a content component may import, and why it is not restricted** (decision B,
// 2026-08-26; recorded in `MDX_FROM_MOUNT_SPEC` §2). `resolveAsync` walks the dirname
// chain from the importing file, and `/node_modules` is one registryfs shared by the whole
// frame — so a corpus module's `react` and `@immediately-run/sdk` are THE VIEWER'S
// instances, not second copies. That is what makes `useMetadataQuery` and `<Link>` work
// from content: same React, same context. It also means confinement would have to be
// added deliberately, and the decision is not to: inside an executor there is nothing to
// confine, since the module reaches `globalThis.fetch` whatever the resolver permits
// (`MDX_FROM_MOUNT_SPEC` §4 already concedes this). A corpus that wants no code execution
// declares `render: safe`, where no import exists at all.
//
// **No live re-registration in v1, deliberately.** §7 1b asks for a reactive, name-keyed
// registry so a hot edit cannot leave a stale reference behind. The map here IS keyed by
// name, so re-evaluation overwrites cleanly — but nothing re-triggers it: the working-tree
// change stream (`onFsChange`) is gated on elevated `editor:read`, which a dispatched
// viewer does not hold, so there is no signal to subscribe to. An author edit needs a
// reload. The shape is the one that extends; the trigger is what is missing.

import { useEffect, useState } from 'react';
import fs from 'fs';
import { parseCorpusComponents, type RejectedComponent } from '../lib/corpusComponents';

declare const module: {
  getModuleEvaluationContext: (name: string) => Promise<{ exports: Record<string, unknown> }>;
};

/** The marker file a corpus uses to declare itself content (and now its vocabulary). */
const MARKER = 'immediately.run.json';

export interface ContentComponents {
  /** `idle` — no corpus root yet, nothing to do · `loading` — hold the render, the
   *  provider must be complete before content paints · `ready` — use `components`. */
  status: 'idle' | 'loading' | 'ready';
  /** Name → component, empty when the corpus declares none (the ordinary case). */
  components: Record<string, unknown>;
  /** Declarations that could not be used, with the reason. Rendered by the caller as a
   *  visible notice rather than swallowed: a component that silently never appears is the
   *  failure mode this whole path exists to remove. */
  rejected: RejectedComponent[];
}

const NOTHING: ContentComponents = { status: 'idle', components: {}, rejected: [] };

async function loadDeclared(root: string): Promise<Omit<ContentComponents, 'status'>> {
  const base = root.endsWith('/') ? root : `${root}/`;
  let marker: unknown;
  try {
    marker = JSON.parse(await fs.promises.readFile(`${base}${MARKER}`, 'utf8'));
  } catch {
    // No marker, or unreadable/malformed JSON. Both mean "this corpus declares no
    // components" — the overwhelmingly common case, and not worth a notice.
    return { components: {}, rejected: [] };
  }
  const { components: declared, rejected } = parseCorpusComponents(marker, base);
  const components: Record<string, unknown> = {};
  const failures = [...rejected];
  // Sequential, not parallel: the list is short (a corpus declares a vocabulary, not a
  // dependency closure) and the bundler already dedups and queues resolution, so
  // concurrency here buys nothing and makes a failure harder to attribute.
  for (const { name, path } of declared) {
    try {
      const evaluated = await module.getModuleEvaluationContext(path);
      // `default` is the convention every other module-from-a-path surface uses
      // (`<Include exportedSymbol="default">`); a named export matching the declared
      // name is accepted too, so a file exporting `export function RoadmapBoard()` and
      // nothing else works without a redundant default re-export.
      const component = evaluated.exports.default ?? evaluated.exports[name];
      if (typeof component !== 'function') {
        failures.push({ name, reason: `${path} exports no component (default or ${name})` });
        continue;
      }
      components[name] = component;
    } catch (error) {
      failures.push({ name, reason: `${path} failed to load: ${String(error)}` });
    }
  }
  return { components, rejected: failures };
}

/**
 * Load the components `root`'s corpus declares, or do nothing when `root` is null (the
 * boot gate has not resolved a corpus yet).
 *
 * Returns `loading` until every declaration has resolved, so the caller can hold the
 * content paint. That is the §2 invariant — compose the complete provider before content
 * paints, never render into a partial one — and it costs nothing here because Grove
 * already gates on `useOpenWikiBoot` and `useCorpusMetadata`. Rendering into a
 * half-composed provider would flash a missing-component error for `<RoadmapBoard>` until
 * registration landed, which is exactly the error this path removes.
 */
export function useContentComponents(root: string | null): ContentComponents {
  const [loaded, setLoaded] = useState<{ root: string } & Omit<ContentComponents, 'status'> | null>(null);

  useEffect(() => {
    if (!root || loaded?.root === root) return;
    let cancelled = false;
    void loadDeclared(root).then((result) => {
      if (!cancelled) setLoaded({ root, ...result });
    });
    return () => {
      cancelled = true;
    };
  }, [root, loaded?.root]);

  if (!root) return NOTHING;
  if (loaded?.root === root) {
    return { status: 'ready', components: loaded.components, rejected: loaded.rejected };
  }
  return { status: 'loading', components: {}, rejected: [] };
}
