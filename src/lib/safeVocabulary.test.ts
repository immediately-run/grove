// R3-1290 — the interpreter's map is the shell's vocabulary, layered in one place. Inputs are
// the REAL `GROVE_MDX`, `SAFE_INTRINSICS` and SDK defaults, so a vocabulary change moves
// these cases rather than a typed list.
import { describe, expect, it } from 'vitest';
import { DEFAULT_MDX_COMPONENTS } from '@immediately-run/sdk';
import { GROVE_MDX, SAFE_MDX } from '../mdxComponents';
import { SAFE_INTRINSICS } from './safeIntrinsics';
import { safeVocabulary } from './safeVocabulary';

describe('safeVocabulary', () => {
  it('for stock Grove is exactly SAFE_MDX — the export keeps its value', () => {
    const stock = safeVocabulary(GROVE_MDX);
    expect(Object.keys(stock).sort()).toEqual(Object.keys(SAFE_MDX).sort());
    for (const name of Object.keys(SAFE_MDX)) expect(stock[name], name).toBe(SAFE_MDX[name as keyof typeof SAFE_MDX]);
  });

  it('carries every GROVE_MDX name, the SDK defaults and the safe intrinsics', () => {
    const stock = safeVocabulary(GROVE_MDX);
    for (const name of Object.keys(GROVE_MDX)) expect(stock, name).toHaveProperty(name);
    for (const name of Object.keys(DEFAULT_MDX_COMPONENTS)) expect(stock, name).toHaveProperty(name);
    for (const name of Object.keys(SAFE_INTRINSICS)) expect(stock, name).toHaveProperty(name);
  });

  it("puts the shell's map on top: a shell entry wins over GROVE_MDX's", () => {
    const Shell = () => null;
    const out = safeVocabulary({ ...GROVE_MDX, Callout: Shell, ShellBadge: Shell });
    expect(out.Callout).toBe(Shell);
    expect(out.ShellBadge).toBe(Shell);
  });

  it("keeps GROVE_MDX's a and img over the intrinsics and the SDK defaults", () => {
    const stock = safeVocabulary(GROVE_MDX);
    expect(GROVE_MDX.a).toBeTypeOf('function');
    expect(GROVE_MDX.img).toBeTypeOf('function');
    expect(stock.a).toBe(GROVE_MDX.a);
    expect(stock.img).toBe(GROVE_MDX.img);
  });
});
