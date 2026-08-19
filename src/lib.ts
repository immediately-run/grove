// The library entry (PLATFORM_LAYERING_SPEC §1.1 mode M3, R3-280).
//
// Grove composes with a corpus in three modes and this is the third: a thin shell — an
// ordinary `App.tsx` — imports the engine as a pinned dependency and arranges it, keeping
// ownership of composition without forking engine source. The other two modes are
// unchanged by this file: `src/App.tsx` is still the fork/dispatch entry immediately.run
// renders, and it is exported here too, so a shell that wants the whole wiki (gate
// included) mounts one component.
//
// What Grove IS, stated once because the packaging makes it answerable: a kit of React
// components, prebuilt layouts and themes that make a wiki easy to build and good-looking
// by default — NOT a wiki engine in the traditional sense. The parts a traditional wiki
// engine owns are cross-cutting platform concerns and live below this package: routing,
// MDX compilation, the frontmatter metadata index, link spaces, includes and heading
// anchors are sandbox + SDK, because every immediately.run app needs them and not only
// wikis. What is left here — and it is a real thing to own — is the vocabulary, the
// chrome, and the defaults.
//
// Exports only. No component is DEFINED here, so the Fast-Refresh rule is satisfied by
// re-export; the components themselves live one per file as they always did.

export { default as GroveApp } from './App';
export { default as GroveWiki } from './GroveWiki';

// The component vocabulary + the two render maps.
export { GROVE_MDX, SAFE_MDX } from './mdxComponents';

// The override contract of library composition.
export {
  VIEWER_MANIFEST,
  ManifestOverrideError,
  composeComponents,
  manifestNames,
  overridableNames,
} from './lib/compose';
export type { ViewerManifest, ManifestComponent } from './lib/compose';

// Shell state, so an overriding chrome component can read what the stock one reads.
export { GroveShellContext, OutletContext, useShell } from './lib/shell';
export type { GroveShell, NavItem } from './lib/shell';

// Corpus helpers a shell needs to address entries the way the engine does.
export {
  contentDir,
  homeKey,
  isContentEntry,
  keyToFsPath,
  keyToHref,
  keyToInclude,
  sandboxPathToKey,
} from './lib/content';
export { getContentRoot, isDispatched } from './lib/contentRoot';
export { layoutChainForKey } from './lib/layout';
export { queryPaths, readingTime, stripFrontmatter } from './lib/wiki';
