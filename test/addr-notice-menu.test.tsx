import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { AddressDisplay, ClickMenu, KeyValueTable, Notice, NoticeSlot, Table, groupNotices, pickNotice, shortAddr } from '../src';
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

test('NoticeSlot: one notice per tone, most severe first; a lone notice passes through', () => {
  const html = render(<NoticeSlot notices={[{ tone: 'info', label: 'FYI' }, { tone: 'error', label: 'Down' }, false]} />);
  expect(html).toContain('Down');
  expect(html).toContain('FYI');
  expect(html.indexOf('Down')).toBeLessThan(html.indexOf('FYI'));
  expect(html).not.toContain('notice-rows');
  expect(render(<NoticeSlot notices={[false]} />)).toBe('');
  expect(render(<NoticeSlot notices={[{ tone: 'warning', label: 'only' }]} />)).toBe(render(<Notice tone="warning" label="only" />));
  expect(render(<Notice label="x" />)).toContain('x'); // Notice itself unchanged
});

test('groupNotices: same tone merges into ONE notice of rows (own text, own action), tones stay apart', () => {
  const ack = { label: 'Acknowledge', onClick: () => {} };
  const gs = groupNotices([
    { tone: 'warning', children: 'Partial balances', role: 'status' },
    { tone: 'error', children: 'Sim failed' },
    { tone: 'warning', children: 'Out of date', action: ack },
    null,
    { tone: 'warning', rows: [{ id: 'r', children: 'nested' }] },
  ]);
  expect(gs.map((g) => g.tone)).toEqual(['error', 'warning']);
  expect(gs[0].children).toBe('Sim failed'); // lone: untouched
  expect(gs[1].rows?.map((r) => r.children)).toEqual(['Partial balances', 'Out of date', 'nested']);
  expect(gs[1].rows?.[1].action).toBe(ack);
  expect(gs[1].role).toBe('status');
  expect(groupNotices([{ tone: 'error', children: 'a', role: 'status' }, { tone: 'error', children: 'b' }])[0].role).toBe('alert'); // an implicit alert keeps the group an alert
  const html = render(<NoticeSlot notices={gs} />);
  expect((html.match(/role="alert"/g) ?? []).length).toBe(1);
  expect((html.match(/notice-rows/g) ?? []).length).toBe(1);
  expect((html.match(/<li[ >]/g) ?? []).length).toBe(3);
  expect((html.match(/notice-action/g) ?? []).length).toBe(1);
  expect((html.match(/<svg/g) ?? []).length).toBe(2); // one icon per tone, not per row
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

test('Notice action: a toggle exposes aria-pressed', () => {
  const { host, unmount } = mount(<Notice tone="error" action={{ label: 'Acknowledge', onClick: () => {}, pressed: true }}>x</Notice>);
  expect(host.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  unmount();
});
