// The app-set import guard: it cannot break a kit caller, and a failed chunk becomes a plain, reloadable failure.
import type { ComponentProps } from 'preact';
import { afterEach, describe, expect, test } from 'bun:test';
import { ConnectModalHost, ImportFailure, WalletButton, configureImportGuard, configureWalletConnect } from '../src';
import { MetricChart } from '../src/charts/MetricChart';
import { WALLET_MODAL_LABELS } from '../src';
import { WalletModal } from '../src/wallet/WalletModal';
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

describe('pairing path (mobile connect modal)', () => {
  afterEach(() => online(true));
  const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';
  const withPhone = async (f: () => Promise<void>) => {
    const old = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => PHONE });
    try { await f(); } finally { if (old) Object.defineProperty(navigator, 'userAgent', old); else delete (navigator as unknown as { userAgent?: string }).userAgent; }
  };
  const setup = () => configureWalletConnect({ projectId: 'public-id', metadata: { name: 'x', description: 'x', url: 'https://x', icons: [] }, chains: () => [143], loadSignClient: async () => ({ default: { init: async () => ({}) } }) });
  const reloads = () => [...document.body.querySelectorAll('button')].filter((b) => b.textContent === 'Reload');

  test('stale: one registered notice with Reload, no QR failure line, no dead "another device" button', async () => {
    await withPhone(async () => {
      setup();
      failWith(new ImportFailure('A new version is available. Reload the page.', 'Reload', 'stale'));
      const { unmount } = mount(<WalletModal isOpen onClose={() => {}} onConnect={async () => {}} />);
      await until(() => document.body.textContent?.includes('A new version is available') ?? false);
      expect(registered.length).toBe(1);
      expect(reloads().length).toBe(1);
      expect(document.body.textContent).not.toContain('Could not generate the QR code');
      expect(document.body.textContent).not.toContain(WALLET_MODAL_LABELS.anotherDeviceQr);
      expect(document.body.textContent).not.toContain('Failed to fetch');
      unmount();
      expect(registered.length).toBe(0);
    });
  });

  test('offline: the message, no Reload and no QR failure line; Reload when the connection returns', async () => {
    await withPhone(async () => {
      online(false);
      setup();
      failWith(new ImportFailure('You are offline. Reconnect and try again.', 'Reload', 'offline'));
      const { unmount } = mount(<WalletModal isOpen onClose={() => {}} onConnect={async () => {}} />);
      await until(() => document.body.textContent?.includes('You are offline') ?? false);
      expect(reloads().length).toBe(0);
      expect(document.body.textContent).not.toContain('Could not generate the QR code');
      online(true);
      act(() => void window.dispatchEvent(new Event('online')));
      await until(() => reloads().length === 1);
      unmount();
    });
  });
});

describe('MetricChart chunk failure', () => {
  afterEach(() => online(true));
  const sized = () => {
    const d = (k: string) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k);
    const keep = [d('clientWidth'), d('clientHeight')];
    for (const k of ['clientWidth', 'clientHeight']) Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => 200 });
    return () => ['clientWidth', 'clientHeight'].forEach((k, i) => keep[i] ? Object.defineProperty(HTMLElement.prototype, k, keep[i] as PropertyDescriptor) : delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k]);
  };
  const props = { series: [{ id: 'a', label: 'A', type: 'line' as const, points: [{ time: 1, value: 1 }, { time: 2, value: 2 }] }] } as unknown as ComponentProps<typeof MetricChart>;
  const panel = () => document.body.querySelector('[role=alert]');
  const reloadsIn = () => [...(registered[0]?.querySelectorAll('button') ?? [])].filter((b) => b.textContent === 'Reload');

  test('stale: the notice with Reload inside the panel, registered, no unhandled rejection', async () => {
    const restore = sized();
    const unhandled: unknown[] = [];
    const h = (e: unknown) => void unhandled.push(e);
    process.on('unhandledRejection', h);
    try {
      failWith(new ImportFailure('A new version is available. Reload the page.', 'Reload', 'stale'));
      const { unmount } = mount(<MetricChart {...props} />);
      await until(() => panel()?.textContent?.includes('A new version is available') ?? false);
      expect(reloadsIn().length).toBe(1);
      expect(registered.length).toBe(1);
      expect(document.body.textContent).not.toContain('No data in range');
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).toEqual([]);
      unmount();
      expect(registered.length).toBe(0);
    } finally { process.off('unhandledRejection', h); restore(); }
  });

  test('offline: the message without Reload; Reload when the connection returns', async () => {
    const restore = sized();
    try {
      online(false);
      failWith(new ImportFailure('You are offline. Reconnect and try again.', 'Reload', 'offline'));
      const { unmount } = mount(<MetricChart {...props} />);
      await until(() => panel()?.textContent?.includes('You are offline') ?? false);
      expect(reloadsIn().length).toBe(0);
      online(true);
      act(() => void window.dispatchEvent(new Event('online')));
      await until(() => reloadsIn().length === 1);
      unmount();
    } finally { restore(); }
  });
});

test('configureImportGuard texts override the kit literals', async () => {
  configureImportGuard((p) => p, { texts: { title: 'Portefeuille', message: 'Chargement impossible.', action: 'Recharger' } });
  await expect(guardedImport(() => Promise.resolve(undefined))).rejects.toMatchObject({ message: 'Chargement impossible.', actionLabel: 'Recharger' });
  const { unmount } = mount(<ConnectModalHost isOpen onClose={() => {}} />);
  unmount();
});
