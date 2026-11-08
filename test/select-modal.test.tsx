import { expect, test } from 'bun:test';
import { MultiSelectModal, SelectModal } from '../src';
import { click, key, mount, until, useDom } from './dom';

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
