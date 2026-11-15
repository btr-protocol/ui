import { expect, test } from 'bun:test';
import { configureImportGuard, guardedImport } from '../src/lib/importGuard';

test('unset: the raw promise; configured: every kit import goes through the guard', async () => {
  await expect(guardedImport(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: x')))).rejects.toThrow('Failed to fetch');
  configureImportGuard((p) => p.catch(() => Promise.reject(new Error('A new version is available. Reload the page.'))));
  await expect(guardedImport(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: x')))).rejects.toThrow('A new version is available');
  expect(await guardedImport(() => Promise.resolve(3))).toBe(3);
  configureImportGuard((p) => p);
});
