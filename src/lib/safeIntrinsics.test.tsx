import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseSafeMdast, renderMdast } from '@immediately-run/sdk/safeContent/index';
import { SAFE_INTRINSICS, filterIntrinsicProps } from './safeIntrinsics';

// The structural-tag allow-list, proven against the REAL published safe renderer plus real
// React DOM rendering — because the property at stake ("a content file cannot reach the DOM
// with an arbitrary attribute") is only observable in the rendered markup. (R3-263)

/** Parse MDX-syntax source and render it to static markup through the safe renderer. */
async function render(src: string, components: Record<string, unknown>): Promise<string> {
  const tree = await parseSafeMdast(src);
  return renderToStaticMarkup(renderMdast(tree, { components: components as never }) as never);
}

/** A block-level intrinsic must be opened on its OWN line to parse as JSX — see the
 *  micromark case below — so every fixture here uses that shape. */
const block = (open: string, inner = 'text') => [open, `  ${inner}`, `</${open.match(/^<(\w+)/)![1]}>`].join('\n');

describe('safe intrinsics — the allow-list is the barrier, not React', () => {
  it('renders an allow-listed tag with its allow-listed attributes', async () => {
    const html = await render(block('<main className="grove-content" id="x">'), SAFE_INTRINSICS);
    expect(html).toContain('<main class="grove-content" id="x">');
    expect(html).toContain('text');
  });

  it('drops `style`, which as a STRING crashes the render — and the render is the layout', async () => {
    // React: "The `style` prop expects a mapping from style properties to values, not a
    // string." A throw here takes down the whole shell, for every page, from one content
    // file — so this is an availability defect, not a cosmetic one.
    await expect(render(block('<main style="color:red">'), SAFE_INTRINSICS)).resolves.toContain('<main>');
    // Non-vacuous: the RAW tag really does throw, which is why the wrapper exists.
    await expect(render(block('<main style="color:red">'), { main: 'main' })).rejects.toThrow(/style/i);
  });

  it('drops `dangerouslySetInnerHTML`, which also crashes the render', async () => {
    await expect(render(block('<main dangerouslySetInnerHTML="<b>x</b>">'), SAFE_INTRINSICS)).resolves.toContain('<main>');
    await expect(render(block('<main dangerouslySetInnerHTML="<b>x</b>">'), { main: 'main' })).rejects.toThrow();
  });

  it('drops event handlers and URL-bearing attributes outright', async () => {
    const html = await render(block('<main onclick="alert(1)" href="javascript:alert(2)" srcdoc="<script>x</script>">'), SAFE_INTRINSICS);
    expect(html).toBe('<main><p>text</p></main>');
  });

  it('passes `data-*` and `aria-*` through, since they carry no behaviour', () => {
    expect(filterIntrinsicProps({ 'data-x': '1', 'aria-label': 'y', onclick: 'z', style: 'a' }))
      .toEqual({ 'data-x': '1', 'aria-label': 'y' });
  });

  it('does NOT register `a`/`img` — those stay the resolving, sanitizing Grove versions', () => {
    // Registering the raw tags here would silently bypass <WikiLink>'s resolution and
    // <AssetImage>'s mount-relative lookup, which is the whole reason they are overrides.
    expect(SAFE_INTRINSICS.a).toBeUndefined();
    expect(SAFE_INTRINSICS.img).toBeUndefined();
  });

  it('does NOT register `iframe` — React passes `srcdoc` straight through', async () => {
    expect(SAFE_INTRINSICS.iframe).toBeUndefined();
    // Recorded as the reason: with the raw tag registered, the markup really does carry it.
    const html = await render(block('<iframe srcdoc="<script>alert(1)</script>">'), { iframe: 'iframe' });
    expect(html).toContain('srcdoc');
  });

  it('does NOT register headings — a JSX heading would carry no `sec-…` id to cite', async () => {
    expect(SAFE_INTRINSICS.h2).toBeUndefined();
    // A markdown heading gets the id; that is the authoring route to keep.
    const tree = await parseSafeMdast('## 8.9 Something');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = (tree.children as any[]).find((n) => n.type === 'heading');
    expect(h?.data?.hProperties?.id).toBe('sec-8-9');
  });

  it('an UNREGISTERED tag collapses to a Fragment that keeps its children', async () => {
    // The failure mode is silent — the wrapper and its class vanish, the content stays —
    // which is why the tags a layout needs are registered rather than left to this.
    const html = await render(block('<figure className="x">'), {});
    expect(html).toBe('<p>text</p>');
  });
});

describe('the micromark gotcha that makes intrinsics look broken', () => {
  it('a lowercase tag opened on its own line parses as JSX', async () => {
    const tree = await parseSafeMdast(block('<main className="x">'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tree.children as any[])[0]).toMatchObject({ type: 'mdxJsxFlowElement', name: 'main' });
  });

  it('the SAME tag with inline content on one line is an HTML block — inert text', async () => {
    // Not a bug in the renderer: micromark's HTML-block rule wins. It matters because the
    // symptom is "my layout renders as visible angle brackets" with no error anywhere, and
    // the fix is a line break, which nobody guesses. Pinned so the two shapes stay distinct.
    const tree = await parseSafeMdast('<main className="x">text</main>');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tree.children as any[])[0]).toMatchObject({ type: 'html' });
    const html = await render('<main className="x">text</main>', SAFE_INTRINSICS);
    expect(html).not.toContain('<main');
  });
});
