import { expect, test } from 'bun:test';
import { MultiSelectModal, SelectModal } from '../src';
import { act, click, key, mount, until, useDom } from './dom';

useDom();
const items = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];
const dialog = () => document.querySelector('[role=dialog]');
const row = (label: string) => [...document.querySelectorAll<HTMLElement>('[role=dialog] *')].filter((e) => e.textContent?.trim() === label).pop()!;
const trigger = (host: HTMLElement) => host.querySelector('button')!;

test('SelectModal: opens, Esc closes, picking fires onChange once and closes', async () => {
  const picked: string[] = [];
  const { host, unmount } = mount(<SelectModal routeKey="t-single" label="Safe" items={items} value="" onChange={(v) => picked.push(v)} />);
  expect(dialog()).toBeNull();
  click(trigger(host));
  expect(dialog()).not.toBeNull();
  key(document, 'Escape');
  await until(() => !dialog());
  expect(dialog()).toBeNull();
  click(trigger(host));
  click(row('Beta'));
  expect(picked).toEqual(['b']);
  await until(() => !dialog());
  expect(dialog()).toBeNull();
  unmount();
});

test('MultiSelectModal: rows toggle, Apply reports the set', async () => {
  const got: string[][] = [];
  const { host, unmount } = mount(<MultiSelectModal routeKey="t-multi" label="Network" items={items} value={['a']} onChange={(v) => got.push(v)} />);
  click(trigger(host));
  click(row('Beta')); // add
  click(row('Alpha')); // remove
  click(row('Gamma')); // add
  const apply = [...document.querySelectorAll<HTMLElement>('[role=dialog] button')].find((b) => b.textContent?.trim() === 'Apply')!;
  click(apply);
  expect(got).toEqual([['b', 'c']]);
  unmount();
});

test('closing after a pick pops exactly one history entry (select close + modal close in one tick)', () => {
  const back = history.back.bind(history);
  let n = 0;
  history.back = () => { n++; }; // the real back is async: while it is in flight the state still says "open"
  const { host, unmount } = mount(<SelectModal routeKey="t-once" label="Safe" items={items} value="" onChange={() => {}} />);
  click(trigger(host));
  click(row('Beta'));
  history.back = back;
  expect(n).toBe(1);
  unmount();
});

test('MultiSelectModal: Select All picks only the filtered, enabled rows', async () => {
  const got: string[][] = [];
  const list = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Gamma' }, { value: 'c', label: 'Ogamma' }, { value: 'd', label: 'Gamma off', disabled: true }, { value: 'e', label: 'Beta' }];
  const { host, unmount } = mount(<MultiSelectModal routeKey="t-all" label="Pools" items={list} value={['e']} onChange={(v) => got.push(v)} />);
  click(trigger(host));
  const input = document.querySelector<HTMLInputElement>('[role=dialog] input')!;
  act(() => { input.value = 'gam'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
  await until(() => !([...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent?.trim() === 'Alpha')), 1500);
  const btn = (l: string) => [...document.querySelectorAll<HTMLElement>('[role=dialog] button')].find((b) => b.textContent?.trim() === l)!;
  click(btn('Select All'));
  click(btn('Apply'));
  expect([...got[0]].sort()).toEqual(['b', 'c', 'e']); // e was already chosen outside the filter; a and d never
  unmount();
});

test('SelectModal/MultiSelectModal: triggerIcon, triggerLabel and a wrapped note on a disabled row', () => {
  const list = [{ value: 'a', label: 'Alpha', icon: <i data-testid="ic" />, note: 'no role on this chain', disabled: true }, { value: 'b', label: 'Beta' }];
  const one = mount(<SelectModal routeKey="t-ti" label="Safe" items={list} value="a" onChange={() => {}} triggerIcon />);
  expect(one.host.querySelector('[data-testid=ic]')).not.toBeNull();
  one.unmount();
  const many = mount(<MultiSelectModal routeKey="t-tl" label="Tokens" items={list} value={['b']} onChange={() => {}} triggerLabel="1 of 2 tokens selected" />);
  expect(trigger(many.host).textContent).toContain('1 of 2 tokens selected');
  click(trigger(many.host));
  expect(dialog()!.textContent).toContain('no role on this chain');
  many.unmount();
});
