// The corpus component DECLARATION (R3-174; MDX_FROM_MOUNT_SPEC §7 1b).
//
// Two properties matter here and neither is about the happy path. First, a bad
// declaration is NAMED, not swallowed — a `<RoadmapBoard/>` that silently never renders
// is indistinguishable from one nobody wrote, and the author has no other channel to find
// out which. Second, one bad declaration does not cost the corpus its other components.

import { describe, it, expect } from 'vitest';
import { parseCorpusComponents, resolveComponentPath } from './corpusComponents';

const ROOT = '/mnt/ec1210aa4dfa0067260861b1eeb31a9b';

describe('resolveComponentPath', () => {
  it('resolves a corpus-relative path, with or without ./', () => {
    expect(resolveComponentPath('./components/X.jsx', ROOT)).toBe(`${ROOT}/components/X.jsx`);
    expect(resolveComponentPath('components/X.jsx', ROOT)).toBe(`${ROOT}/components/X.jsx`);
  });

  it('tolerates a trailing slash on the root', () => {
    expect(resolveComponentPath('./x.jsx', `${ROOT}/`)).toBe(`${ROOT}/x.jsx`);
  });

  it('rejects an absolute path — that is a different space, not a corpus path', () => {
    expect(resolveComponentPath('/app/src/App.tsx', ROOT)).toBeNull();
  });

  it('rejects traversal out of the corpus, checked on the NORMALIZED path', () => {
    // `x/../../y` starts with the root as a STRING and resolves outside it as a PATH —
    // the hazard `sandboxPathToKey` documents. A marker must not be able to point the
    // engine at its own modules and have them register under a corpus name.
    expect(resolveComponentPath('../../app/src/App.tsx', ROOT)).toBeNull();
    expect(resolveComponentPath('components/../../escape.jsx', ROOT)).toBeNull();
  });

  it('rejects NUL and backslash smuggling, and the empty path', () => {
    expect(resolveComponentPath('x\0.jsx', ROOT)).toBeNull();
    expect(resolveComponentPath('..\\escape.jsx', ROOT)).toBeNull();
    expect(resolveComponentPath('', ROOT)).toBeNull();
  });

  it('rejects the corpus root itself — it is not a module', () => {
    expect(resolveComponentPath('.', ROOT)).toBeNull();
  });

  it('rejects a non-string', () => {
    expect(resolveComponentPath(42, ROOT)).toBeNull();
    expect(resolveComponentPath(null, ROOT)).toBeNull();
  });
});

describe('parseCorpusComponents', () => {
  it('reads a well-formed map', () => {
    const { components, rejected } = parseCorpusComponents(
      { components: { ProjectIndex: './components/ProjectIndex.jsx' } },
      ROOT,
    );
    expect(rejected).toEqual([]);
    expect(components).toEqual([{ name: 'ProjectIndex', path: `${ROOT}/components/ProjectIndex.jsx` }]);
  });

  it('is silent for a marker with no components key — the ordinary case', () => {
    expect(parseCorpusComponents({ opensWith: { task: 'open-wiki' } }, ROOT)).toEqual({
      components: [],
      rejected: [],
    });
    expect(parseCorpusComponents(null, ROOT)).toEqual({ components: [], rejected: [] });
  });

  it('rejects a lowercase name — MDX would resolve it as an intrinsic and never consult the provider', () => {
    const { components, rejected } = parseCorpusComponents({ components: { board: './b.jsx' } }, ROOT);
    expect(components).toEqual([]);
    expect(rejected).toEqual([{ name: 'board', reason: 'not a capitalized component name' }]);
  });

  it('rejects a name that is not a component reference at all', () => {
    const { rejected } = parseCorpusComponents({ components: { 'My-Board': './b.jsx' } }, ROOT);
    expect(rejected.map((r) => r.name)).toEqual(['My-Board']);
  });

  it('keeps the good declarations when one is bad', () => {
    const { components, rejected } = parseCorpusComponents(
      {
        components: {
          Good: './components/Good.jsx',
          Escapes: '../../app/src/App.tsx',
          AlsoGood: './components/AlsoGood.jsx',
        },
      },
      ROOT,
    );
    expect(components.map((c) => c.name)).toEqual(['Good', 'AlsoGood']);
    expect(rejected.map((r) => r.name)).toEqual(['Escapes']);
    expect(rejected[0].reason).toContain('inside the corpus');
  });

  it('rejects a components value that is not an object', () => {
    expect(parseCorpusComponents({ components: ['./x.jsx'] }, ROOT).rejected).toEqual([
      { name: '(components)', reason: 'not an object' },
    ]);
  });
});
