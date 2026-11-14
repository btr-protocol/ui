import { describe, expect, test } from 'bun:test';
import { labelRows } from './Histogram';

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
