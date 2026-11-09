import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { Button, ChartPanel, ChainGlyph, ChainStack, Notice, PageHeader, ProtocolGlyph, SegmentedControl, StackedIcons, TokenGlyph } from '../src';

test('Notice: icon is one line tall and centred; a Button child sits in the tone slot', () => {
  const h = render(<Notice tone="warning" action={<Button size="sm">Review</Button>}>x</Notice>);
  expect(h).toContain('h-[var(--ctl-m)]'); // the glyph slot is one control tall: a notice with and without an action has the same height
  expect(h).toContain('min-h-[calc(var(--ctl-m)+1.5rem)]');
  expect(render(<Notice tone="warning">x</Notice>)).toContain('min-h-[calc(var(--ctl-m)+1.5rem)]');
  expect(h).toContain('h-5 w-5');
  expect(h).toContain('notice-slot');
});

test('icon shapes: chains are rounded squares (owner round 4), tokens and protocols circles', () => {
  for (const c of [143, 999999]) {
    const g = render(<ChainGlyph chainId={c} name="Zz" />);
    expect(g).toContain('rounded-xs');
    expect(g).not.toContain('rounded-full');
  }
  const cs = render(<ChainStack chains={[{ id: 143, name: 'Monad' }, { id: 1, name: 'Ethereum' }]} />);
  expect(cs).toContain('rounded-xs');
  expect(cs).not.toMatch(/class="[^"]*rounded-full[^"]*"[^>]*><img/);
  for (const sym of ['USDC', 'NOPE_TOKEN']) expect(render(<TokenGlyph symbol={sym} />)).toContain('rounded-full');
  expect(render(<ProtocolGlyph name="Aave" />)).toContain('rounded-full');
  const s = render(<StackedIcons items={[{ id: 1, label: 'a', icon: '/a.png' }, { id: 2, label: 'b', icon: '/b.png' }]} max={1} />);
  expect(s).toContain('rounded-full');
  expect(s).not.toContain('rounded-xs');
});

test('SegmentedControl equal mode uses equal-width columns', () => {
  const o = [{ value: 'a', label: 'A' }, { value: 'bb', label: 'Longer' }];
  expect(render(<SegmentedControl options={o} value="a" onChange={() => {}} equal />)).toContain('auto-cols-fr');
  expect(render(<SegmentedControl options={o} value="a" onChange={() => {}} />)).not.toContain('auto-cols-fr');
});

test('PageHeader puts controls beside the title (row from sm)', () => {
  const h = render(<PageHeader title="T" subtitle="S" controls={<b>C</b>} />);
  expect(h).toContain('sm:flex-row');
  expect(h).toContain('<b>C</b>');
});

test('ChartPanel: header readout, table left of chart on lg, order-last below xl', () => {
  const h = render(<ChartPanel title="Holdings" value="$1" date="today" table={<i>tbl</i>} controls={<u>c</u>}><canvas /></ChartPanel>);
  expect(h).toContain('Holdings');
  expect(h).toContain('xl:grid-cols-');
  expect(h).toContain('max-xl:order-last');
  expect(h).toContain('[&amp;>*]:shrink-0'); // phone: the controls wrap (none hidden behind a scroll), none squashes
  expect(h.indexOf('tbl')).toBeLessThan(h.indexOf('<canvas'));
});

test('protocolIcon: known protocols resolve (versions ignored), Wallet is a glyph, unknown has none', async () => {
  const { protocolIcon, ProtocolGlyph } = await import('../src');
  for (const n of ['Aave V3', 'Aave V2', 'Venus', 'Morpho Blue', 'Euler V2', 'Fluid', 'Wombat Exchange', 'Wombex', 'Merkl', 'BTR', 'BC-USDC', 'Compound V3'])
    expect(protocolIcon(n), n).toBeTruthy();
  expect(protocolIcon('Wallet')).toBeUndefined();
  expect(protocolIcon('Nonexistent')).toBeUndefined();
  expect(render(<ProtocolGlyph name="Wallet" />)).toContain('lucide-wallet');
  expect(render(<ProtocolGlyph name="Aave V3" />)).toContain('rounded-full');
});

test('ChartPanel: the chart fills the body (floor on phones, as tall as the table on xl); the full-size button only with a key', () => {
  const plain = render(<ChartPanel title="T" table={<table />}>c</ChartPanel>);
  expect(plain).toContain('min-h-[18rem]');
  expect(plain).toContain('absolute inset-0');
  expect(plain).not.toContain('aria-expanded');
  const full = render(<ChartPanel title="T" fullscreenKey="holdings-chart" fullscreenLabels={{ open: 'Full size', close: 'Close' }}>c</ChartPanel>);
  expect(full).toContain('aria-label="Full size"');
  expect(full).toContain('aria-expanded="false"');
  expect(full).not.toContain('fixed inset-0');
});

test('ChartPanel: a ?modal=<key> deep link renders the panel as a full-viewport dialog', () => {
  const g = globalThis as any;
  const saved = { location: g.location, history: g.history, window: g.window };
  g.window = {};
  g.location = { search: '?modal=holdings-chart', href: 'http://x/?modal=holdings-chart' };
  g.history = { state: null };
  try {
    const html = render(<ChartPanel title="T" fullscreenKey="holdings-chart">c</ChartPanel>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('fixed inset-0');
    expect(html).toContain('aria-expanded="true"');
    expect(render(<ChartPanel title="T" fullscreenKey="other">c</ChartPanel>)).not.toContain('role="dialog"');
  } finally {
    Object.assign(g, saved);
  }
});
