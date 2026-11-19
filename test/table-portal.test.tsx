import { expect, test } from 'bun:test';
import { BaseModal, Panel, Portal, Table } from '../src';
import { mount, until, useDom } from './dom';

useDom();

const FLUSH = 'rounded-none border-0 bg-transparent shadow-none';
const t = <Table columns={[{ key: 'a', label: 'A' }]} data={[{ a: 1 }]} rowKey={(r) => String(r.a)} />;
// The table's frame Panel: the `surface` box around the <table>.
const tableFrame = () => document.querySelector('table')?.closest('.surface') as HTMLElement | null;

test('a Table portaled out of a framed Panel keeps its own frame', async () => {
  const m = mount(
    <Panel>
      <Portal>{t}</Portal>
    </Panel>,
  );
  await until(() => !!document.querySelector('table'));
  expect(m.host.contains(document.querySelector('table'))).toBe(false); // really portaled
  expect(tableFrame()?.className).not.toContain(FLUSH);
  m.unmount();
});

test('a Table in a BaseModal opened from a framed Panel keeps its own frame', async () => {
  const m = mount(
    <Panel>
      <BaseModal isOpen onClose={() => {}} title="T" headerType="title">
        {t}
      </BaseModal>
    </Panel>,
  );
  await until(() => !!document.querySelector('table'));
  expect(m.host.contains(document.querySelector('table'))).toBe(false);
  expect(tableFrame()?.className).not.toContain(FLUSH);
  m.unmount();
});

test('control: the same Table inline in the Panel goes flush', async () => {
  const m = mount(<Panel>{t}</Panel>);
  expect(tableFrame()?.className).toContain(FLUSH);
  m.unmount();
});
