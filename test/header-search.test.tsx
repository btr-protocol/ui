import { expect, test } from 'bun:test';
import { useState } from 'preact/hooks';
import { POPUP_FEATURES, SearchInput, Table } from '../src';
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

test('Table expand: a safe anchor right of the search; absent without expand or for an unsafe href', () => {
  const link = (host: HTMLElement) =>
    host.querySelector<HTMLAnchorElement>('a[aria-label="Open table in a new window"]');
  const { host, unmount } = mount(
    <Table title="Legs" columns={cols} data={rows} rowKey={(r) => r.name} expand={{ href: 'https://e.example/activity' }} />,
  );
  const search = host.querySelector('[role=search]')!;
  const a = link(host)!;
  expect(a).not.toBeNull();
  expect(a.getAttribute('href')).toBe('https://e.example/activity');
  expect(a.getAttribute('target')).toBe('_blank');
  expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  expect(a.closest('[role=search]')).toBeNull(); // never inside the search cell
  expect(search.nextElementSibling?.contains(a)).toBe(true); // immediately right of it
  unmount();

  const plain = mount(<Table title="Legs" columns={cols} data={rows} rowKey={(r) => r.name} />);
  expect(link(plain.host)).toBeNull();
  plain.unmount();

  const unsafe = mount(
    <Table title="Legs" columns={cols} data={rows} rowKey={(r) => r.name} expand={{ href: 'javascript:alert(1)' }} />,
  );
  expect(link(unsafe.host)).toBeNull(); // safeHref -> undefined renders nothing
  unsafe.unmount();
});

test('Table search inside a BaseModal: Escape with a query clears it and keeps the modal; the next Escape closes', async () => {
  const { BaseModal } = await import('../src');
  let closed = 0;
  const { unmount } = mount(
    <BaseModal isOpen onClose={() => { closed++; }} title="T" headerType="title">
      <Table title="Legs" columns={cols} data={rows} rowKey={(r) => r.name} />
    </BaseModal>,
  );
  await new Promise((r) => setTimeout(r, 20));
  const input = () => document.querySelector<HTMLInputElement>('input[aria-label="Search Legs"]')!;
  type(input(), 'bet');
  input().focus();
  act(() => { input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
  expect(input().value).toBe('');
  expect(closed).toBe(0);
  act(() => { input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
  expect(closed).toBe(1);
  unmount();
});

test('Table expand opens the headless popup; a modifier click follows the anchor', () => {
  const calls: { url: string; name: string; features?: string }[] = [];
  const orig = globalThis.open;
  const fake = {
    focus() {},
    location: { href: '' },
  } as unknown as Window;
  globalThis.open = ((url: string, name: string, features?: string) => {
    calls.push({ url, name, features });
    return fake;
  }) as typeof globalThis.open;
  const { host, unmount } = mount(
    <Table
      title="Legs"
      columns={cols}
      data={rows}
      rowKey={(r) => r.name}
      expand={{ href: '/table/flow-activity?pool=core', name: 'btr-table-flow' }}
    />,
  );
  const a = host.querySelector<HTMLAnchorElement>('a[aria-label="Open table in a new window"]')!;
  const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  act(() => { a.dispatchEvent(plain); });
  expect(plain.defaultPrevented).toBe(true);
  expect(calls).toEqual([
    { url: '/table/flow-activity?pool=core', name: 'btr-table-flow', features: POPUP_FEATURES },
  ]);
  const modified = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
  act(() => { a.dispatchEvent(modified); });
  expect(modified.defaultPrevented).toBe(false);
  expect(calls).toHaveLength(1);
  globalThis.open = orig;
  unmount();
});
