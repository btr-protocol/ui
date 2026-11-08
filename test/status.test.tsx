import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { BatchBar, ClickMenu, ProgressSteps, StatusChip, StatusList } from '../src';

test('ProgressSteps: segments, count, clamping, plain count beyond 8', () => {
  const html = render(<ProgressSteps done={2} total={3} />);
  expect(html).toContain('aria-label="2/3"');
  expect(html.match(/bg-green/g)).toHaveLength(2);
  expect(html.match(/bg-fg-3/g)).toHaveLength(1);
  expect(render(<ProgressSteps done={9} total={3} />)).toContain('aria-label="3/3"');
  expect(render(<ProgressSteps done={2} total={9} />)).not.toContain('h-1.5');
});

test('StatusChip tones and StatusList rows', () => {
  expect(render(<StatusChip tone="success">Verified</StatusChip>)).toContain('text-success');
  expect(render(<StatusChip tone="warning">Check</StatusChip>)).toContain('text-warning');
  expect(render(<StatusChip tone="danger">Blocked</StatusChip>)).toContain('text-red');
  const html = render(<StatusList items={[{ id: 'a', tone: 'success', text: 'Hash matches' }, { id: 'b', tone: 'warning', text: 'Old simulation', action: <button type="button">Re-run</button> }]} />);
  expect(html).toContain('Hash matches');
  expect(html).toContain('Re-run');
});

test('ClickMenu renders its trigger; BatchBar renders summary, primary and menu in a status region', () => {
  expect(render(<ClickMenu trigger={<button type="button">More</button>} items={[{ id: 'x', label: 'Clear' }]} />)).toContain('More');
  const html = render(<BatchBar summary="3 actions" primary={<button type="button">Review</button>} menu={<span>menu</span>} />);
  expect(html).toContain('role="status"');
  expect(html).toContain('3 actions');
  expect(html).toContain('Review');
  expect(html).toContain('menu');
});
