import { expect, test } from 'bun:test';
import { type MetricSeriesSpec, seriesPaint } from './metricChartMath';

const spec: MetricSeriesSpec = { id: 'a', label: 'A', type: 'line', color: '#E99339', points: [] };

test('hover halves each painted channel while preserving its resting treatment', () => {
  for (const type of ['line', 'area', 'histogram'] as const) {
    for (const stack of [false, true]) {
      const s = { ...spec, type, stack, opacity: 0.4 };
      const rest = seriesPaint(s);
      const dim = seriesPaint(s, 0.5);
      const opacity = (color: string) => Number(color.slice(color.lastIndexOf(',') + 1, -1));
      for (const key of Object.keys(rest) as (keyof typeof rest)[]) {
        expect(opacity(dim[key])).toBeCloseTo(opacity(rest[key]) / 2);
      }
      expect(seriesPaint(s, 1)).toEqual(rest);
    }
  }
});

test('stacked histograms stay opaque at rest; unstacked bars retain their wash', () => {
  expect(seriesPaint({ ...spec, type: 'histogram', stack: true }).color).toEndWith(', 1)');
  expect(seriesPaint({ ...spec, type: 'histogram' }).color).toEndWith(', 0.45)');
});
