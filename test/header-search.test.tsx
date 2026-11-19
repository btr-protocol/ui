import { expect, test } from 'bun:test';
import { useState } from 'preact/hooks';
import { SearchInput, Table } from '../src';
import { act, click, mount, useDom } from './dom';

useDom();

const type = (el: HTMLInputElement, v: string) =>
  act(() => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

function Harness({ onKey }: { onKey?: (k: string) => void }) {
  const [v, setV] = useState('');
  return <SearchInput variant="header" value={v} onChange={setV} placeholder="Filter legs" onKeyDown={(e) => onKey?.(e.key)} />;
}

test('header search: search landmark, labelled input, typing, keyboard, clear refocuses', () => {
  const keys: string[] = [];
  const { host, unmount } = mount(<Harness onKey={(k) => keys.push(k)} />);
  expect(host.querySelector('[role=search]')).not.toBeNull();
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Filter legs"]')!;
  expect(input).not.toBeNull();
  expect(host.querySelector('button[aria-label="Clear search"]')).toBeNull();
  type(input, 'eth');
  expect(input.value).toBe('eth');
  act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  expect(keys).toEqual(['Escape']);
  click(host.querySelector('button[aria-label="Clear search"]')!);
  expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('');
  expect(document.activeElement).toBe(host.querySelector('input'));
  unmount();
});

const cols = [{ key: 'name', label: 'Name' }];
const rows = [{ name: 'Alpha' }, { name: 'Beta' }];

test('Table: search sits in the header row (titled and untitled), filters rows', () => {
  for (const title of ['Legs', undefined]) {
    const { host, unmount } = mount(<Table title={title} columns={cols} data={rows} rowKey={(r) => r.name} searchPlaceholder="Filter" />);
    const search = host.querySelector('[role=search]')!;
    expect(search).not.toBeNull();
    // one framed object: the search is inside the table's own panel, ahead of the table
    expect(search.closest('.overflow-hidden')?.querySelector('table')).not.toBeNull();
    // inside the PanelHeader row (the first child of the frame), not a boxed field above the frame
    const frame = host.querySelector('table')!.closest('.overflow-hidden')!;
    expect(frame.firstElementChild!.contains(search)).toBe(true);
    expect(frame.parentElement!.firstElementChild).toBe(frame);
    expect(host.querySelector('input.pl-9')).toBeNull();
    type(host.querySelector<HTMLInputElement>('input[aria-label="' + (title ? 'Search ' + title : 'Filter') + '"]')!, 'bet');
    expect(host.querySelector('tbody')!.textContent).toContain('Beta');
    expect(host.querySelector('tbody')!.textContent).not.toContain('Alpha');
    unmount();
  }
});

test('Table search: per-table label, Escape clears a non-empty query, resetKey change resets it', () => {
  let setK: (k: string) => void = () => {};
  function H() {
    const [k, s] = useState('a');
    setK = s;
    return <Table title="Legs" resetKey={k} columns={cols} data={rows} rowKey={(r) => r.name} />;
  }
  const { host, unmount } = mount(<H />);
  const input = () => host.querySelector<HTMLInputElement>('input[aria-label="Search Legs"]')!;
  expect(input()).not.toBeNull();
  type(input(), 'bet');
  const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  act(() => { input().dispatchEvent(esc); });
  expect(esc.defaultPrevented).toBe(true);
  expect(input().value).toBe('');
  const esc2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  act(() => { input().dispatchEvent(esc2); });
  expect(esc2.defaultPrevented).toBe(false); // empty: Escape passes on (closes an enclosing modal)
  type(input(), 'bet');
  act(() => setK('b'));
  expect(input().value).toBe('');
  expect(host.querySelector('tbody')!.textContent).toContain('Alpha');
  unmount();
});
