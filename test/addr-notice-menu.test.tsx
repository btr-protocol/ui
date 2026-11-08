import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { AddressDisplay, ClickMenu, KeyValueTable, Notice, NoticeSlot, Table, pickNotice, shortAddr } from '../src';
import { click, key, mount, until, useDom } from './dom';

const ADDR = '0x4B1D26DD52Ec0e5285BFC9f2C1DE314074801521';

test('shortAddr: 0x4B1D…1521', () => {
  expect(shortAddr(ADDR)).toBe('0x4B1D…1521');
});

test('AddressDisplay renders name, short address, copy and explorer inline', () => {
  const html = render(<AddressDisplay value={ADDR} name="Treasury" explorerHref="https://e.example/address/x" />);
  expect(html).toContain('Treasury');
  expect(html).toContain('0x4B1D…1521');
  expect(html).not.toContain(`>${ADDR}<`);
  expect(html).toContain('inline-flex'); // one inline row
  expect((html.match(/<button/g) ?? []).length).toBe(2); // copy + explorer
  expect(html.indexOf('Treasury')).toBeLessThan(html.indexOf('0x4B1D…1521'));
});

test('pickNotice: highest severity wins, first of equals, falsy skipped', () => {
  const a = { tone: 'info' as const, label: 'a' };
  const b = { tone: 'error' as const, label: 'b' };
  const c = { tone: 'error' as const, label: 'c' };
  expect(pickNotice([a, b, c])).toBe(b);
  expect(pickNotice([false, null, undefined, a])).toBe(a);
  expect(pickNotice([{ label: 'plain' }, { tone: 'warning' as const, label: 'w' }])?.label).toBe('w');
  expect(pickNotice([null, false])).toBeUndefined();
});

test('NoticeSlot renders at most one notice', () => {
  const html = render(<NoticeSlot notices={[{ tone: 'info', label: 'FYI' }, { tone: 'error', label: 'Down' }, false]} />);
  expect(html).toContain('Down');
  expect(html).not.toContain('FYI');
  expect(render(<NoticeSlot notices={[false]} />)).toBe('');
  expect(render(<Notice label="x" />)).toContain('x'); // Notice itself unchanged
});

test('Table always wears the frame; noHeader only hides the header', () => {
  const props = { columns: [{ key: 'a', label: 'A' }], data: [{ a: 1 }], rowKey: (r: { a: number }) => String(r.a), searchable: false };
  const framed = render(<Table {...props} />);
  const hidden = render(<Table {...props} noHeader />);
  for (const html of [framed, hidden]) expect(html).toMatch(/surface[^"]*border[^"]*rounded-lg|rounded-lg[^"]*border/);
  expect(hidden).toContain('sr-only');
  expect(framed).not.toContain('sr-only');
});

test('KeyValueTable is a .surface whose rounded-lg is the nesting token (preset: rounded-lg = var(--radius-lg) = var(--r))', async () => {
  const html = render(<KeyValueTable sections={[{ id: 's', rows: [{ key: 'k', label: 'L', value: 'V' }] }]} />);
  expect(html).toContain('surface');
  expect(html).toContain('rounded-lg');
  expect(await Bun.file('src/styles/tailwind.preset.js').text()).toContain("lg: 'var(--radius-lg)'");
});

useDom();
test('ClickMenu: focus first item on open, arrows rove, Home/End, Esc returns focus to the trigger', async () => {
  const picked: string[] = [];
  const { host, unmount } = mount(
    <ClickMenu trigger={<button type="button" id="trg">Menu</button>} items={[{ id: 'a', label: 'A', onSelect: () => picked.push('a') }, { id: 'b', label: 'B', disabled: true }, { id: 'c', label: 'C' }]} />,
  );
  const trg = host.querySelector<HTMLElement>('#trg')!;
  trg.focus();
  click(trg);
  await until(() => !!document.querySelector('[role=menu]'));
  const items = () => [...document.querySelectorAll<HTMLElement>('[role=menuitem]')];
  expect(document.activeElement).toBe(items()[0]!);
  const menu = document.querySelector('[role=menu]')!;
  key(menu, 'ArrowDown');
  expect(document.activeElement).toBe(items()[2]!); // disabled B skipped
  key(menu, 'ArrowDown');
  expect(document.activeElement).toBe(items()[0]!); // wraps
  key(menu, 'End');
  expect(document.activeElement).toBe(items()[2]!);
  key(menu, 'Home');
  expect(document.activeElement).toBe(items()[0]!);
  key(menu, 'ArrowUp');
  expect(document.activeElement).toBe(items()[2]!);
  key(document, 'Escape');
  await until(() => !document.querySelector('[role=menu]'));
  expect(document.querySelector('[role=menu]')).toBeNull();
  expect(document.activeElement).toBe(trg);
  unmount();
});
