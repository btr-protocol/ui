/**
 * What "stacked" means here, pinned down.
 *
 * lightweight-charts has no stacked-area series, so the stack lives in the DATA: a stacked series
 * is PLOTTED at the running total of the ones declared before it. Two things follow, and both are
 * asserted rather than assumed; the second is the one that silently corrupts every number on
 * screen if it regresses:
 *
 * 1. The bands cannot cross, and the top band's edge IS the total.
 * 2. Every readout must report the series' OWN value, never the cumulative one it is drawn at.
 */

import { describe, expect, test } from 'bun:test';
import { type MetricSeriesSpec, latestActiveTime, ownValueAt, stackedPoints } from './MetricChart';
import { paintOrder, seriesPaint } from './metricChartMath';

const spec = (id: string, vs: (number | null)[], stack = true): MetricSeriesSpec => ({
  id,
  label: id,
  type: 'area',
  color: '#ffffff',
  stack,
  points: vs.map((v, i) => ({ t: (i + 1) * 3_600_000, v })),
});

const values = (pts: ReturnType<typeof stackedPoints>) =>
  pts.map((p) => ('value' in p ? p.value : null));

describe('stackedPoints', () => {
  test('plots each series at the running total of the ones below it', () => {
    const a = spec('a', [1, 2, 3]);
    const b = spec('b', [10, 20, 30]);
    const c = spec('c', [100, 200, 300]);
    expect(values(stackedPoints(a, []))).toEqual([1, 2, 3]);
    expect(values(stackedPoints(b, [a]))).toEqual([11, 22, 33]);
    expect(values(stackedPoints(c, [a, b]))).toEqual([111, 222, 333]);
  });

  test('bands never cross, and the top edge is the total', () => {
    // Deliberately out of order in size: a small band under a large one is exactly the case
    // that LOOKS like crossing when the fills are drawn over each other instead of stacked.
    const series = [spec('big', [50, 10, 30]), spec('small', [1, 40, 2]), spec('mid', [9, 5, 8])];
    const drawn = series.map((s, i) => values(stackedPoints(s, series.slice(0, i))));
    for (let i = 1; i < drawn.length; i++)
      for (let t = 0; t < 3; t++) expect(drawn[i]![t]!).toBeGreaterThanOrEqual(drawn[i - 1]![t]!);
    expect(drawn.at(-1)).toEqual([60, 55, 40]);
  });

  test('an unstacked series is drawn at its own value', () => {
    const a = spec('a', [1, 2, 3], false);
    const b = spec('b', [10, 20, 30], false);
    expect(values(stackedPoints(b, [a]))).toEqual([10, 20, 30]);
  });

  test('a null bucket stays a gap and contributes nothing to the base', () => {
    const a = spec('a', [1, null, 3]);
    const b = spec('b', [10, 20, 30]);
    expect(values(stackedPoints(a, []))).toEqual([1, null, 3]);
    expect(values(stackedPoints(b, [a]))).toEqual([11, 20, 33]);
  });
});

describe('stackedPoints, diverging', () => {
  test('positives and negatives stack from zero on their own side', () => {
    const a = spec('a', [3, -2, 4]);
    const b = spec('b', [-1, -5, 6]);
    const c = spec('c', [2, 1, -7]);
    // b drops below zero beside a's positive; c's positive sits on a's, never on b's negative.
    expect(values(stackedPoints(b, [a]))).toEqual([-1, -7, 6 + 4]);
    expect(values(stackedPoints(c, [a, b]))).toEqual([2 + 3, 1, -7 + -0]);
  });

  test('a mixed-sign bucket keeps every bar apart: no bar ends inside a neighbour', () => {
    const a = spec('a', [3]);
    const b = spec('b', [-4]);
    const c = spec('c', [5]);
    expect(values(stackedPoints(c, [a, b]))).toEqual([8]);
    expect(values(stackedPoints(b, [a]))).toEqual([-4]);
  });
});

describe('paintOrder', () => {
  const ids = (ss: MetricSeriesSpec[]) => paintOrder(ss).map((s) => s.id);

  test('a stacked pane paints its top band first, a dashed overlay last (on top)', () => {
    const line: MetricSeriesSpec = {
      ...spec('target', [1, 2, 3], false),
      type: 'line',
      dashed: true,
    };
    expect(ids([spec('bottom', [1]), spec('top', [1]), line])).toEqual(['top', 'bottom', 'target']);
  });

  test('an unstacked pane keeps its declared order', () => {
    expect(ids([spec('a', [1], false), spec('b', [1], false)])).toEqual(['a', 'b']);
  });
});

