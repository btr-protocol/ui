import { expect, test } from 'bun:test';
import { ImportFailure } from '../src';
import { ChainSelectModalHost } from '../src/ui/ChainSelect';
import { act, click, mount, until, useDom } from './dom';

useDom();
const chains = [{ id: 143, name: 'Monad' }];
const props = { isOpen: true, onClose: () => {}, chains, value: 143, onSelect: () => {} };
const dialog = () => document.querySelector('[role=dialog]');

test('a rejecting chunk is retried once, then an inline error with Retry shows (never blank)', async () => {
  let calls = 0;
  let ok = false;
  const load = () => {
    calls++;
    return ok ? import('../src/ui/ChainSelectModal') : Promise.reject(new Error('chunk 404'));
  };
  const { unmount } = mount(<ChainSelectModalHost {...props} load={load} />);
  await until(() => !!document.querySelector('[role=alert]'));
  expect(calls).toBe(2); // first try + one retry
  expect(dialog()?.textContent).toContain('Could not load the network list');
  ok = true;
  const retry = [...document.querySelectorAll<HTMLElement>('[role=dialog] button')].find((b) => b.textContent?.trim() === 'Retry')!;
  click(retry);
  await until(() => !!dialog()?.textContent?.includes('Monad')); // the loaded list (one chain: the kit shows no search field for a short list)
  expect(document.querySelector('[role=alert]')).toBeNull();
  act(() => unmount());
});

test('while pending it shows a loading state', () => {
  const never = () => new Promise<never>(() => {});
  const { unmount } = mount(<ChainSelectModalHost {...props} load={never} />);
  expect(dialog()?.textContent).toContain('Loading networks');
  unmount();
});

const btns = () => [...document.querySelectorAll<HTMLElement>('[role=dialog] button')].map((b) => b.textContent?.trim()).filter((t) => t === 'Reload' || t === 'Retry');
const setOnline = (on: boolean) => Object.defineProperty(navigator, 'onLine', { value: on, configurable: true });

test('a gone chunk: the shared notice with Reload, never a Retry that re-runs a cached failed import, no silent retry', async () => {
  let calls = 0;
  const load = () => { calls++; return Promise.reject(new ImportFailure('A new version is available. Reload the page.', 'Reload', 'stale')); };
  const { unmount } = mount(<ChainSelectModalHost {...props} load={load} />);
  await until(() => !!dialog()?.textContent?.includes('A new version is available'));
  expect(calls).toBe(1);
  expect(btns()).toEqual(['Reload']);
  expect(dialog()?.textContent).not.toContain('Could not load the network list');
  act(() => unmount());
});

test('a gone chunk while offline: the offline line, no button; Reload when the connection returns', async () => {
  setOnline(false);
  try {
    const { unmount } = mount(<ChainSelectModalHost {...props} load={() => Promise.reject(new ImportFailure('You are offline. Reconnect and try again.', 'Reload', 'offline'))} />);
    await until(() => !!dialog()?.textContent?.includes('You are offline'));
    expect(btns()).toEqual([]);
    setOnline(true);
    act(() => void window.dispatchEvent(new Event('online')));
    await until(() => btns().length === 1);
    expect(btns()).toEqual(['Reload']);
    act(() => unmount());
  } finally { setOnline(true); }
});
