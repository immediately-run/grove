// Library composition (PLATFORM_LAYERING_SPEC §1.1 mode M3): a thin shell imports the
// engine as a pinned dependency and overrides components through its DECLARED surface,
// without forking engine source.
//
// The manifest is the whole contract. A component named in it is part of the engine's
// public vocabulary; anything else is internal, and internal means internal — a shell that
// overrides an unmanifested name gets an error, not a silent no-op. That asymmetry is the
// point: a silent no-op is how a shell ends up shipping an override nobody notices stopped
// working when the engine renames a component, which is exactly the drift ENGINE_BOUNDARY
// §4 records happening once already.
//
// This file exports no components, so it is exempt from the Fast-Refresh rule.

import manifest from '../../viewer.manifest.json';

/** One component's declared contract. Mirrors `viewer-manifest.schema.json`. */
export interface ManifestComponent {
  tier: 'engine' | 'chrome' | 'corpus';
  overridable: boolean;
  sanitizing?: boolean;
  props?: Record<string, string>;
  summary?: string;
}

export interface ViewerManifest {
  schemaVersion: number;
  viewer: { name: string; kind?: string; task?: string };
  components: Record<string, ManifestComponent>;
  frontmatter?: { engine?: string[]; corpusTooling?: string[]; passThrough?: boolean };
}

export const VIEWER_MANIFEST = manifest as ViewerManifest;

/** Every declared component name, in manifest order. */
export const manifestNames = (): string[] => Object.keys(VIEWER_MANIFEST.components);

/** The names a composing shell may replace (declared AND `overridable`). */
export const overridableNames = (): string[] =>
  manifestNames().filter((n) => VIEWER_MANIFEST.components[n].overridable);

/** Thrown when a shell's override map does not match the declared surface. Carries the
 *  offending names so the message can say which, not just that something was wrong. */
export class ManifestOverrideError extends Error {
  /** The offending names, so a caller can act on them rather than re-parse the message. */
  readonly names: string[];

  constructor(message: string, names: string[]) {
    super(message);
    this.name = 'ManifestOverrideError';
    this.names = names;
  }
}

/**
 * Merge a shell's overrides over a base component map, enforcing the manifest.
 *
 * Two rejections, both loud:
 *   - **not declared** — the name is not in the manifest at all (a typo, or an internal
 *     component the shell has no business replacing);
 *   - **not overridable** — the name is declared but its behaviour is engine mechanics
 *     (`Outlet` is the standing case: replacing it detaches every layout layer from the
 *     page it wraps, and the failure would show up as a blank body, not as an error).
 *
 * Both are collected before throwing, so a shell fixing several typos sees all of them in
 * one run rather than one per rebuild.
 */
export function composeComponents<T extends Record<string, unknown>>(
  base: T,
  overrides: Record<string, unknown> = {},
): T {
  const undeclared: string[] = [];
  const locked: string[] = [];
  for (const name of Object.keys(overrides)) {
    const declared = VIEWER_MANIFEST.components[name];
    if (!declared) undeclared.push(name);
    else if (!declared.overridable) locked.push(name);
  }
  if (undeclared.length || locked.length) {
    const parts: string[] = [];
    if (undeclared.length) {
      parts.push(
        `not in the manifest: ${undeclared.join(', ')} — these are engine internals, not ` +
          `part of the override surface (declared: ${overridableNames().join(', ')})`,
      );
    }
    if (locked.length) {
      parts.push(
        `declared but not overridable: ${locked.join(', ')} — their behaviour is engine ` +
          `mechanics, and replacing them breaks rendering in ways that surface as blank ` +
          `output rather than as an error`,
      );
    }
    throw new ManifestOverrideError(
      `${VIEWER_MANIFEST.viewer.name}: cannot override ${parts.join('; ')}.`,
      [...undeclared, ...locked],
    );
  }
  return { ...base, ...overrides };
}

/** Thrown when a shell's additions collide with a name it may not add. Carries the offending
 *  names, like `ManifestOverrideError`. */
export class ComponentExtensionError extends Error {
  /** The offending names, so a caller can act on them rather than re-parse the message. */
  readonly names: string[];

  constructor(message: string, names: string[]) {
    super(message);
    this.name = 'ComponentExtensionError';
    this.names = names;
  }
}

/** An MDX component name: PascalCase, as MDX resolves a capitalized tag from the map. */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;

/**
 * Add a shell's OWN components to a composed map (R3-1290) — names the engine does not
 * declare, which `composeComponents` refuses by design. An addition is a different promise
 * from an override, so it is a different call: a shell composes overrides first, then
 * extends — `extendComponents(composeComponents(GROVE_MDX, overrides), additions)` — and a
 * typo'd override can never become a silent addition, nor an addition a silent override.
 *
 * Three rejections, collected before throwing (as `composeComponents` does):
 *   - **a manifest name** — overriding the engine's vocabulary is `composeComponents`' job;
 *   - **already in `base`** — the addition would replace a component silently;
 *   - **not PascalCase** — MDX resolves only capitalized tags from the map, so a lower-case
 *     name would never render and would only shadow an HTML element.
 *
 * The result serves both render paths: the compiled one through `boot({ mdxComponents })`,
 * and `render: safe` content through the shell vocabulary the safe renderers read.
 */
export function extendComponents<T extends Record<string, unknown>>(
  base: T,
  additions: Record<string, unknown>,
): T & Record<string, unknown> {
  const declared: string[] = [];
  const present: string[] = [];
  const malformed: string[] = [];
  for (const name of Object.keys(additions)) {
    if (!COMPONENT_NAME.test(name)) malformed.push(name);
    else if (VIEWER_MANIFEST.components[name]) declared.push(name);
    else if (Object.prototype.hasOwnProperty.call(base, name)) present.push(name);
  }
  if (declared.length || present.length || malformed.length) {
    const parts: string[] = [];
    if (declared.length) {
      parts.push(`in the manifest: ${declared.join(', ')} — override those with composeComponents`);
    }
    if (present.length) parts.push(`already in the map: ${present.join(', ')} — an addition never replaces`);
    if (malformed.length) {
      parts.push(`not PascalCase: ${malformed.join(', ')} — MDX resolves only capitalized tags`);
    }
    throw new ComponentExtensionError(
      `${VIEWER_MANIFEST.viewer.name}: cannot add ${parts.join('; ')}.`,
      [...declared, ...present, ...malformed],
    );
  }
  return { ...base, ...additions };
}
