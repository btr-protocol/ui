import { describe, expect, test } from 'bun:test';
import { labelRows, layoutLabels } from './Histogram';

describe('labelRows', () => {
  test('labels closer than the label width go to different rows', () => {
    expect(labelRows([100, 120, 300])).toEqual([0, 1, 0]);
  });
  test('a 5th close label gets its own row instead of overprinting the 4th', () => {
    expect(labelRows([100, 101, 102, 103, 104])).toEqual([0, 1, 2, 3, 4]);
    const rows = labelRows([100, 101, 102, 103, 104, 105]);
    expect(new Set(rows).size).toBe(6);
  });
});

describe('layoutLabels', () => {
  test('under the cap nothing is elided', () => {
    expect(layoutLabels([100, 101, 102], 5)).toEqual({ rows: [0, 1, 2], elided: 0, used: 3 });
  });
  test('20 labels in one band are capped: overflow elided with a count, last row kept for it', () => {
    const l = layoutLabels(Array.from({ length: 20 }, (_, i) => 100 + i), 6);
    expect(l.used).toBe(6);
    expect(l.rows.filter((r) => r != null)).toHaveLength(5);
    expect(l.elided).toBe(15);
    expect(Math.max(...l.rows.filter((r): r is number => r != null))).toBeLessThan(5);
  });
});

import { render } from 'preact-render-to-string';
import { Histogram } from './Histogram';
test('Histogram: 20 close markers keep the plot at least 80px tall', () => {
  const edges = Array.from({ length: 11 }, (_, i) => i);
  const markers = Array.from({ length: 20 }, (_, i) => ({ x: 5 + i * 0.01, label: `m${i}` }));
  const h = render(<Histogram edges={edges} counts={Array(10).fill(3)} format={String} markers={markers} label="h" height={240} />);
  expect(h).toContain('more');
  const ys = [...h.matchAll(/<rect[^>]* y="([\d.]+)"/g)].map((m) => Number(m[1]));
  expect(Math.min(...ys)).toBeLessThan(240 - 20 - 79);
});
