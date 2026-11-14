import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { ChartStack } from './ChartStack';

const pane = { id: 'p', title: 'Equity', format: 'pct' as const, series: [{ id: 's', label: 'S', type: 'line' as const, color: '#000000', points: [{ t: 1000, v: 1 }, { t: 2000, v: 2 }] }] };

test('pane height applies to the chart alone below xl and to the whole row at xl, so the pane table never overlaps the next pane', () => {
  const h = render(<ChartStack title="T" panes={[pane]} />);
  expect(h).toContain('--ph:260px');
  expect(h).toContain('xl:h-[var(--ph)]');
  expect(h).toContain('max-xl:h-[var(--ph)]');
  expect(h).not.toMatch(/style="height:/);
});
