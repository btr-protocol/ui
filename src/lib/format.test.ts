import { expect, test } from 'bun:test';
import { formatQty, formatUsd } from './format';

test('usd: cents under 100, whole dollars from 100', () => {
  expect(formatUsd(0)).toBe('$0.00');
  expect(formatUsd(99.994)).toBe('$99.99');
  expect(formatUsd(100)).toBe('$100');
  expect(formatUsd(1234567.89)).toBe('$1,234,568');
  expect(formatUsd(-250.5)).toBe('-$251');
});

test('qty: 0dp >=1000, 2dp >=1, 4dp >=0.01, else 6dp', () => {
  expect(formatQty(12345.678, 'en-US')).toBe('12,346');
  expect(formatQty(12.3456, 'en-US')).toBe('12.35');
  expect(formatQty(0.123456, 'en-US')).toBe('0.1235');
  expect(formatQty(0.00123456, 'en-US')).toBe('0.001235');
  expect(formatQty(1.5, 'en-US')).toBe('1.5');
  expect(formatQty(12345.678, 'de-DE')).toBe('12.346');
});
