import { expect, test } from 'bun:test';
import { fmtSignedPct } from '../src/lib/metricFormat';

test('fmtSignedPct: fraction in, bps under 1%, percent above, dash unread', () => {
  expect(fmtSignedPct(0.004)).toBe('+40 bps');
  expect(fmtSignedPct(0.024)).toBe('+2.4%');
  expect(fmtSignedPct(0)).toBe('0 bps');
  expect(fmtSignedPct(Number.NaN)).toBe('-');
});
