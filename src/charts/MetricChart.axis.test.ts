import { describe, expect, test } from 'bun:test';
import { axisDecimals, formatter, trimZeros } from './metricChartMath';

// The owner's screenshot: a base-1 index spanning 0.99..1.01 ticked "1.01 1.01 1.01 1 1 1 0.99".
describe('axis tick decimals follow the axis span', () => {
  test('axisDecimals: one digit finer than a 1/50th of the span, 0..8', () => {
    expect(axisDecimals(100)).toBe(0);
    expect(axisDecimals(1)).toBe(2);
    expect(axisDecimals(0.02)).toBe(4);
    expect(axisDecimals(0)).toBe(0);
    expect(axisDecimals(1e-12)).toBe(8);
  });
  test('compact: ticks of a 2% band on a base-1 index are all distinct', () => {
    const ticks = [1.01, 1.0075, 1.005, 1.0025, 1, 0.9975, 0.995, 0.9925, 0.99];
    const labels = ticks.map((v) => trimZeros(formatter('compact', 0.02)(v)));
    expect(new Set(labels).size).toBe(ticks.length);
    expect(labels[0]).toBe('1.01');
    expect(labels[4]).toBe('1');
    // Without a span, the fixed 2dp ladder (the legend at rest) is unchanged.
    expect(formatter('compact')(1.0075)).toBe('1.01');
    // A wide span keeps the ladder: no extra digits on a $-sized number.
    expect(formatter('compact', 500)(123.456)).toBe('123.46');
  });
  test('pct: a thin band around a large percent gets the decimals the band needs, elsewhere 3 sig figs', () => {
    const f = formatter('pct', 0.00002);
    expect(f(0.50001)).toBe('50.00100%');
    expect(f(0.50002)).not.toBe(f(0.50001));
    expect(formatter('pct', 0.5)(0.1234)).toBe(formatter('pct')(0.1234));
  });
});
