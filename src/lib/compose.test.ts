import { describe, expect, it } from 'vitest';
import {
  ManifestOverrideError,
  VIEWER_MANIFEST,
  composeComponents,
  manifestNames,
  overridableNames,
} from './compose';

// PLATFORM_LAYERING_SPEC §1.1 M3 — library composition. The manifest is the whole override
// surface, and R3-280's exit says an override of an unmanifested component must fail
// VISIBLY, not silently. These pin that, because silent is the easy accident: `{...base,
// ...overrides}` accepts anything.

const Stock = () => null;
const Custom = () => null;
const base = { Callout: Stock, Toc: Stock, Outlet: Stock } as Record<string, unknown>;

describe('composeComponents — the manifest IS the override surface', () => {
  it('applies an override of a declared, overridable component', () => {
    const composed = composeComponents(base, { Callout: Custom });
    expect(composed.Callout).toBe(Custom);
    expect(composed.Toc).toBe(Stock);
  });

  it('leaves the base untouched when there are no overrides', () => {
    expect(composeComponents(base)).toEqual(base);
  });

  it('THROWS on a component that is not in the manifest — internals stay internal', () => {
    // The failure a silent merge would produce: a shell ships `SafeEntryBody: Custom`,
    // nothing happens, and nobody learns why until someone reads the render path.
    expect(() => composeComponents(base, { SafeEntryBody: Custom })).toThrow(
      ManifestOverrideError,
    );
    expect(() => composeComponents(base, { Nonexistent: Custom })).toThrow(
      /not in the manifest: Nonexistent/,
    );
  });

  it('THROWS on a declared-but-locked component', () => {
    // Outlet is the standing case: replacing it detaches every layout layer from the page
    // it wraps, and the symptom is a blank body rather than an error.
    expect(() => composeComponents(base, { Outlet: Custom })).toThrow(
      /declared but not overridable: Outlet/,
    );
  });

  it('reports EVERY offending name at once, not one per rebuild', () => {
    try {
      composeComponents(base, { Nope: Custom, AlsoNope: Custom, Outlet: Custom });
      throw new Error('expected a throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestOverrideError);
      expect((e as ManifestOverrideError).names.sort()).toEqual(
        ['AlsoNope', 'Nope', 'Outlet'].sort(),
      );
    }
  });

  it('names the available surface in the message, so the fix is in the error', () => {
    expect(() => composeComponents(base, { Nope: Custom })).toThrow(/declared: .*Callout/);
  });
});

describe('the manifest itself', () => {
  it('declares a non-empty, strictly smaller overridable surface', () => {
    expect(manifestNames().length).toBeGreaterThan(0);
    expect(overridableNames().length).toBeGreaterThan(0);
    // If everything were overridable the `overridable` flag would be decoration.
    expect(overridableNames().length).toBeLessThan(manifestNames().length);
  });

  it('carries the viewer identity a shell resolves the contract by', () => {
    expect(VIEWER_MANIFEST.viewer.name).toBe('@immediately-run/grove');
    expect(VIEWER_MANIFEST.viewer.task).toBe('open-wiki');
  });

  it('declares the engine frontmatter keys it reads, and stays open to the rest', () => {
    // Pass-through is what keeps a foreign corpus with its own vocabulary renderable
    // (PLATFORM_LAYERING §5 target 1).
    expect(VIEWER_MANIFEST.frontmatter?.engine).toContain('layout');
    expect(VIEWER_MANIFEST.frontmatter?.passThrough).toBe(true);
  });

  it('gives every component a tier and an overridable flag', () => {
    for (const [name, c] of Object.entries(VIEWER_MANIFEST.components)) {
      expect(['engine', 'chrome', 'corpus'], name).toContain(c.tier);
      expect(typeof c.overridable, name).toBe('boolean');
    }
  });
});
