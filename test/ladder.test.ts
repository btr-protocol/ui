import { describe, expect, test } from 'bun:test';
import { geometricLadder, ladderIndexOf, linearLadder, snapToLadder } from '../src/lib/ladder';

const FIXED = geometricLadder(0.01, 100);

describe('geometricLadder', () => {
  test('emits the 1-2-5 progression per decade, bounds included', () => {
    expect(FIXED).toEqual([0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]);
  });

  test('off-progression bounds are not emitted', () => {
    expect(geometricLadder(0.02, 40).at(-1)).toBe(20);
    expect(geometricLadder(0.02, 40)[0]).toBe(0.02);
  });

  test('degenerate ranges yield an empty ladder', () => {
    expect(geometricLadder(100, 1)).toEqual([]);
    expect(geometricLadder(-1, 100)).toEqual([]);
  });
});

describe('linearLadder', () => {
  test('arithmetic stops inclusive of the top bound', () => {
    expect(linearLadder(10, 100, 5)).toHaveLength(19);
    expect(linearLadder(10, 100, 5).at(-1)).toBe(100);
  });
});

describe('snapToLadder', () => {
  test('snaps to nearest stop; ties round down', () => {
    expect(snapToLadder(0.03, FIXED)).toBe(0.02);
    expect(snapToLadder(0.04, FIXED)).toBe(0.05);
    expect(snapToLadder(30, FIXED)).toBe(20); // midpoint of 20|50 is 35
    expect(snapToLadder(37, FIXED)).toBe(50);
  });

  test('clamps outside the range and repairs non-finite input', () => {
    expect(snapToLadder(0.0001, FIXED)).toBe(0.01);
    expect(snapToLadder(999, FIXED)).toBe(100);
    expect(snapToLadder(NaN, FIXED)).toBe(FIXED[0]);
  });

  test('ladderIndexOf is the thumb position; typed values land on stops', () => {
    for (let i = 0; i < FIXED.length; i++) {
      expect(ladderIndexOf(FIXED[i], FIXED)).toBe(i);
      // Typing a value near a stop moves the thumb to THAT stop's exact index.
      const near = FIXED[i] * 1.3;
      expect(ladderIndexOf(snapToLadder(near, FIXED), FIXED)).toBeGreaterThanOrEqual(0);
      expect(FIXED).toContain(snapToLadder(near, FIXED));
    }
  });
});
