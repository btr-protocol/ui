import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import {
  ChainMultiSelect,
  Header,
  MasterDetail,
  NavBadge,
  StackedIcons,
  TabBar,
  Table,
  Timeline,
  rowNavTarget,
} from '../src';

const rows = [{ id: 'a', n: 'Alpha' }, { id: 'b', n: 'Beta' }];
const cols = [{ key: 'n', label: 'Name' }];

test('Table selectable: aria-selected, fused style, roving tabindex', () => {
  const html = render(
    <Table columns={cols} data={rows} rowKey={(r) => r.id} searchable={false} selectedKey="b" onSelect={() => {}} />,
  );
  expect(html).toContain('role="grid"');
  expect(html).toContain('aria-selected="true"');
  expect(html).toContain('aria-selected="false"');
  expect(html).toContain('bg-bg-primary hover:bg-bg-primary text-primary font-semibold');
  // only the selected row is a tab stop
  expect(html.match(/tabindex="0"/g)?.length).toBe(2); // desktop tr + mobile card
  expect(render(<Table columns={cols} data={rows} rowKey={(r) => r.id} />)).not.toContain('aria-selected');
});

test('rowNavTarget: arrows clamp, Home/End jump, others ignored', () => {
  expect(rowNavTarget('ArrowDown', 0, 3)).toBe(1);
  expect(rowNavTarget('ArrowDown', 2, 3)).toBe(2);
  expect(rowNavTarget('ArrowUp', 0, 3)).toBe(0);
  expect(rowNavTarget('End', 0, 3)).toBe(2);
  expect(rowNavTarget('Home', 2, 3)).toBe(0);
  expect(rowNavTarget('x', 1, 3)).toBeNull();
  expect(rowNavTarget('ArrowDown', 0, 0)).toBeNull();
});

test('MasterDetail: clamp grid, drill-down classes follow `selected`', () => {
  const list = render(<MasterDetail master="M" detail="D" selected={false} onBack={() => {}} placeholder="P" />);
  expect(list).toContain('clamp(280px,22%,360px)');
  expect(list).toContain('P');
  expect(list).not.toContain('>D<');
  expect(list).not.toContain('Back');
  const det = render(<MasterDetail master="M" detail="D" selected onBack={() => {}} backLabel="Retour" />);
  expect(det).toContain('max-lg:hidden'); // master hidden below lg
  expect(det).toContain('Retour');
  expect(det).toContain('>D<');
});

test('NavBadge hides at 0, caps at 99+, reads the sentence', () => {
  expect(render(<NavBadge count={0} />)).toBe('');
  expect(render(<NavBadge count={120} />)).toContain('99+');
  expect(render(<NavBadge count={3} label="3 transactions awaiting your signature" />)).toContain(
    '3 transactions awaiting your signature',
  );
  const items = [{ path: '/s', title: 'To sign', badge: 2 }, { path: '/r', title: 'Routines' }];
  expect(render(<TabBar tabs={items} activePath="/s" onNavigate={() => {}} />)).toContain('2 pending');
  expect(render(<Header items={items} activePath="/s" onNavigate={() => {}} brandLabel="H" />)).toContain('2 pending');
});

test('StackedIcons: first N plus +N chip, full list as accessible name', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ id: x, label: x.toUpperCase(), icon: `/${x}.svg` }));
  const html = render(<StackedIcons items={items} max={3} />);
  expect(html.match(/<img/g)?.length).toBe(3);
  expect(html).toContain('+2');
  expect(html).toContain('aria-label="A, B, C, D, E"');
  expect(render(<StackedIcons items={items.slice(0, 2)} />)).not.toContain('+');
});

test('Timeline: day headings once per group, trailing link, empty slot', () => {
  const html = render(
    <Timeline
      items={[
        { id: '1', icon: 'check', title: 'Alice signed #42', meta: '10:02', group: 'Today', href: 'https://x', linkLabel: 'Open tx' },
        { id: '2', title: 'Bob proposed #43', group: 'Today' },
        { id: '3', title: 'Old', group: 'Yesterday' },
      ]}
    />,
  );
  expect(html.match(/<h3/g)?.length).toBe(2);
  expect(html).toContain('aria-label="Open tx"');
  expect(render(<Timeline items={[]} empty="No activity yet" />)).toContain('No activity yet');
});

test('ChainMultiSelect trigger: stacked picked chains, All when full', () => {
  const chains = [{ id: 1, name: 'Ethereum' }, { id: 8453, name: 'Base' }, { id: 10, name: 'Optimism' }];
  const some = render(<ChainMultiSelect chains={chains} value={[1, 8453]} onChange={() => {}} />);
  expect(some).toContain('aria-label="Ethereum, Base"');
  const all = render(<ChainMultiSelect chains={chains} value={[1, 8453, 10]} onChange={() => {}} />);
  expect(all).toContain('>All<');
});

import { AuthShell, SegmentedControl } from '../src';
import { trimZeros } from '../src/charts/metricChartMath';

test('axis labels drop trailing zeros', () => {
  expect(trimZeros('$800.00K')).toBe('$800K');
  expect(trimZeros('$1.20M')).toBe('$1.2M');
  expect(trimZeros('$689.14K')).toBe('$689.14K');
  expect(trimZeros('$0.00')).toBe('$0');
  expect(trimZeros('$400.00')).toBe('$400');
  expect(trimZeros('100%')).toBe('100%');
});

test('Header / TabBar items and SegmentedControl link mode are real anchors', () => {
  const items = [{ path: '/safes', title: 'Safes' }, { path: '/actions', title: 'Actions' }];
  expect(render(<Header items={items} activePath="/safes" onNavigate={() => {}} />)).toContain('href="/actions"');
  expect(render(<TabBar tabs={items} activePath="/safes" onNavigate={() => {}} />)).toContain('<a href="/actions"');
  const html = render(<SegmentedControl aria-label="Sections" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A', href: '/x/a' }, { value: 'b', label: 'B', href: '/x/b' }]} />);
  expect(html).toMatch(/<a [^>]*href="\/x\/b"[^>]*role="tab"|<a [^>]*role="tab"[^>]*href="\/x\/b"/);
});

test('AuthShell: card only, no nav', () => {
  const html = render(<AuthShell brand={<b>BTR</b>} hint="Signers only" corner={<i>theme</i>}><button>Sign in</button></AuthShell>);
  expect(html).toContain('Sign in');
  expect(html).not.toContain('<header');
  expect(html).not.toContain('<nav');
  expect(html).not.toContain('<footer');
});
