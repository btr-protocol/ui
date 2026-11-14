import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { Radar, score } from './Radar';

test('non-finite scores are missing data: drawn at the centre, n/a in the tooltip, no NaN in the points', () => {
  expect(score(Infinity)).toBeNull();
  expect(score(NaN)).toBeNull();
  expect(score(0.5)).toBe(0.5);
  const axes = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }];
  const h = render(<Radar label="r" axes={axes} series={[{ id: 's', label: 'S', values: { a: Infinity, b: NaN, c: 1 } }]} />);
  expect(h).not.toContain('NaN');
  expect(h).not.toContain('Infinity');
  expect(h).toContain('A n/a, B n/a, C 1.00');
});
