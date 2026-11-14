import { describe, expect, test } from 'bun:test';
import { assertSiweMessage } from '../src/wallet/wallet';

const ADDR = '0x1111111111111111111111111111111111111111';
const opt = { domain: 'prime.example', statement: '\nSign in to BTR Prime Research.\n', uri: 'https://prime.example', chainId: 143 };
const good = [
  'prime.example wants you to sign in with your Ethereum account:', ADDR, '', 'Sign in to BTR Prime Research.', '',
  'URI: https://prime.example', 'Version: 1', 'Chain ID: 143', `Nonce: ${'a'.repeat(48)}`, 'Issued At: 2026-11-12T10:00:00Z', 'Expiration Time: 2026-11-12T10:05:00Z',
];
const run = (lines: string[], o = opt) => () => assertSiweMessage(lines.join('\n'), ADDR, o);
const swap = (i: number, v: string) => good.map((l, k) => (k === i ? v : l));

describe('assertSiweMessage', () => {
  test('accepts the exact message, with or without expiry, case-insensitive address', () => {
    expect(run(good)).not.toThrow();
    expect(run(good.slice(0, 10))).not.toThrow();
    expect(() => assertSiweMessage(good.join('\n'), ADDR.toUpperCase().replace('0X', '0x'), opt)).not.toThrow();
  });
  test('refuses foreign domain, address, URI, statement, version, chain, nonce, times', () => {
    for (const [i, v] of [[0, 'evil.example wants you to sign in with your Ethereum account:'], [1, '0x2222222222222222222222222222222222222222'], [5, 'URI: https://evil.example'],
      [3, 'Sign in to BTR Safe.'], [6, 'Version: 2'], [7, 'Chain ID: 1'], [8, 'Nonce: short'], [9, 'Issued At: yesterday'], [10, 'Expiration Time: never']] as const)
      expect(run(swap(i, v))).toThrow(/Refused to sign/);
  });
  test('a statement merely contained in a longer one is refused (no includes())', () => {
    expect(run(swap(3, 'Sign in to BTR Prime Research. Also transfer everything.'))).toThrow(/statement/);
  });
  test('extra, missing, reordered or unknown lines are refused', () => {
    expect(run([...good, 'Resources:'])).toThrow(/shape/);
    expect(run(good.slice(0, 9))).toThrow(/shape/);
    expect(run([...good.slice(0, 5), 'Version: 1', 'URI: https://prime.example', ...good.slice(7)])).toThrow(/Refused/);
    expect(run(swap(2, 'Request-ID: 1'))).toThrow(/shape/);
  });
  test('chain id is checked only when pinned, but must always be well formed', () => {
    expect(run(swap(7, 'Chain ID: 1'), { ...opt, chainId: undefined as unknown as number })).not.toThrow();
    expect(run(swap(7, 'Chain ID: 0x8f'), { ...opt, chainId: undefined as unknown as number })).toThrow(/chain/);
  });
});
