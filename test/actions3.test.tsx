import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { SWATCH_COUNT, SegmentedControl, SELECTED_ROW, SwatchSelect, Table, TokenAmount, formatQtyStr, swatchColor } from '../src';
import { click, mount, until, useDom } from './dom';

useDom();

test('formatQtyStr: the auto formatter on chain decimal strings', () => {
  expect(formatQtyStr('149.950130446265320681')).toBe('149.95');
  expect(formatQtyStr('12345.678')).toBe('12,346');
  expect(formatQtyStr('0.0006131840')).toBe('0.000613');
  expect(formatQtyStr('0.5')).toBe('0.5');
  expect(formatQtyStr('0.04567')).toBe('0.0457');
  expect(formatQtyStr('0.00000973')).toBe('0.00001');
  expect(formatQtyStr('0.5')).toBe('0.5');
  expect(formatQtyStr('n/a')).toBe('—');
  expect(formatQtyStr('')).toBe('—');
  expect(formatQtyStr('0x1f')).toBe('—');
  expect(formatQtyStr('0.0000000001')).toBe('<0.000001');
  expect(formatQtyStr('0.0000004')).toBe('<0.000001');
  expect(formatQtyStr('0.0000006')).toBe('0.000001');
  expect(formatQtyStr('0')).toBe('0');
  expect(formatQtyStr('-0.0')).toBe('0');
  expect(formatQtyStr('-0.00000000001')).toBe('>-0.000001');
});

test('TokenAmount: icon + formatted qty + symbol', () => {
  const h = render(<TokenAmount symbol="WMON" amount="149.950130446265320681" />);
  expect(h).toContain('149.95');
  expect(h).toContain('WMON');
});

test('swatchColor wraps over the 12 series tokens', () => {
  expect(swatchColor(0)).toBe('var(--series-1)');
  expect(swatchColor(SWATCH_COUNT - 1)).toBe(`var(--series-${SWATCH_COUNT})`);
  expect(swatchColor(SWATCH_COUNT)).toBe('var(--series-1)');
  expect(swatchColor(-1)).toBe(`var(--series-${SWATCH_COUNT})`);
});

test('SegmentedControl md rides the control height token (same as Input/Button sm)', () => {
  const o = [{ value: 'a', label: 'A' }];
  expect(render(<SegmentedControl options={o} value="a" onChange={() => {}} />)).toContain('h-[var(--ctl-m)]');
});

test('selected master row = the SelectionModal highlight, no bar; frame=false drops the border', () => {
  expect(SELECTED_ROW).toContain('bg-bg-primary');
  expect(SELECTED_ROW).toContain('text-primary');
  expect(SELECTED_ROW).not.toContain('inset');
  const h = render(<Table noHeader searchable={false} frame={false} data={[{ k: 'a' }]} rowKey={(r) => r.k} selectedKey="a" onSelect={() => {}} columns={[{ key: 'k', label: 'K' }]} />);
  expect(h).toContain('bg-bg-primary');
  expect(h).toContain('border-0');
});

test('SwatchSelect: picking a swatch reports its index, Default reports null', async () => {
  const got: (number | null)[] = [];
  const { host, unmount } = mount(<SwatchSelect routeKey="t-sw" label="Colour" value={0} isDefault onChange={(v) => got.push(v)} />);
  const row = (l: string) => [...document.querySelectorAll<HTMLElement>('[role=dialog] button')].find((b) => b.textContent?.trim() === l)!;
  click(host.querySelector('button')!);
  click(row('Teal'));
  await until(() => !document.querySelector('[role=dialog]'));
  click(host.querySelector('button')!);
  click(row('Default'));
  expect(got).toEqual([5, null]);
  unmount();
});
