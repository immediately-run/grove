// @vitest-environment jsdom
// useOverlayFocusDismiss (R3-608): the dialog contract AND the stack — one
// Escape closes only the TOP overlay; after it closes, the next.
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useOverlayFocusDismiss } from './useOverlayFocusDismiss';

function Overlay({ name, onClose }: { name: string; onClose: () => void }) {
  const ref = useOverlayFocusDismiss(true, onClose);
  return (
    <div data-testid={name} ref={ref} tabIndex={-1}>
      <button>{name} first</button>
      <button>{name} last</button>
    </div>
  );
}

/** One open overlay with a real trigger — the contract's basics. */
function Single({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={(e) => {
          setOpen(true);
          void e;
        }}
      >
        open
      </button>
      {open ? (
        <Overlay
          name="one"
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        />
      ) : null}
    </div>
  );
}

/** Two stacked overlays (a below, b above) — the stack discipline. */
function Stacked({ aClose, bClose }: { aClose: () => void; bClose: () => void }) {
  const [a, setA] = useState(true);
  const [b, setB] = useState(true);
  return (
    <div>
      {a ? (
        <Overlay
          name="a"
          onClose={() => {
            setA(false);
            aClose();
          }}
        />
      ) : null}
      {b ? (
        <Overlay
          name="b"
          onClose={() => {
            setB(false);
            bClose();
          }}
        />
      ) : null}
    </div>
  );
}

async function mount(ui: React.ReactNode): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
  return { root, container };
}

const esc = async (): Promise<void> => {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
};

describe('useOverlayFocusDismiss (R3-608)', () => {
  it('focus moves IN on open and RETURNS to the trigger on Escape-close', async () => {
    const close = vi.fn();
    const { container } = await mount(<Single onClose={close} />);
    const trigger = container.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    await act(async () => {
      trigger.click();
    });
    // Focus moved IN — to the overlay's first control.
    expect(document.activeElement?.textContent).toBe('one first');
    await esc();
    expect(close).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="one"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab is trapped at the overlay edges', async () => {
    const close = vi.fn();
    const { container } = await mount(<Single onClose={close} />);
    const trigger = container.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    await act(async () => {
      trigger.click();
    });
    const buttons = [...container.querySelectorAll('[data-testid="one"] button')] as HTMLButtonElement[];
    buttons[1].focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(buttons[0]); // wrapped forward→first
  });

  it('one Escape closes only the TOP overlay; the next closes the one below', async () => {
    const aClose = vi.fn();
    const bClose = vi.fn();
    const { container } = await mount(<Stacked aClose={aClose} bClose={bClose} />);
    expect(container.querySelector('[data-testid="a"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="b"]')).toBeTruthy();
    await esc();
    expect(bClose).toHaveBeenCalledTimes(1);
    expect(aClose).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="b"]')).toBeNull();
    expect(container.querySelector('[data-testid="a"]')).toBeTruthy();
    await esc();
    expect(aClose).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="a"]')).toBeNull();
  });
});