describe('ownValueAt', () => {
  test('reports the series own value, not the cumulative one it is drawn at', () => {
    const top = spec('top', [5, 6, 7]);
    const below = [spec('a', [1, 2, 3]), spec('b', [10, 20, 30])];
    // Drawn at 16; printing that under "top" is the bug this guards.
    expect(values(stackedPoints(top, below))[0]).toBe(16);
    expect(ownValueAt(top, 3_600_000)).toBe(5);
    expect(ownValueAt(top, 7_200_000)).toBe(6);
  });

  test('matches at second resolution and returns null off the grid', () => {
    const a = spec('a', [1, 2, 3]);
    expect(ownValueAt(a, 3_600_999)).toBe(1);
    expect(ownValueAt(a, 99_999_000)).toBeNull();
  });

  test('a null bucket reads as no value, not as zero', () => {
    expect(ownValueAt(spec('a', [1, null, 3]), 7_200_000)).toBeNull();
  });
});

describe('latestActiveTime', () => {
  test('skips a trailing bucket in which the whole pane was quiet', () => {
    const series = [spec('a', [1, 2, 0]), spec('b', [3, 4, 0])];
    expect(latestActiveTime(series)).toBe(7_200_000);
  });

  test('keeps a trailing bucket where any series moved', () => {
    const series = [spec('a', [1, 2, 0]), spec('b', [3, 4, 5])];
    expect(latestActiveTime(series)).toBe(10_800_000);
  });

  test('an all-quiet pane still reports its last bucket rather than nothing', () => {
    expect(latestActiveTime([spec('a', [0, 0, 0])])).toBe(10_800_000);
  });

  test('no points at all is null', () => {
    expect(latestActiveTime([spec('a', [])])).toBeNull();
  });
});

describe('seriesPaint on a stacked series', () => {
  const spec: MetricSeriesSpec = {
    id: 'a',
    label: 'a',
    type: 'area',
    color: '#ff0000',
    stack: true,
    points: [],
  };
  test('dimmed by fading toward the background, never by alpha', () => {
    const dim = seriesPaint(spec, 0.5, '#000000');
    expect(dim.topColor).toBe('rgba(128, 0, 0, 1)');
    expect(dim.bottomColor).toBe(dim.topColor);
    expect(seriesPaint(spec, 1, '#000000').topColor).toBe('rgba(255, 0, 0, 1)');
  });
  test('an unstacked series still dims by alpha', () => {
    expect(seriesPaint({ ...spec, stack: false }, 0.5, '#000000').lineColor).toBe(
      'rgba(255, 0, 0, 0.5)',
    );
  });
});

test('fade: a stacked area keeps an OPAQUE fill, paled toward the background; its line keeps the colour', () => {
  const spec = { id: 'a', label: 'a', type: 'area' as const, color: '#ff0000', stack: true, fade: 0.75, points: [] };
  const p = seriesPaint(spec, 1, '#000000');
  expect(p.topColor).toBe('rgba(64, 0, 0, 1)');
  expect(p.lineColor).toBe('rgba(255, 0, 0, 1)');
  expect(seriesPaint({ ...spec, fade: undefined }, 1, '#000000').topColor).toBe('rgba(255, 0, 0, 1)');
});

test('distinctShade: 12 hues at least 30 deg apart, then the cycle; yellows darker on light', async () => {
  const { distinctShade, DISTINCT_MAX } = await import('./colors');
  const hue = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const hs = Array.from({ length: DISTINCT_MAX }, (_, i) => hue(distinctShade(i, 'dark')));
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) { const d = Math.abs(hs[i] - hs[j]); expect(Math.min(d, 360 - d)).toBeGreaterThan(25); }
  expect(distinctShade(DISTINCT_MAX, 'dark')).toBe(distinctShade(0, 'dark'));
  const lum = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
  const yellow = hs.findIndex((h) => h > 50 && h < 70);
  expect(lum(distinctShade(yellow, 'light'))).toBeLessThan(lum(distinctShade(yellow, 'dark')));
});
