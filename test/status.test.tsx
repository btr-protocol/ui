import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { BatchBar, ClickMenu, ProgressSteps, StatusChip, StatusList } from '../src';

test('ProgressSteps: a readable bar, filled segments, a shimmer per missing signature, clamping, one track beyond 12', () => {
  const html = render(<ProgressSteps done={2} total={3} />);
  expect(html).toContain('aria-label="2/3"');
  expect(html).toContain('h-2 w-24'); // one readable size, rows and cards alike
  expect(html.match(/bg-green/g)).toHaveLength(2);
  expect(html.match(/progress-pending/g)).toHaveLength(1);
  expect(html).toContain('text-sm');
  expect(render(<ProgressSteps done={9} total={3} />)).toContain('aria-label="3/3"');
  expect(render(<ProgressSteps done={3} total={3} />)).not.toContain('progress-pending');
  const many = render(<ProgressSteps done={2} total={20} />);
  expect(many.match(/progress-pending/g)).toHaveLength(1);
  expect(many).toContain('width:10%');
});

test('the missing-step shimmer is an infinite sweep over the 3:1 control line', async () => {
  const css = await Bun.file('src/styles/index.css').text();
  const rule = css.slice(css.indexOf('.progress-pending {'), css.indexOf('@keyframes progress-sweep'));
  expect(rule).toContain('var(--line-ui)');
  expect(rule).toContain('infinite');
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

test('SelectModal shows the current label on its trigger; KeyValueTable is one bordered block; every Table wears the frame', async () => {
  const { SelectModal, KeyValueTable, Table } = await import('../src');
  const html = render(<SelectModal routeKey="t" label="Safe" value="b" onChange={() => {}} items={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} />);
  expect(html).toContain('Beta');
  expect(html).toContain('aria-haspopup="dialog"');
  const kv = render(<KeyValueTable sections={[{ id: 'h', rows: [{ key: 'a', label: 'Nonce', value: '3' }] }, { id: 'c', title: 'Calls', children: <div>x</div> }]} />);
  expect(kv).toContain('rounded-lg border border-border');
  expect(kv).toContain('Nonce');
  expect(kv).toContain('Calls');
  const compact = render(<Table variant="compact" searchable={false} rowKey={(r: { a: number }) => String(r.a)} data={[{ a: 1 }]} columns={[{ key: 'a', label: 'A' }]} />);
  expect(compact).toContain('border');
});
