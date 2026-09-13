// @vitest-environment jsdom
// The ⌘K palette (R3-608): Escape returns focus to the REAL trigger, and
// `aria-activedescendant` tracks the highlight through the REAL fuzzy filter
// over a real entry list — only the attributes are new, so the assertions ride
// the same matcher the production query uses.
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TinkerableContext } from '@immediately-run/sdk/TinkerableContext';

const { default: Search } = await import('./Search');

const FILES = {
  '/app/content/home.mdx': { title: 'Home.', desc: '', tags: [] },
  '/app/content/wiki/security.mdx': { title: 'Security.', desc: 'threats', tags: ['ops'] },
  '/app/content/wiki/guide/api.mdx': { title: 'API guide.', desc: 'endpoints', tags: ['dev'] },
  '/app/content/wiki/guide/deploy.mdx': { title: 'Deploying.', desc: 'shipping', tags: ['dev', 'ops'] },
};

const NAV = {
  outerHref: 'https://example.immediately.run/app/x',
  navigationState: { sandboxPath: '/app/x', provider: 'github', namespace: 'immediately-run', repository: 'docs', ref: 'main', hash: '', search: '' },
  routingSpec: {} as never,
  filesMetadata: FILES,
};

/** Search mounted open; closing UNMOUNTS it (the parent's job — focus return
 *  rides the unmount cleanup). */
function SearchHost({ onClose }: { onClose: () => void }) {
  const [show, setShow] = useState(true);
  return (
    <div>
      <button onClick={onClose}>trigger</button>
      {show ? (
        <Search
          onClose={() => {
            setShow(false);
            onClose();
          }}
        />
      ) : null}
    </div>
  );
}

async function mountSearch(onClose: () => void, preFocus?: HTMLElement): Promise<{ root: Root; container: HTMLElement }> {
  // The trigger must hold focus BEFORE the palette mounts — the hook captures
  // it at open as the focus-return target.
  preFocus?.focus();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <TinkerableContext.Provider value={NAV as never}>
        <SearchHost onClose={onClose} />
      </TinkerableContext.Provider>,
    );
  });
  return { root, container };
}

describe('the ⌘K palette (R3-608)', () => {
  it('Escape closes and focus RETURNS to the real trigger', async () => {
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    const { container } = await mountSearch(onClose, trigger);
    // The palette moved focus INTO its input on open (the hook's focus-in).
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('aria-activedescendant tracks the highlight through the real fuzzy filter', async () => {
    const onClose = vi.fn();
    const { container } = await mountSearch(onClose);
    const input = container.querySelector('input[role="combobox"]') as HTMLInputElement;
    // Combobox semantics present.
    expect(input.getAttribute('aria-controls')).toBeTruthy();
    const list = container.querySelector(`#${input.getAttribute('aria-controls')}`) as HTMLElement;
    expect(list.getAttribute('role')).toBe('listbox');
    // Unfiltered: the recent list's first entry is highlighted.
    const first = input.getAttribute('aria-activedescendant');
    expect(first).toBeTruthy();
    expect(document.getElementById(first!)).toBeTruthy();
    // ArrowDown moves the highlight; the attribute names the NEW option.
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    const second = input.getAttribute('aria-activedescendant');
    expect(second).not.toBe(first);
    expect(document.getElementById(second!)?.getAttribute('aria-selected')).toBe('true');
    // The real filter: typing narrows the list and resets the highlight to the
    // top — and the referenced option is one the matcher kept.
    await act(async () => {
      // The native value setter: React's tracker ignores a bare .value assign.
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'api');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const after = input.getAttribute('aria-activedescendant');
    expect(after).toBeTruthy();
    expect(document.getElementById(after!)?.textContent).toContain('API guide');
  });
});
