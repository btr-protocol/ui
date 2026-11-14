import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { Button, ClickMenu, Icon, MultiSelectModal, SelectedCheck, SelectModal } from '../src';
import { click, mount, until, useDom } from './dom';

useDom();

test('Button: label is nowrap and truncates; icon-only and primary carry the group hooks', () => {
  const text = render(<Button size="sm" leftIcon={<Icon name="copy" />}>A long label</Button>);
  expect(text).toContain('whitespace-nowrap');
  expect(text).toContain('min-w-0 truncate');
  expect(render(<Button>{3} items</Button>)).toContain('data-label');
  expect(render(<Button>Pick <b>all</b></Button>)).toContain('data-label');
  expect(render(<Button><b>all</b></Button>)).not.toContain('data-label');
  expect(text).not.toContain('data-icon-only');
  const icon = render(<Button aria-label="Copy" leftIcon={<Icon name="copy" />} />);
  expect(icon).toContain('data-icon-only');
  expect(render(<Button variant="primary">Go</Button>)).toContain('data-primary');
  expect(render(<Button>Go</Button>)).not.toContain('data-primary');
});

test('ClickMenu: a selected item is a menuitemradio with the check, button and link alike; plain items stay menuitem', () => {
  const { host, unmount } = mount(<ClickMenu trigger={<button type="button" id="trg">Menu</button>} items={[{ id: 'a', label: 'A', selected: true }, { id: 'b', label: 'B', href: '/b', selected: true }, { id: 'c', label: 'C', href: '/c', selected: false }, { id: 'd', label: 'D' }]} />);
  click(host.querySelector('#trg')!);
  const rows = [...document.querySelectorAll('[role^=menuitem]')];
  expect(rows.map((r) => [r.tagName, r.getAttribute('role'), r.getAttribute('aria-checked')])).toEqual([['BUTTON', 'menuitemradio', 'true'], ['A', 'menuitemradio', 'true'], ['A', 'menuitemradio', 'false'], ['BUTTON', 'menuitem', null]]);
  expect(rows.map((r) => r.querySelectorAll('[data-selected-check]').length)).toEqual([1, 1, 0, 0]);
  unmount();
});

const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Opt ${i}` }));
const searchBox = () => document.querySelector('[role=dialog] input');

test('SelectModal: search hidden at 6 options or fewer, shown above, forced by searchable', () => {
  for (const [n, forced, shown] of [[6, undefined, false], [7, undefined, true], [3, true, true], [9, false, false]] as const) {
    const { host, unmount } = mount(<SelectModal routeKey={`s-${n}-${forced}`} label="X" items={opts(n)} value="v0" onChange={() => {}} searchable={forced} />);
    click(host.querySelector('button')!);
    expect(!!searchBox()).toBe(shown);
    unmount();
  }
});

test('SelectModal: the picked row shows the trailing check; triggerPrefix leads the label in the one button', () => {
  const { host, unmount } = mount(<SelectModal routeKey="s-pre" label="X" items={opts(3)} value="v1" onChange={() => {}} triggerPrefix={<span>Simulated ·</span>} />);
  const trg = host.querySelector('button')!;
  expect(host.querySelectorAll('button').length).toBe(1);
  expect(trg.textContent).toContain('Simulated ·');
  expect(trg.textContent!.indexOf('Simulated')).toBeLessThan(trg.textContent!.indexOf('Opt 1'));
  click(trg);
  const marks = document.querySelectorAll('[role=dialog] [data-selected-check]');
  expect(marks.length).toBe(1);
  expect(marks[0]!.closest('button')!.textContent).toContain('Opt 1');
  unmount();
});

test('modal rows expose the selection: aria-current when single, aria-pressed per row when multi', () => {
  const a = mount(<SelectModal routeKey="a-one" label="X" items={opts(3)} value="v1" onChange={() => {}} />);
  click(a.host.querySelector('button')!);
  expect([...document.querySelectorAll('[role=dialog] [data-sel-row]')].map((r) => r.getAttribute('aria-current'))).toEqual([null, 'true', null]);
  a.unmount();
  const b = mount(<MultiSelectModal routeKey="a-multi" label="X" items={opts(3)} value={['v0', 'v2']} onChange={() => {}} searchable={false} />);
  click(b.host.querySelector('button')!);
  expect([...document.querySelectorAll('[role=dialog] [data-sel-row]')].map((r) => r.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'true']);
  b.unmount();
});

test('one search rule: every select modal hides search at 6 options or fewer, unless forced', () => {
  const cases = [[3, undefined, false], [7, undefined, true], [3, true, true], [9, false, false]] as const;
  for (const [n, forced, shown] of cases) {
    const m = mount(<MultiSelectModal routeKey={`m-${n}-${forced}`} label="X" items={opts(n)} value={[]} onChange={() => {}} searchable={forced} />);
    click(m.host.querySelector('button')!);
    expect(!!searchBox()).toBe(shown);
    m.unmount();
  }
});

test('no search: focus lands on the picked row of the card that opened, also with two modals stacked', async () => {
  const x = [{ value: 'x1', label: 'X one' }, { value: 'x2', label: 'X two' }];
  const y = [{ value: 'y1', label: 'Y one' }, { value: 'y2', label: 'Y two' }];
  const m = mount(<><SelectModal routeKey="f-x" label="X" items={x} value="x2" onChange={() => {}} /><SelectModal routeKey="f-y" label="Y" items={y} value="y2" onChange={() => {}} /></>);
  const [bx, by] = [...m.host.querySelectorAll('button')];
  const onRow = (text: string) => until(() => document.activeElement?.hasAttribute('data-sel-row') === true && document.activeElement.textContent?.includes(text) === true);
  click(bx!);
  await onRow('X two');
  click(by!);
  await onRow('Y two');
  expect(document.activeElement!.closest('[role=dialog]')!.textContent).toContain('Y one');
  expect(document.activeElement!.closest('[role=dialog]')!.textContent).not.toContain('X one');
  m.unmount();
});
