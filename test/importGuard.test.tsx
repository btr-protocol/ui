// The app-set import guard: it cannot break a kit caller, and a failed chunk becomes a plain, reloadable failure.
import { afterEach, describe, expect, test } from 'bun:test';
import { ConnectModalHost, ImportFailure, WalletButton, configureImportGuard } from '../src';
import { getTDLC } from '../src/charts/tdlc';
import { guardedImport } from '../src/lib/importGuard';
import { act, mount, until, useDom } from './dom';

useDom();
afterEach(() => configureImportGuard((p) => p));
const online = (on: boolean) => Object.defineProperty(navigator, 'onLine', { value: on, configurable: true });
const failWith = (f: ImportFailure) => configureImportGuard((p) => { p.catch(() => {}); return Promise.reject(f); }, { registerNotice: (el) => { registered.push(el); return () => void registered.splice(registered.indexOf(el), 1); } });
const registered: HTMLElement[] = [];
const RAW = 'Failed to fetch dynamically imported module: https://x/assets/walletConnect-AAA.js';

describe('guardedImport', () => {
  test('unset: the raw promise; configured: every import goes through the guard', async () => {
    await expect(guardedImport(() => Promise.reject(new TypeError(RAW)))).rejects.toThrow('Failed to fetch');
    configureImportGuard((p) => p.catch(() => Promise.reject(new ImportFailure('plain'))));
    await expect(guardedImport(() => Promise.reject(new TypeError(RAW)))).rejects.toThrow('plain');
    expect(await guardedImport(() => Promise.resolve(3))).toBe(3);
  });
  test('a guard that throws, returns nothing or resolves to nothing becomes a rejected ImportFailure', async () => {
    configureImportGuard((() => { throw new Error('boom'); }) as never);
    await expect(guardedImport(() => Promise.resolve(1))).rejects.toThrow('boom');
    configureImportGuard((() => undefined) as never);
    await expect(guardedImport(() => Promise.resolve(1))).rejects.toBeInstanceOf(ImportFailure);
    configureImportGuard((() => Promise.resolve(undefined)) as never);
    await expect(guardedImport(() => Promise.resolve(1))).rejects.toBeInstanceOf(ImportFailure);
  });
  test('a real call site (charts getTDLC) rejects instead of resolving undefined', async () => {
    configureImportGuard((() => Promise.resolve(undefined)) as never);
    await expect(getTDLC()).rejects.toBeInstanceOf(ImportFailure);
  });
});

test('a non-Error rejection of a guard is normalised to an ImportFailure', async () => {
  configureImportGuard((() => Promise.reject('string reason')) as never);
  await expect(guardedImport(() => Promise.resolve(1))).rejects.toBeInstanceOf(ImportFailure);
});

describe('failure fallbacks', () => {
  afterEach(() => online(true));
  const labels = (_host?: Element) => [...(registered[0]?.querySelectorAll('button') ?? [])].map((b) => b.textContent);

  test('ConnectModalHost: the plain message in a modal body with Reload, registered as a visible notice', async () => {
    failWith(new ImportFailure('A new version is available. Reload the page.', 'Reload', 'stale'));
    const { host, unmount } = mount(<ConnectModalHost isOpen onClose={() => {}} />);
    await until(() => document.body.textContent?.includes('A new version is available') ?? false);
    expect(document.body.textContent).not.toContain('Failed to fetch');
    expect(labels(host)).toEqual(['Reload']);
    expect(registered.length).toBe(1);
    expect(document.querySelector('[role=dialog]')?.contains(registered[0])).toBe(true);
    unmount();
    expect(registered.length).toBe(0);
  });

  test('offline: no Reload while offline, it appears when the connection returns', async () => {
    online(false);
    failWith(new ImportFailure('You are offline. Reconnect and try again.', 'Reload', 'offline'));
    const { host, unmount } = mount(<ConnectModalHost isOpen onClose={() => {}} />);
    await until(() => document.body.textContent?.includes('You are offline') ?? false);
    expect(labels(host)).toEqual([]);
    online(true);
    act(() => void window.dispatchEvent(new Event('online')));
    await until(() => labels(host).length === 1);
    expect(labels(host)).toEqual(['Reload']);
    unmount();
  });

  test('WalletButton: a failed account modal chunk shows the same fallback, not a dead chip', async () => {
    const addr = '0xaB7B000000000000000000000000000000000760';
    failWith(new ImportFailure('A new version is available. Reload the page.', 'Reload', 'stale'));
    const { host, unmount } = mount(<WalletButton address={addr} activeAddress={addr} chainId={1} accounts={[addr]} />);
    act(() => (host.querySelector('button') as HTMLButtonElement).click());
    await until(() => document.body.textContent?.includes('A new version is available') ?? false);
    expect(labels(host)).toEqual(['Reload']);
    expect(registered.length).toBe(1);
    unmount();
  });
});
