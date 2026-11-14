import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { ChartPanel } from './ChartPanel';

const order = (side: 'left' | 'right') => {
  const html = render(
    <ChartPanel title="T" table={<i>TABLE</i>} tableSide={side}>
      <b>CHART</b>
    </ChartPanel>,
  );
  return [html.indexOf('CHART'), html.indexOf('TABLE')];
};

test('ChartPanel DOM order follows the side: chart first when the table is on the right', () => {
  const [c, t] = order('right');
  expect(c).toBeGreaterThan(-1);
  expect(c).toBeLessThan(t);
  const [cl, tl] = order('left');
  expect(tl).toBeLessThan(cl);
});
