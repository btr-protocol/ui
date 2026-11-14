import { describe, expect, test } from 'bun:test';
import { atSpan, axisDecimals, formatter, legendText, legendTrim, scaleSpan, seriesSpan, trimZeros } from './metricChartMath';
import { formatCurrencyCompact } from '../lib/format';

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

// Span decimals at every magnitude: the compact ladder reads the span in the value's own K/M unit.
describe('axis tick decimals on the compact ladders', () => {
  test('usd: a $20 span on a $5,000 NAV prints distinct ticks, not "$5.00K" repeated', () => {
    const ticks = [4980, 5000, 5020, 5040];
    const labels = ticks.map((v) => trimZeros(formatter('usd', 20)(v)));
    expect(new Set(labels).size).toBe(ticks.length);
    expect(labels).toEqual(['$4.98K', '$5K', '$5.02K', '$5.04K']);
    // No span: the fixed 2dp $ ladder, unchanged.
    expect(formatter('usd')(5000)).toBe('$5.00K');
    // A wide span keeps the ladder, and sub-1000 values keep "$400.00".
    expect(formatter('usd', 2000)(5000)).toBe('$5.00K');
    expect(formatter('usd', 20)(400)).toBe('$400.00');
  });
  test('>= 1000 plain: a thin span on 1,500 prints the decimals it needs, a wide one the ladder', () => {
    const f = formatter('compact', 20);
    const labels = [1480, 1500, 1520].map((v) => trimZeros(f(v)));
    expect(new Set(labels).size).toBe(3);
    expect(labels).toEqual(['1.48K', '1.5K', '1.52K']);
    expect(formatter('compact', 500)(1500)).toBe('1.50K');
    expect(formatter('compact')(1500)).toBe('1.50K');
  });
  test('two series on one axis: the shared scale span (MetricChart seriesSpan), not a flat first series, sets the decimals', () => {
    // Series A is flat at 1.00 (its own autoscale span is 0); series B spans 0.99..1.01 on the same right scale.
    const ownSpans = new Map([['a', 0], ['b', 0.02]]);
    const chart = (id: string, pane: number) => (id === 'right' && pane === 0 ? { getVisibleRange: () => ({ from: 0.99, to: 1.01 }) } : undefined);
    const a = { id: 'a', pane: 0 };
    const b = { id: 'b', pane: 0, scale: 'right' as const };
    const shared = seriesSpan(a, chart, ownSpans);
    expect(shared).toBeCloseTo(0.02, 10);
    expect(seriesSpan(b, chart, ownSpans)).toBe(shared);
    // Not attached (no scale / throws): each series falls back to its own autoscale span.
    expect(seriesSpan(a, () => undefined, ownSpans)).toBe(0);
    expect(seriesSpan({ id: 'h', scale: 'hidden' }, (id) => ({ getVisibleRange: () => (id === 'hidden:h' ? { from: 0, to: 4 } : null) }), ownSpans)).toBe(4);
    const ticks = [1.01, 1.005, 1, 0.995, 0.99];
    const collapsed = new Set(ticks.map((v) => trimZeros(formatter('compact', ownSpans.get('a'))(v)))).size;
    const labels = ticks.map((v) => trimZeros(formatter('compact', seriesSpan(a, chart, ownSpans))(v)));
    expect(collapsed).toBeLessThan(ticks.length);
    expect(new Set(labels).size).toBe(ticks.length);
  });
});

describe('yield and bps follow the axis span too', () => {
  test('yield: a 3.66-3.70% band prints distinct percent ticks; a wide span keeps the APR ladder', () => {
    const ticks = [0.0366, 0.0367, 0.0368, 0.0369, 0.037];
    const labels = ticks.map((v) => trimZeros(formatter('yield', 0.0004)(v)));
    expect(new Set(labels).size).toBe(ticks.length);
    expect(formatter('yield')(0.0368)).toBe('3.68%');
    expect(formatter('yield', 0.5)(0.0368)).toBe('3.68%');
  });
  test('bps: a non-finite reading is a dash, never "NaN bps"', () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      expect(formatter('bps')(v)).toBe('-');
      expect(formatter('bps', 0.02)(v)).toBe('-');
    }
  });
  test('bps: a thin span prints the decimals it needs, no span keeps 2dp', () => {
    const labels = [4.5, 4.52, 4.54].map((v) => trimZeros(formatter('bps', 0.02)(v)));
    expect(new Set(labels).size).toBe(3);
    expect(formatter('bps')(4.5)).toBe('4.5 bps');
    expect(formatter('bps', 500)(4.5)).toBe('4.5 bps');
  });
});

describe('non-finite readings and the legend trim', () => {
  test('a NaN reading prints as the ladder does for it, never NaN', () => {
    expect(formatter('usd', 20)(Number.NaN)).toBe(formatCurrencyCompact(Number.NaN));
    expect(formatter('compact', 20)(Number.NaN)).toBe('0');
  });
  test('pct and yield with Infinity fall back like NaN, never "∞%"', () => {
    for (const f of ['pct', 'yield'] as const)
      for (const v of [Infinity, -Infinity]) expect(formatter(f, 0.0004)(v)).toBe(formatter(f, 0.0004)(Number.NaN));
  });
  test('legendText trims only span-chosen decimals; a ladder reading keeps its zeros', () => {
    expect(legendText('usd', undefined, 5000)).toBe('$5.00K');
    expect(legendText('usd', 2000, 5000)).toBe('$5.00K');
    expect(legendText('pct', 0.00002, 0.50001)).toBe('50.001%');
    expect(legendText('compact', 500, 1500)).toBe('1.50K');
    expect(legendText('compact', 0.02, 1.0)).toBe('1.00');
  });
  test('legendTrim keeps the 2dp ladder and drops only the surplus span digits', () => {
    expect(legendTrim('1.0000')).toBe('1.00');
    expect(legendTrim('1.0050')).toBe('1.005');
    expect(legendTrim('$5.0200K')).toBe('$5.02K');
    expect(legendTrim('1.50K')).toBe('1.50K');
    expect(legendTrim('50.00100%')).toBe('50.001%');
  });
});

describe('scaleSpan: the axis span, with its fallback', () => {
  test('a visible range gives its height, whatever the fallback', () => {
    expect(scaleSpan(() => ({ from: 0.99, to: 1.01 }), 5)).toBeCloseTo(0.02, 10);
  });
  test('a scale that throws (not attached yet) falls back to the autoscale span', () => {
    const throwing = () => {
      throw new Error('scale not found');
    };
    expect(scaleSpan(throwing, 7)).toBe(7);
    expect(scaleSpan(throwing)).toBeUndefined();
  });
  test('a scale with no range yet (null) falls back too', () => {
    expect(scaleSpan(() => null, 3)).toBe(3);
    expect(scaleSpan(() => undefined)).toBeUndefined();
  });
});

describe('atSpan', () => {
  test('a stable pair prints the decimals its axis needs, trimmed to the ladder floor', () => {
    expect(atSpan('1.0000', 1.00002, 0.0004)).toBe('1.00002');
    expect(atSpan('1.0000', 1, 0.0004)).toBe('1.0000');
    expect(atSpan('1.0001', 1.0001, 0.0004)).toBe('1.0001');
  });
  test('a ladder that already separates the ticks, or has no plain decimals, is untouched', () => {
    expect(atSpan('62,500.12', 62500.123, 40)).toBe('62,500.12');
    expect(atSpan('0.0\u2084123', 0.00000123, 1e-7)).toBe('0.0\u2084123');
    expect(atSpan('1.0000', 1.00002, undefined)).toBe('1.0000');
  });
});
