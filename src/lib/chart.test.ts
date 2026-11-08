import { expect, test } from 'bun:test';
import { chartFormatter, chartOptions, fmtBps } from './chart';

const colors = { chartText: '#t', chartBorder: '#b', bg2: '#2', fg2: '#f' };

test('usd axis uses the front compact ladder with 2dp', () => {
  const f = chartFormatter('usd');
  expect(f(280_000)).toBe('$280.00K');
  expect(f(400)).toBe('$400.00');
  expect(f(1e-12)).toBe(f(0));
});

test('count rounds below 1000, bps caps at 2dp', () => {
  expect(chartFormatter('count')(2.5)).toBe('3');
  expect(fmtBps(0.254)).toBe('0.25 bps');
});

test('chartOptions matches the front: no grid, 10px mono, 44px scale', () => {
  const o = chartOptions(colors, { timeAxis: false });
  expect(o.grid.horzLines.visible).toBe(false);
  expect(o.layout.fontSize).toBe(10);
  expect(o.layout.textColor).toBe('#t');
  expect(o.rightPriceScale.minimumWidth).toBe(44);
  expect(o.timeScale.visible).toBe(false);
  expect(o.handleScroll.vertTouchDrag).toBe(false);
});
