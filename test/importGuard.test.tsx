// The app-set import guard: it cannot break a kit caller, and a failed chunk becomes a plain, reloadable failure.
import { afterEach, describe, expect, test } from 'bun:test';
import { ConnectModalHost, ImportFailure, configureImportGuard } from '../src';
import { getTDLC } from '../src/charts/tdlc';
import { guardedImport } from '../src/lib/importGuard';
import { act, mount, until, useDom } from './dom';

useDom();
afterEach(() => configureImportGuard((p) => p));
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

describe('ConnectModalHost', () => {
  test('a failed modal chunk shows the plain message with Reload and Close in place, never a dead button', async () => {
    configureImportGuard((p) => { p.catch(() => {}); return Promise.reject(new ImportFailure('A new version is available. Reload the page.', 'Reload')); });
    let closed = 0;
    const { host, unmount } = mount(<ConnectModalHost isOpen onClose={() => void closed++} />);
    await until(() => host.textContent?.includes('A new version is available') ?? false);
    expect(host.textContent).not.toContain('Failed to fetch');
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual(['Reload', 'Close']);
    act(() => (host.querySelectorAll('button')[1] as HTMLButtonElement).click());
    expect(closed).toBe(1);
    unmount();
  });
});
