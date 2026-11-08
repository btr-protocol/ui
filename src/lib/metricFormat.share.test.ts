import { expect, test } from 'bun:test';
import { DASH } from './metricPhase';
import { fmtShare } from './metricFormat';

test('fmtShare: floored to 0.01%, 2dp, "<0.01%" below, never subscript', () => {
  const cases: [number | null | undefined, string][] = [
    [65.9, '65.90%'],
    [0.912, '0.91%'],
    [0.0188, '0.01%'],
    [0.00228, '<0.01%'],
    [0.0000599, '<0.01%'],
    [0.0099999, '<0.01%'],
    [0.01, '0.01%'],
    [0.29, '0.29%'],
    [1.999, '1.99%'],
    [99.999, '99.99%'],
    [100, '100.00%'],
    [0, '0.00%'],
    [-0.5, '-0.50%'],
    [null, DASH],
    [undefined, DASH],
    [Number.NaN, DASH],
    [Infinity, DASH],
  ];
  for (const [v, want] of cases) expect(fmtShare(v)).toBe(want);
  for (const v of [1e-9, 3.5e-5, 0.00228, 12.345]) expect(fmtShare(v)).not.toMatch(/[₀-₉]/);
  expect('100.00%'.length).toBe(7); // the widest cell
});
