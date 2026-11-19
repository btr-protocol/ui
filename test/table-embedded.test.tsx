import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import { InFrame, Panel, Table } from '../src';

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

test('nested framed Panels: the Table goes flush once, no extra frame', () => {
  const html = render(<Panel><Panel>{t()}</Panel></Panel>);
  expect(html).toContain(FLUSH);
  expect(tableFrames(html)).toBe(3);
});

test('the InFrame reset (portals, modals) gives the table its frame back', () => {
  // Portal + BaseModal render through createPortal into document.body (no DOM here): the reset they
  // wrap their children in is the same provider, asserted directly.
  const html = render(<Panel><InFrame.Provider value={false}>{t()}</InFrame.Provider></Panel>);
  expect(html).not.toContain(FLUSH);
});

test('Portal and BaseModal wrap their children in the InFrame reset', async () => {
  for (const f of ['Portal.tsx', 'BaseModal.tsx']) {
    const src = await Bun.file(new URL(`../src/ui/${f}`, import.meta.url)).text();
    expect(src).toContain('<InFrame.Provider value={false}>');
  }
});
