import { describe, expect, test } from 'bun:test';
import { type MetricSeriesSpec, legendValueNodes, restingValue } from './metricChartMath';

// A minimal ParentNode: the helper only needs querySelectorAll('[data-value]') and dataset.
const span = (value: string) => ({ dataset: { value } }) as unknown as HTMLElement;
const host = (values: string[]) =>
  ({ querySelectorAll: () => values.map(span) }) as unknown as ParentNode;

describe('legendValueNodes', () => {
  test('selector-breaking telemetry ids map to their span instead of throwing', () => {
    const hostile = ['Mozilla"]', 'a[b', 'x\\"y', 'Chrome'];
    const nodes = legendValueNodes(host(hostile));
    for (const id of hostile) expect(nodes.get(id)?.dataset.value).toBe(id);
  });
});

describe('restingValue', () => {
  const spec = (resting?: number | null) =>
    ({
      id: 'hook',
      label: 'Hook',
      type: 'area',
      color: '#000',
      points: [
        { t: 1000, v: 5 },
        { t: 2000, v: null },
      ],
      ...(resting === undefined ? {} : { resting }),
    }) as MetricSeriesSpec;

  test('the back window figure wins over the latest bucket, an unknown one stays unknown', () => {
    expect(restingValue(spec(22.8), 2000)).toBe(22.8);
    expect(restingValue(spec(null), 1000)).toBeNull();
  });

  test('without one, the pane latest bucket is read', () => {
    expect(restingValue(spec(), 1000)).toBe(5);
    expect(restingValue(spec(), 2000)).toBeNull();
    expect(restingValue(spec(), null)).toBeNull();
  });
});
