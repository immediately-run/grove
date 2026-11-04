// @vitest-environment jsdom
// R3-1322 review round 2 (rg:2-r2-0) — the boot hook is the ONLY production caller of
// `setContentRoot`, so it is the only place the dispatch kind is set. `openWiki.test.ts`
// pins that the resolution carries `via`; `content.test.ts` pins that `isRepoLoadDispatch`
// reads it. This pins the wiring between them: drop `via` at the call and a repo-load
// dispatch silently stops handing cross-bundle links to the host.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const useMountsMock = vi.fn<() => unknown[]>();
const useTaskInputMock = vi.fn<() => unknown>();

vi.mock('@immediately-run/sdk/mounts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useMounts: () => useMountsMock(),
  getAppMountPath: () => '/app',
}));
vi.mock('@immediately-run/sdk/tasks', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTaskInput: () => useTaskInputMock(),
  cancelTask: vi.fn(),
}));

import { isDispatched, isRepoLoadDispatch, getContentRoot, resetContentRoot } from '../lib/contentRoot';
import { CONTENT_MOUNT_TYPE, OPEN_WIKI_TASK } from '../lib/openWiki';
import { useOpenWikiBoot } from './useOpenWikiBoot';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  useOpenWikiBoot();
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetContentRoot();
  useMountsMock.mockReset();
  useTaskInputMock.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetContentRoot();
});

describe('useOpenWikiBoot sets the dispatch kind with the root (R3-1322)', () => {
  it('a marked content mount and no task input is a repo-load dispatch', () => {
    useTaskInputMock.mockReturnValue(null);
    useMountsMock.mockReturnValue([{ type: CONTENT_MOUNT_TYPE, path: '/mnt/0a1b2c3d', id: 'c1', mode: 'ro' }]);
    act(() => root.render(<Probe />));
    expect(getContentRoot()).toBe('/mnt/0a1b2c3d/');
    expect(isDispatched()).toBe(true);
    expect(isRepoLoadDispatch()).toBe(true);
  });

  it('an open-wiki task input with its delegated dir is dispatched but NOT a repo load', () => {
    useTaskInputMock.mockReturnValue({ task: OPEN_WIKI_TASK, params: {} });
    useMountsMock.mockReturnValue([{ type: 'task-delegation', path: '/task/t1/dir', id: '/task/t1/dir', mode: 'rw' }]);
    act(() => root.render(<Probe />));
    expect(getContentRoot()).toBe('/task/t1/dir/');
    expect(isDispatched()).toBe(true);
    expect(isRepoLoadDispatch()).toBe(false);
  });
});
