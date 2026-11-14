import { expect, test } from 'bun:test';
import { ChainSelect, Expandable, InitialsGlyph, MultiSelectModal, SelectModal, WalletItemButton } from '../src';
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

test('WalletItemButton: connecting loader sits in a fixed centred slot that is there before it spins', () => {
  const text = mount(<WalletItemButton name="Disconnect" onClick={() => {}} />);
  expect(text.host.querySelector('span.h-5.w-5')).toBeNull(); // a text-only row cannot show a loader: no reserved slot
  text.unmount();
  const idle = mount(<WalletItemButton name="Rabby" icon={<i />} onClick={() => {}} />);
  const slot = idle.host.querySelector('span.h-5.w-5');
  expect(slot).not.toBeNull();
  expect(slot!.children.length).toBe(0);
  idle.unmount();
  const busy = mount(<WalletItemButton name="Rabby" icon={<i />} isConnecting onClick={() => {}} />);
  expect(busy.host.querySelector('span.h-5.w-5 .animate-spin')).not.toBeNull();
  busy.unmount();
});

test('Expandable bordered: own border + nesting radius, flat stays a divider row', () => {
  const a = mount(<Expandable bordered header="H">B</Expandable>);
  expect(a.host.firstElementChild!.className).toContain('surface');
  expect(a.host.firstElementChild!.className).toContain('border-border');
  a.unmount();
  const b = mount(<Expandable header="H">B</Expandable>);
  expect(b.host.firstElementChild!.className).not.toContain('surface');
  b.unmount();
});

test('ChainSelect: all-chains scope is a pinned row (not a list row); chain rows are rounded squares', async () => {
  const picked: string[] = [];
  const { host, unmount } = mount(<ChainSelect routeKey="t-chain" chains={[{ id: 143, name: 'Monad' }, { id: 1, name: 'Ethereum' }]} value={null} allLabel="All networks" onAll={() => picked.push('all')} onChange={(c) => picked.push(String(c))} />);
  expect(host.querySelector('button')!.textContent).toContain('All networks');
  click(host.querySelector('button')!);
  await until(() => !!dialog()); // the modal chunk loads on first open
  expect(document.querySelector('[role=dialog]')!.innerHTML).toContain('rounded-xs');
  const rows = [...document.querySelectorAll<HTMLElement>('[role=dialog] [role=option], [role=dialog] button')];
  expect(rows.some((r) => r.textContent?.includes('All networks') && r.querySelector('svg'))).toBe(true); // icon slot like the other rows
  click(row('All networks'));
  expect(picked).toEqual(['all']);
  unmount();
});

test('InitialsGlyph: graphemes, no 0x, tint', () => {
  const a = mount(<InitialsGlyph label="0xAb12 cd" />);
  expect(a.host.textContent).toBe('AC');
  a.unmount();
  const b = mount(<InitialsGlyph label="Émile Zola" color="#ff0000" />);
  expect(b.host.textContent).toBe('ÉZ');
  expect(b.host.innerHTML).toContain('color: #ff0000');
  b.unmount();
});

test('MultiSelectModal groups + presets: sections in order, empty section shows its note, heading and preset toggle their rows', async () => {
  const got: string[][] = [];
  const legs = [
    { value: 'm:a', label: 'USDC', caption: 'Core', group: '143' },
    { value: 'm:b', label: 'WMON', caption: 'Core', group: '143' },
    { value: 'b:a', label: 'USDT', caption: 'Main', group: '56' },
    { value: 'b:x', label: 'Halted', caption: 'Main', group: '56', disabled: true },
  ];
  const groups = [{ id: '56', label: 'BNB Chain' }, { id: '1', label: 'Ethereum', note: 'DEX not deployed' }, { id: '143', label: 'Monad' }];
  const presets = [{ id: 'all', label: 'Whole DEX', ids: legs.map((l) => l.value) }, { id: 'usdc', label: 'USDC', ids: ['m:a'] }];
  const { host, unmount } = mount(<MultiSelectModal routeKey="t-groups" label="Scope" items={legs} value={[]} groups={groups} presets={presets} onChange={(v) => got.push(v)} />);
  click(trigger(host));
  const heads = [...document.querySelectorAll<HTMLElement>('[role=dialog] [data-group]')];
  expect(heads.map((h) => h.dataset.group)).toEqual(['56', '1', '143']);
  expect(heads[1]!.textContent).toContain('DEX not deployed');
  expect(heads[1]!.tagName).toBe('DIV'); // nothing to pick there
  const btn = (label: string) => [...document.querySelectorAll<HTMLElement>('[role=dialog] button')].find((b) => b.textContent?.trim() === label)!;
  click(btn('Whole DEX')); // every enabled leg, the halted one stays out
  click(heads[2]!); // Monad heading: all on -> off
  click(btn('USDC')); // back on
  click(btn('Apply'));
  expect(got).toEqual([['b:a', 'm:a']]);
  unmount();
});

