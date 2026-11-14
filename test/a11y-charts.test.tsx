import { expect, test } from 'bun:test';
import { CommandPalette, Heatmap, TabStrip } from '../src';
import { act, key, mount, useDom } from './dom';

useDom();
const press = (el: Element, k: string, init: KeyboardEventInit = {}) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });

test('Heatmap: one tab stop, arrows move it', () => {
  const { host, unmount } = mount(<Heatmap label="m" rows={['a', 'b']} cols={['x', 'y', 'z']} values={[[1, 2, 3], [4, 5, 6]]} />);
  const cells = () => [...host.querySelectorAll<HTMLElement>('[role=gridcell]')];
  expect(cells().filter((c) => c.tabIndex === 0)).toHaveLength(1);
  expect(cells()[0]!.tabIndex).toBe(0);
  press(cells()[0]!, 'ArrowRight');
  press(cells()[1]!, 'ArrowDown');
  expect(cells().filter((c) => c.tabIndex === 0)).toHaveLength(1);
  expect(cells()[4]!.tabIndex).toBe(0);
  expect(document.activeElement).toBe(cells()[4]!);
  press(cells()[4]!, 'End');
  expect(cells()[5]!.tabIndex).toBe(0);
  unmount();
});

test('TabStrip: roving tabindex, arrows move focus, pin/close are not inside role=tab', () => {
  const sel: string[] = [];
  const tabs = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
  const { host, unmount } = mount(<TabStrip tabs={tabs} active="b" onSelect={(id) => sel.push(id)} onClose={() => {}} onPin={() => {}} />);
  const tabEls = () => [...host.querySelectorAll<HTMLElement>('[role=tab]')];
  expect(tabEls().map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  expect(host.querySelectorAll('[role=tab] button')).toHaveLength(0);
  expect(host.querySelectorAll('button[aria-label=Close]')).toHaveLength(3);
  press(tabEls()[1]!, 'ArrowRight');
  expect(document.activeElement).toBe(tabEls()[2]!);
  press(tabEls()[2]!, 'ArrowRight');
  expect(document.activeElement).toBe(tabEls()[0]!);
  tabEls()[0]!.click();
  expect(sel).toEqual(['a']);
  unmount();
});

test('TabStrip: Delete closes a focused closable tab, P toggles its pin, pinned tabs do not close', () => {
  const log: string[] = [];
  const tabs = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', pinned: true }, { id: 'c', label: 'C', closable: false }];
  const { host, unmount } = mount(<TabStrip tabs={tabs} active="a" onSelect={() => {}} onClose={(id) => log.push(`close:${id}`)} onPin={(id) => log.push(`pin:${id}`)} />);
  const el = (n: number) => [...host.querySelectorAll<HTMLElement>('[role=tab]')][n]!;
  press(el(0), 'p'); // pinned tabs sort first: b, a, c
  expect(log).toEqual(['pin:b']);
  press(el(1), 'Delete');
  press(el(0), 'Delete');
  press(el(2), 'Backspace');
  expect(log).toEqual(['pin:b', 'close:a']);
  unmount();
});

test('CommandPalette: one Ctrl+K listener across palettes, combobox links the active option, composition ignored', () => {
  const items = [{ id: '1', title: 'Alpha', group: 'g', run: () => {} }, { id: '2', title: 'Beta', group: 'g', run: () => {} }];
  const a = mount(<CommandPalette items={items} />);
  const b = mount(<CommandPalette items={items} />);
  press(document.body, 'k', { ctrlKey: true, isComposing: true });
  expect(document.querySelectorAll('[role=dialog]')).toHaveLength(0);
  press(document.body, 'k', { ctrlKey: true });
  expect(document.querySelectorAll('[role=dialog]')).toHaveLength(1);
  const input = document.querySelector<HTMLInputElement>('[role=dialog] input')!;
  expect(input.getAttribute('role')).toBe('combobox');
  const opt = document.getElementById(input.getAttribute('aria-activedescendant')!);
  expect(opt?.getAttribute('role')).toBe('option');
  expect(document.getElementById(input.getAttribute('aria-controls')!)?.getAttribute('role')).toBe('listbox');
  key(input, 'ArrowDown');
  expect(document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent).toContain('Beta');
  a.unmount();
  b.unmount();
});
