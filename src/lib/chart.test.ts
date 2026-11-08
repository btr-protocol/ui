import { expect, test } from 'bun:test';
import { formatUsd } from './format';
import { chartFormatter, chartOptions, fmtBps, tickMarkFormatter, timeLabel } from './chart';

const colors = { chartText: '#t', chartBorder: '#b', bg2: '#2', fg2: '#f' };

test('usd axis calls formatUsd', () => {
  const f = chartFormatter('usd');
  expect(f(280_000)).toBe(formatUsd(280_000));
  expect(f(400)).toBe('$400');
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

test('time ticks: dates at day boundaries, clock inside the day', () => {
  const t = Date.UTC(2026, 10, 6, 12, 17) / 1000;
  expect(tickMarkFormatter(t, 3)).toBe('12:17');
  expect(tickMarkFormatter(t, 2)).toBe('Nov 6');
  expect(tickMarkFormatter(t, 1)).toBe('Nov');
  expect(tickMarkFormatter(t, 0)).toBe('2026');
  expect(timeLabel(t)).toBe('Nov 6, 12:17');
});
