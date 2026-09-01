// The content-stylesheet grammar gate (R3-316; plan 05-content-carried-themes).
//
// Author-supplied CSS is contained by a GRAMMAR, not by the CSP: a `ui/stylesheet`
// entry may carry declarations and NOTHING else. A selector would let it reach
// the DOM (and hide the theme control); `url(`/`@import`/`@font-face` would let
// it name a network location — the existence-oracle channel the CSP does not
// close for an INTERPRETED, SHARED space (no CSP at all there), which is the gap
// this grammar closes in every stance.
//
// Comments and strings are BLANKED (whitespace of equal length, offsets
// preserved) before the SCAN — a `url(` inside a comment must not decide the
// outcome, and a selector hidden in a string must not be smuggled through. The
// EMITTED declarations come from the original bytes (a declaration's quoted
// values are legitimate: `--font-body: "Lora", serif;`), which is safe precisely
// because the blanked scan already proved every line is a declaration.

export type GateResult =
  | { ok: true; declarations: string }
  | { ok: false; line: number; reason: string; excerpt: string };

/** Blank `/* … *``/` comments and quoted strings with offset-preserving whitespace. */
export function blankCssNoise(src: string): string {
  const out = src.split('');
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') {
      const close = src.indexOf('*/', i + 2);
      const end = close === -1 ? src.length : close + 2;
      blank(i, end);
      i = end;
    } else if (src[i] === '"' || src[i] === "'") {
      const quote = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
      blank(i + 1, Math.min(j, src.length)); // blank the CONTENTS, keep the quotes
      i = Math.min(j + 1, src.length);
    } else {
      i += 1;
    }
  }
  return out.join('');
}

/** The line number (1-based) an index falls on. */
function lineOf(src: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line += 1;
  return line;
}

const REJECTS: Array<{ re: RegExp; reason: string }> = [
  { re: /@import/i, reason: '@import names a location — declarations only' },
  { re: /@font-face/i, reason: '@font-face is engine-emitted from declared faces, never authored' },
  { re: /@layer/i, reason: 'layer order is engine-owned' },
  { re: /@/i, reason: 'at-rules are not declarations' },
  { re: /\burl\(/i, reason: 'url( names a location — assets are declared (fonts:/assets:), never named' },
];

/**
 * Gate a stylesheet's bytes: declarations only, each line `--token: value;`.
 * A rejected verdict names the line and quotes it from the original bytes.
 */
export function gateStylesheet(css: string): GateResult {
  const blanked = blankCssNoise(css);
  // At-rules first, so `@font-face { … }` reports @font-face (the specific
  // violation) rather than the generic brace catch; url( after both.
  for (const { re, reason } of REJECTS) {
    const m = re.exec(blanked);
    if (m) {
      const line = lineOf(css, m.index);
      return { ok: false, line, reason, excerpt: css.split('\n')[line - 1]?.trim().slice(0, 80) ?? '' };
    }
  }
  const braced = blanked.search(/[{}]/);
  if (braced !== -1) {
    const line = lineOf(css, braced);
    return {
      ok: false,
      line,
      reason: 'a selector/rule block — a ui/stylesheet carries declarations only',
      excerpt: css.split('\n')[line - 1]?.trim().slice(0, 80) ?? '',
    };
  }
  const scanLines = blanked.split('\n');
  const origLines = css.split('\n');
  for (let i = 0; i < scanLines.length; i++) {
    const line = scanLines[i].trim();
    if (!line) continue;
    if (!/^--[\w-]+\s*:[^;]*;?$/.test(line)) {
      return {
        ok: false,
        line: i + 1,
        reason: 'not a custom-property declaration (declarations only, `--token: value;`)',
        excerpt: origLines[i]?.trim().slice(0, 80) ?? '',
      };
    }
  }
  return { ok: true, declarations: origLines.map((l) => l.trim()).filter(Boolean).join('\n') };
}
