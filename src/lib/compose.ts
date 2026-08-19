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
