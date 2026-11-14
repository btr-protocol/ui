import { expect, test } from 'bun:test';
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
