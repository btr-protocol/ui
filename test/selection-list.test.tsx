import { expect, test } from 'bun:test';
import { SelectionList, SelectionModal } from '../src';
import { act, click, mount, useDom } from './dom';

useDom();
const items = [
  { id: 'a', label: 'Alpha', group: 'g1' },
  { id: 'b', label: 'Beta', group: 'g1' },
];
const key = (el: Element, k: string) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  act(() => { el.dispatchEvent(e); });
  return e;
};

test('mark mode: no nested interactive; Enter / Space on the mark toggles the mark only, the open button opens', () => {
  const log: string[] = [];
  const { host, unmount } = mount(<SelectionList mark items={items} selected={[]} onToggle={(id) => log.push(`toggle:${id}`)} onOpen={(id) => log.push(`open:${id}`)} />);
  expect(host.querySelectorAll('[role=button]')).toHaveLength(0);
  expect(host.querySelectorAll('button button')).toHaveLength(0);
  const mark = host.querySelector<HTMLElement>('button[aria-label="Add Alpha"]')!;
  for (const k of ['Enter', ' ']) expect(key(mark, k).defaultPrevented).toBe(false); // the browser then fires the button's own click
  expect(log).toEqual([]);
  click(mark);
  expect(log).toEqual(['toggle:a']);
  const open = host.querySelector<HTMLElement>('button[title=a]')!;
  expect(open.contains(mark)).toBe(false);
  expect(key(open, 'Enter').defaultPrevented).toBe(false);
  click(open);
  expect(log).toEqual(['toggle:a', 'open:a']);
  unmount();
});

test('disabled rows: the mark button is disabled and the keyboard select path does not toggle them', () => {
  const log: string[] = [];
  const list = [{ id: 'a', label: 'Alpha', disabled: true }, { id: 'b', label: 'Beta' }];
  const { host, unmount } = mount(<SelectionList mark items={list} selected={[]} onToggle={(id) => log.push(id)} onOpen={() => {}} />);
  const mark = host.querySelector<HTMLButtonElement>('button[aria-label="Add Alpha"]')!;
  expect(mark.disabled).toBe(true);
  click(mark);
  const input = host.querySelector<HTMLInputElement>('input')!;
  key(input, 'Enter'); // the highlighted first row is the disabled one
  expect(log).toEqual([]);
  click(host.querySelector<HTMLElement>('button[aria-label="Add Beta"]')!);
  expect(log).toEqual(['b']);
  unmount();
});

test('labels.noteSep and labels.reset reach the shared list (inline and modal)', () => {
  const groups = [{ id: 'g1', label: 'One' }, { id: 'g2', label: 'Two', note: 'off' }];
  const a = mount(<SelectionList items={items} groups={groups} selected={[]} onToggle={() => {}} labels={{ noteSep: ' // ' }} />);
  expect(a.host.textContent).toContain(' // off');
  a.unmount();
  const b = mount(
    <SelectionModal isOpen onClose={() => {}} title="T" items={[]} selectedIds={[]} onSelect={() => {}} hasActiveFilters onResetFilters={() => {}} labels={{ reset: 'Zurücksetzen' }} />,
  );
  expect(document.body.textContent).toContain('Zurücksetzen');
  b.unmount();
  const c = mount(<SelectionModal isOpen onClose={() => {}} title="T" items={items} groups={groups} selectedIds={[]} onSelect={() => {}} labels={{ noteSep: ' // ' }} />);
  expect(document.body.textContent).toContain(' // off');
  c.unmount();
});

test('a section heading toggles its enabled rows only', () => {
  const got: string[][] = [];
  const rows = [...items, { id: 'c', label: 'Gamma', group: 'g1', disabled: true }];
  const { host, unmount } = mount(<SelectionList items={rows} groups={[{ id: 'g1', label: 'One' }]} selected={[]} onToggle={() => {}} onToggleMany={(ids) => got.push([...ids])} />);
  click(host.querySelector<HTMLElement>('button[data-group=g1]')!);
  expect(got).toEqual([['a', 'b']]);
  unmount();
});
