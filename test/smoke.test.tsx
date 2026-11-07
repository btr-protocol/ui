import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import {
  BaseModal,
  Button,
  Footer,
  Header,
  PageState,
  Shell,
  TabBar,
  Table,
  WalletButton,
  cn,
} from '../src';

const items = [{ path: '/a', title: 'Alpha' }];

test('Button renders its variant classes', () => {
  const html = render(<Button variant="primary">Go</Button>);
  expect(html).toContain('bg-primary');
  expect(html).toContain('Go');
});

test('cn merges conflicting tailwind classes', () => {
  expect(cn('px-2', 'px-4')).toBe('px-4');
});

test('Shell mounts Header and Footer in the fixed-shell model', () => {
  const html = render(
    <Shell
      header={<Header items={items} activePath="/a" onNavigate={() => {}} brandLabel="Home" />}
      footer={<Footer legal={[{ title: 'Terms', href: '/terms' }]} />}
      tabBar={<TabBar tabs={items} activePath="/a" onNavigate={() => {}} />}
    >
      <PageState kind="empty" title="Nothing" />
    </Shell>,
  );
  expect(html).toContain('z-header');
  expect(html).toContain('z-footer');
  expect(html).toContain('max-w-6xl');
  expect(html).toContain('Alpha');
  expect(html).toContain('Terms');
  expect(html).toContain('Nothing');
});

test('BaseModal renders nothing while closed, Table and WalletButton render', () => {
  expect(render(<BaseModal isOpen={false} onClose={() => {}} title="T" headerType="title">x</BaseModal>)).not.toContain('>x<');
  expect(render(<WalletButton />)).toContain('Connect');
  const html = render(
    <Table
      columns={[{ key: 'a', label: 'A' }]}
      data={[{ a: 'row1' }]}
      rowKey={(r: { a: string }) => r.a}
    />,
  );
  expect(html).toContain('row1');
});
