import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { Button, ChartPanel, ChainGlyph, Notice, PageHeader, SegmentedControl, StackedIcons } from '../src';

test('Notice: icon is one line tall and centred; a Button child sits in the tone slot', () => {
  const h = render(<Notice tone="warning" action={<Button size="sm">Review</Button>}>x</Notice>);
  expect(h).toContain('h-6');
  expect(h).toContain('h-5 w-5');
  expect(h).toContain('notice-slot');
});

test('glyphs are circular', () => {
  expect(render(<ChainGlyph chainId={143} />)).toContain('rounded-full');
  expect(render(<ChainGlyph chainId={143} />)).not.toContain('rounded-xs');
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
