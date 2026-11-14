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

test('mark mode: Enter / Space on the mark button toggles the mark and never opens the row; on the row it opens', () => {
  const log: string[] = [];
  const { host, unmount } = mount(<SelectionList mark items={items} selected={[]} onToggle={(id) => log.push(`toggle:${id}`)} onOpen={(id) => log.push(`open:${id}`)} />);
  const mark = host.querySelector<HTMLElement>('button[aria-label="Add Alpha"]')!;
  for (const k of ['Enter', ' ']) {
    const e = key(mark, k);
    expect(e.defaultPrevented).toBe(false); // the browser then fires the button's own click
  }
  expect(log).toEqual([]);
  click(mark);
  expect(log).toEqual(['toggle:a']);
  const row = host.querySelector<HTMLElement>('[role=button][title=a]')!;
  expect(key(row, 'Enter').defaultPrevented).toBe(true);
  expect(log).toEqual(['toggle:a', 'open:a']);
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
