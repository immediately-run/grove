// @vitest-environment jsdom
// R3-1290 — the shell vocabulary is captured ABOVE the corpus provider. The case below
// mounts the capture the way App does: a shell provider outside, the capture, then a
// nested corpus provider; a safe renderer inside must see the shell's map and not the
// corpus's. Capturing below the corpus provider fails it.
import { describe, it, expect } from 'vitest';
import { act, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MDXProvider } from '@immediately-run/sdk/MDXProvider';
import { ShellVocabularyContext } from '../lib/shell';
import { useShellVocabularyCapture } from './useShellVocabularyCapture';
import { useSafeVocabulary } from './useSafeVocabulary';
import { SAFE_MDX } from '../mdxComponents';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ShellProbe = () => null;
const CorpusProbe = () => null;

type Vocab = Record<string, unknown>;
type Seen = { captured?: Vocab | null; safe?: Vocab };
type Report = { onCaptured: (m: Vocab | null) => void; onSafe: (m: Vocab) => void };

function render(tree: (report: Report) => ReactNode): Seen {
  const seen: Seen = {};
  const report: Report = {
    onCaptured: (m) => {
      seen.captured = m;
    },
    onSafe: (m) => {
      seen.safe = m;
    },
  };
  const r = createRoot(document.createElement('div'));
  act(() => r.render(tree(report)));
  act(() => r.unmount());
  return seen;
}

function Capture({ report, corpus }: { report: Report; corpus?: boolean }) {
  const shell = useShellVocabularyCapture();
  const { onCaptured } = report;
  useEffect(() => onCaptured(shell), [onCaptured, shell]);
  const inner = (
    <ShellVocabularyContext value={shell}>
      <SafeReader onSafe={report.onSafe} />
    </ShellVocabularyContext>
  );
  return corpus ? <MDXProvider components={{ CorpusProbe }}>{inner}</MDXProvider> : inner;
}

function SafeReader({ onSafe }: { onSafe: (m: Vocab) => void }) {
  const safe = useSafeVocabulary();
  useEffect(() => onSafe(safe), [onSafe, safe]);
  return null;
}

describe('useShellVocabularyCapture (R3-1290)', () => {
  it("captures the shell provider's map, and a nested corpus provider never reaches the safe map", () => {
    const seen = render((s) => (
      <MDXProvider components={{ ShellProbe }}>
        <Capture report={s} corpus />
      </MDXProvider>
    ));
    expect(seen.captured).toMatchObject({ ShellProbe });
    expect(seen.safe?.ShellProbe).toBe(ShellProbe);
    expect(seen.safe).not.toHaveProperty('CorpusProbe');
  });

  it('answers null with no provider above it, so the safe path stays on SAFE_MDX', () => {
    const seen = render((s) => <Capture report={s} />);
    expect(seen.captured).toBeNull();
    expect(seen.safe).toBe(SAFE_MDX);
  });
});
