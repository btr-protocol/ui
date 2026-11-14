import { describe, expect, test } from 'bun:test';
import { arcs, heatDomain, heatTone, ringPath, seriesCss } from './heatmapMath';
import { formatter, underwater } from './metricChartMath';

describe('heat scale', () => {
  test('diverging domain is symmetric about 0 and skips gaps', () => {
    expect(heatDomain([[-0.2, null], [0.5, Number.NaN]], true)).toEqual({ min: -0.5, max: 0.5 });
    expect(heatDomain([[null]], true)).toEqual({ min: 0, max: 1 });
  });
  test('tone follows the sign, share the magnitude', () => {
    const d = { min: -1, max: 1 };
    expect(heatTone(0.5, d, true)).toEqual({ tone: '--green', share: 0.35 });
    expect(heatTone(-1, d, true)?.tone).toBe('--red');
    expect(heatTone(null, d, true)).toBeNull();
    expect(heatTone(1, { min: 0, max: 1 }, false)?.tone).toBe('--orange');
  });
});

describe('doughnut', () => {
  test('arcs cover one turn in order and drop non-positive slices', () => {
    const a = arcs([{ id: 'a', label: 'A', value: 3 }, { id: 'b', label: 'B', value: 0 }, { id: 'c', label: 'C', value: 1 }]);
    expect(a.map((x) => x.id)).toEqual(['a', 'c']);
    expect(a[0].share).toBe(0.75);
    expect(a[1].to).toBeCloseTo(1, 12);
  });
  test('a full ring still draws (no zero-length arc)', () => {
    expect(ringPath(0, 1, 50, 30)).toContain('A50 50 0 1 1');
  });
  test('series colours: tokens first, mixed laps after', () => {
    expect(seriesCss(0)).toBe('var(--series-1)');
    expect(seriesCss(6)).toContain('color-mix');
    expect(seriesCss(6)).not.toBe(seriesCss(12));
  });
});

describe('equity helpers', () => {
  test('underwater is the drawdown from the running peak', () => {
    const u = underwater([{ t: 1, v: 100 }, { t: 2, v: 90 }, { t: 3, v: null }, { t: 4, v: 110 }, { t: 5, v: 99 }]);
    expect(u.map((p) => p.v == null ? p.v : Number(p.v.toFixed(9)))).toEqual([0, -0.1, null, 0, -0.1]);
  });
  test('multiple format', () => {
    expect(formatter('multiple')(2.5)).toBe('2.5x');
    expect(formatter('multiple')(12.34)).toBe('12.3x');
    for (const v of [NaN, Infinity, -Infinity]) expect(formatter('multiple')(v)).toBe(formatter('compact')(v));
  });
});
