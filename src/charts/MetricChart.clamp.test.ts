import { describe, expect, test } from 'bun:test';
import { bottomMargin, logicalToSec, nonNegative, secToLogical, timeGrid } from './metricChartMath';

describe('logical sync mapping', () => {
  // Irregular grid: a late partial bucket must not skew the map (the failure the index-only form had).
  const g = timeGrid([0, 60, 120, 180, 183].map((t) => t * 1000))!;

  test('round-trips inside and beyond the data', () => {
    for (const l of [-12.5, 0, 1.5, 3.5, 4, 9]) {
      expect(secToLogical(logicalToSec(l, g), g)).toBeCloseTo(l, 9);
    }
  });

  test('beyond the data extrapolates at the median spacing', () => {
    expect(g.barSec).toBe(60);
    expect(logicalToSec(-2, g)).toBe(-120);
    expect(secToLogical(240, g)).toBeCloseTo(4 + (240 - 183) / 60, 9);
  });

  test('peers with different grids agree on the time, not the index', () => {
    const other = timeGrid([600_000, 900_000, 1_200_000])!;
    const t = logicalToSec(-5, g);
    expect(logicalToSec(secToLogical(t, other), other)).toBeCloseTo(t, 9);
    expect(secToLogical(t, other)).toBeLessThan(0);
  });
});

describe('nonNegative', () => {
  test('floors only a series that never dips below zero', () => {
    expect(
      nonNegative([
        { t: 1, v: 0 },
        { t: 2, v: null },
        { t: 3, v: 5 },
      ]),
    ).toBe(true);
    expect(
      nonNegative([
        { t: 1, v: 1 },
        { t: 2, v: -0.01 },
      ]),
    ).toBe(false);
  });
});

describe('nonNegative empty', () => {
  test('no data, or nulls only, never floors', () => {
    expect(nonNegative([])).toBe(false);
    expect(nonNegative([{ t: 1, v: null }])).toBe(false);
  });
});

describe('bottomMargin', () => {
  const spec = (v: number, scale?: 'left') =>
    ({ id: 'a', label: 'a', type: 'area', color: '#fff', scale, points: [{ t: 1, v }] }) as never;
  test('flush for non-negative scales, inset when any series dips below zero', () => {
    expect(bottomMargin([spec(1)], 0, 'right')).toBe(0.02);
    expect(bottomMargin([spec(1), spec(-1)], 0, 'right')).toBe(0.08);
    expect(bottomMargin([spec(1)], 0, 'left')).toBe(0.08);
  });
});