test('presets never select phantom or disabled ids; a noted section takes no picks; min is kept', async () => {
  const got: string[][] = [];
  const list = [{ value: 'a', label: 'A1', group: 'x' }, { value: 'b', label: 'B1', group: 'y' }];
  const { host, unmount } = mount(<MultiSelectModal routeKey="t-phantom" label="S" items={list} value={[]} groups={[{ id: 'x', label: 'X' }, { id: 'y', label: 'Y', note: 'off' }]} presets={[{ id: 'p', label: 'Ghost', ids: ['zz'] }, { id: 'q', label: 'Mix', ids: ['a', 'zz'] }]} onChange={(v) => got.push(v)} />);
  click(trigger(host));
  const btn = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('[role=dialog] button')].find((b) => b.textContent?.trim() === label)!;
  expect(btn('Ghost').disabled).toBe(true);
  click(btn('Mix'));
  expect(document.querySelector('[role=dialog] [data-group="y"]')!.tagName).toBe('DIV');
  click(btn('Apply'));
  expect(got).toEqual([['a']]);
  unmount();
});

test('a pick lands AFTER the modal entry is popped: a URL write in onChange survives the close (grouping never reverts)', async () => {
  const back = history.back.bind(history);
  history.replaceState({}, '', '/'); // clean slate: earlier tests leave their modal params behind
  const before = location.href;
  history.back = () => { setTimeout(() => { history.replaceState({}, '', before); dispatchEvent(new PopStateEvent('popstate')); }, 5); }; // async, like a browser
  const seen: string[] = [];
  const { host, unmount } = mount(<SelectModal routeKey="t-url" label="Group" items={items} value="a" onChange={(v) => { const u = new URL(location.href); u.searchParams.set('by', v); history.replaceState({}, '', u); seen.push(location.search); }} />);
  click(trigger(host));
  expect(location.search).toContain('modal=t-url');
  click(row('Beta'));
  expect(seen).toEqual([]); // not yet: the back is in flight
  await until(() => seen.length > 0);
  expect(seen).toEqual(['?by=b']); // written on the entry the modal returned to, not on the modal's own
  expect(location.search).toBe('?by=b');
  history.back = back;
  history.replaceState({}, '', before);
  unmount();
});

test('another routed modal listening to popstate never swallows the pick (its listener runs first)', async () => {
  const back = history.back.bind(history);
  history.replaceState({}, '', '/');
  const before = location.href;
  history.back = () => { setTimeout(() => { history.replaceState({}, '', before); dispatchEvent(new PopStateEvent('popstate')); }, 5); };
  const seen: string[] = [];
  const other = mount(<SelectModal routeKey="t-other" label="Other" items={items} value="a" onChange={() => {}} />); // mounted FIRST: its popstate listener runs first
  const { host, unmount } = mount(<SelectModal routeKey="t-url2" label="Group" items={items} value="a" onChange={(v) => seen.push(v)} />);
  click(trigger(host));
  click(row('Gamma'));
  await until(() => seen.length > 0);
  expect(seen).toEqual(['c']);
  history.back = back;
  history.replaceState({}, '', before);
  unmount(); other.unmount();
});

test('the close fallback never flushes onto the modal entry: a back that has not popped yet keeps the pick pending', async () => {
  const back = history.back.bind(history);
  history.replaceState({}, '', '/');
  const before = location.href;
  let pop: (() => void) | null = null;
  history.back = () => { pop = () => { history.replaceState({}, '', before); dispatchEvent(new PopStateEvent('popstate')); }; }; // a slow back: pops only when we say
  const seen: string[] = [];
  const { host, unmount } = mount(<SelectModal routeKey="t-slow" label="Group" items={items} value="a" onChange={(v) => seen.push(`${v}@${location.search}`)} />);
  click(trigger(host));
  click(row('Beta'));
  await new Promise((r) => setTimeout(r, 450)); // past the fallback
  expect(seen).toEqual([]); // still on the modal's entry: nothing written there
  pop!();
  await until(() => seen.length > 0);
  expect(seen).toEqual(['b@']); // delivered on the entry the modal returned to
  history.back = back;
  history.replaceState({}, '', before);
  unmount();
});
