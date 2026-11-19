import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { Panel, Table } from '../src';

const t = (props: { frame?: boolean } = {}) => (
  <Table columns={[{ key: 'a', label: 'A' }]} data={[{ a: 1 }]} rowKey={(r) => String(r.a)} {...props} />
);
const FLUSH = 'rounded-none border-0 bg-transparent shadow-none';
// The frame Panel the table wears, i.e. the first `surface` div.
const tableFrames = (html: string) => (html.match(/class="[^"]*surface[^"]*"/g) ?? []).length;

test('a standalone table wears its own frame', () => {
  expect(render(t())).not.toContain(FLUSH);
});

test('inside a framed Panel the table goes flush: one border, no inner radius', () => {
  const html = render(<Panel>{t()}</Panel>);
  expect(html).toContain(FLUSH);
  expect(tableFrames(html)).toBe(2); // the container + the flush table, which draws nothing
});

test('a plain Panel draws no frame, so the table keeps its own', () => {
  expect(render(<Panel variant="plain">{t()}</Panel>)).not.toContain(FLUSH);
});

test('an explicit frame wins either way', () => {
  expect(render(<Panel>{t({ frame: true })}</Panel>)).not.toContain(FLUSH);
  expect(render(t({ frame: false }))).toContain(FLUSH);
});
