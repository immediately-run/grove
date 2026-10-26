import { describe, expect, it } from 'vitest';
import { DEFAULT_MDX_COMPONENTS } from '@immediately-run/sdk';
import {
  ComponentExtensionError,
  ManifestOverrideError,
  VIEWER_MANIFEST,
  composeComponents,
  extendComponents,
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

// R3-1290 — a shell's OWN components, which the manifest does not name. Every name below is
// checked against the REAL viewer.manifest.json, so a manifest change moves these cases.
describe('extendComponents — a shell adds names the engine does not declare', () => {
  const Badge = () => null;

  it('adds a new PascalCase name, keeping the base', () => {
    const out = extendComponents(base, { ShellBadge: Badge });
    expect(out.ShellBadge).toBe(Badge);
    expect(out.Callout).toBe(Stock);
    expect(manifestNames()).not.toContain('ShellBadge');
  });

  it('refuses a manifest name — overriding is composeComponents\' job — naming it', () => {
    expect(manifestNames()).toContain('Callout');
    expect(() => extendComponents({}, { Callout: Badge })).toThrow(ComponentExtensionError);
    expect(() => extendComponents({}, { Callout: Badge })).toThrow(/in the manifest: Callout/);
  });

  it('refuses a name already in the base — an addition never replaces', () => {
    const withBadge = { ...base, ShellBadge: Stock };
    try {
      extendComponents(withBadge, { ShellBadge: Badge });
      throw new Error('expected a throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ComponentExtensionError);
      expect((e as ComponentExtensionError).names).toEqual(['ShellBadge']);
      expect(String(e)).toMatch(/already in the map: ShellBadge/);
    }
  });

  // Derived from the REAL SDK defaults: none is in the manifest or GROVE_MDX, so the base a
  // shell composes never holds them, and only this check stops a silent replacement.
  it.each(Object.keys(DEFAULT_MDX_COMPONENTS).filter((n) => /^[A-Z]/.test(n)))(
    'refuses %s, an SDK default the platform layers under the shell map',
    (name) => {
      expect(manifestNames()).not.toContain(name);
      expect(() => extendComponents(base, { [name]: Badge })).toThrow(ComponentExtensionError);
      expect(() => extendComponents(base, { [name]: Badge })).toThrow(new RegExp(`an SDK default: ${name}`));
    },
  );

  it('refuses a name that is not PascalCase', () => {
    expect(() => extendComponents(base, { shellBadge: Badge })).toThrow(/not PascalCase: shellBadge/);
    expect(() => extendComponents(base, { 'Shell-Badge': Badge })).toThrow(/not PascalCase/);
  });

  it('reports every offender in one throw', () => {
    try {
      extendComponents(base, { Callout: Badge, Toc: Badge, lower: Badge });
      throw new Error('expected a throw');
    } catch (e) {
      expect((e as ComponentExtensionError).names.sort()).toEqual(['Callout', 'Toc', 'lower']);
    }
  });
});
