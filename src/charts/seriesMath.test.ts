import { describe, expect, test } from 'bun:test';
import { toCsv } from '../lib/download';
import { extent, histogram, normalPdf, quantile, returns, rollingReturn, rollingSharpe, rollingVol, std } from './seriesMath';

const pts = (vs: (number | null)[]) => vs.map((v, i) => ({ t: i * 86400000, v }));

describe('series math', () => {
  test('returns of a level series, gaps stay gaps', () => {
    expect(returns(pts([100, 110, null, 121, 121])).map((p) => p.v)).toEqual([0.10000000000000009, null, null, 0]);
  });
  test('rolling windows are null until full and over a gap', () => {
    const r = pts([0.1, 0.1, null, 0.1, 0.1, 0.1]);
    expect(rollingReturn(r, 2).map((p) => p.v?.toFixed(4) ?? null)).toEqual([null, '0.2100', null, null, '0.2100', '0.2100']);
  });
  test('rolling vol and sharpe annualise by sqrt(365)', () => {
    const r = pts([0.01, -0.01, 0.01, -0.01]);
    expect(rollingVol(r, 4)[3].v).toBeCloseTo(std([0.01, -0.01, 0.01, -0.01]) * Math.sqrt(365), 9);
    expect(rollingSharpe(pts([0.01, 0.01, 0.01]), 3)[2].v).toBeNull(); // zero variance: no Sharpe
  });
  test('quantile interpolates', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
  });
  test('histogram folds outliers into the end bins and keeps the total', () => {
    const h = histogram([0, 1, 2, 3, 100], 4, [0, 4]);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(5);
    expect(h.counts[3]).toBe(2);
    expect(h.edges).toEqual([0, 1, 2, 3, 4]);
  });
  test('normal density peaks at the mean', () => {
    expect(normalPdf(0, 0, 1)).toBeCloseTo(0.3989422804, 9);
  });
  test('csv quotes commas, quotes and newlines', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y'], [null, 'say "hi"']])).toBe('a,b\n1,"x,y"\n,"say ""hi"""\n');
  });
});

import { resample } from './seriesMath';
describe('resample', () => {
  const day = (i: number, v: number | null) => ({ t: Date.UTC(2026, 0, 1 + i), v });
  test('levels keep the last value of each month, returns compound', () => {
    const lv = [day(0, 1), day(10, 2), day(31, 3), day(40, 4)];
    expect(resample(lv, 'month').map((p) => p.v)).toEqual([2, 4]);
    const rt = [day(0, 0.1), day(1, 0.1), day(31, 0.5)];
    expect(resample(rt, 'month', 'compound').map((p) => Number((p.v as number).toFixed(4)))).toEqual([0.21, 0.5]);
    expect(resample(lv, 'day')).toHaveLength(4);
  });
});

describe('large inputs and csv safety', () => {
  test('extent and histogram take 300k points (no spread onto the stack)', () => {
    const xs = Array.from({ length: 300_000 }, (_, i) => i);
    expect(extent(xs)).toEqual([0, 299_999]);
    expect(extent([NaN, Infinity])).toBeUndefined();
    const h = histogram(xs, 10);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(300_000);
    expect(h.edges[0]).toBe(0);
  });
  test('csv cells that start like a formula get a leading apostrophe', () => {
    for (const c of ['=SUM(A1)', '+1', '-1+2', '@cmd', '\tx', '\rx']) expect(toCsv(['a'], [[c]]).split('\n')[1]!.replace(/^"/, '')).toStartWith("'");
    expect(toCsv(['a'], [[-5]])).toBe('a\n-5\n');
    expect(toCsv(['a'], [['ok']])).toBe('a\nok\n');
  });
});
