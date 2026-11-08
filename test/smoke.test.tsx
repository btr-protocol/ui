import { expect, test } from 'bun:test';
import { render } from 'preact-render-to-string';
import {
  BaseModal,
  Button,
  Footer,
  Header,
  Notice,
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

import {
  ChainGlyph,
  ChainSelect,
  Field,
  MultiInput,
  PercentLadderSlider,
  SettingRow,
  Slider,
  chainIcon,
  chainSelectItems,
  fmtApr,
  formatAmountDisplay,
  formatBalance,
  formatCompact,
  fmtUsd,
  parseAmountInput,
} from '../src';

test('formatters: sdk core, metric dash, amount ladder', () => {
  expect(formatCompact(1234567)).toBe('1.23M');
  expect(fmtUsd(null)).toBe('-');
  expect(fmtApr(0.12)).toBe('12%');
  expect(formatBalance(0)).toBe('-');
  expect(parseAmountInput('1,2.3.4')).toBe('12.34');
  expect(formatAmountDisplay('1234567.5')).toBe('1,234,567.5');
});

test('chainIcon resolves id, slug and testnet; unknown is undefined', () => {
  expect(chainIcon(8453)).toContain('base.svg');
  expect(chainIcon('bnb-chain', { mono: true })).toContain('bnb-chain-mono.svg');
  expect(chainIcon(5042002)).toContain('arc.svg');
  expect(chainIcon(10)).toContain('optimism.svg');
  expect(chainIcon(999999)).toBeUndefined();
});

const chains = [
  { id: 1, name: 'Ethereum' },
  { id: 8453, name: 'Base' },
  { id: 5042, name: 'Arc', planned: true },
];

test('chain items hide planned unless asked', () => {
  expect(chainSelectItems(chains).map((i) => i.id)).toEqual(['1', '8453']);
  expect(chainSelectItems(chains, { includePlanned: true })[2]!.disabled).toBe(true);
});

test('ChainSelect trigger and ChainGlyph render', () => {
  expect(render(<ChainSelect chains={chains} value={8453} onChange={() => {}} />)).toContain('Base');
  expect(render(<ChainGlyph chainId={424242} />)).toContain('424');
});

test('form components render', () => {
  expect(render(<MultiInput value={['A']} onChange={() => {}} length={4} />)).toContain('Invite code');
  expect(render(<SettingRow label="Slippage" description="d">x</SettingRow>)).toContain('Slippage');
  expect(render(<Slider value={[5]} min={0} max={10} />)).toContain('slider');
  expect(render(<PercentLadderSlider stops={[1, 2, 5]} value={2} onChange={() => {}} />)).toContain('input');
  const f = render(<Field label="Name" htmlFor="n" error="Bad" hint="h" maxW="md"><input id="n" /></Field>);
  expect(f).toContain('text-red');
  expect(f).toContain('max-w-md');
  expect(f).not.toContain('>h<');
});

test('Notice action spec renders a tone-matched button, nodes pass through', () => {
  const spec = render(<Notice tone="error" label="Down" action={{ label: 'Retry', onClick: () => {} }}>detail</Notice>);
  expect(spec).toContain('class="notice-action"');
  expect(spec).toContain('Retry');
  expect(spec).toContain('--nt:var(--fg-error)');
  const node = render(<Notice tone="warning" action={<a href="/x">Open</a>}>x</Notice>);
  expect(node).toContain('<a href="/x">Open</a>');
  expect(node).not.toContain('notice-action');
  expect(render(<Notice tone="info">plain</Notice>)).not.toContain('<button');
});
