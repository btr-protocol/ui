import { afterAll, expect, test } from 'bun:test';
import { configureHaptic, haptic } from '../src';

const calls: unknown[] = [];
const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (p: unknown) => (calls.push(p), true) }, configurable: true });

test('haptic: disabled by configureHaptic never vibrates; enabled does', () => {
  configureHaptic({ enabled: () => false });
  haptic('tap', 1_000_000);
  expect(calls.length).toBe(0);
  configureHaptic({ enabled: () => true });
  haptic('tap', 2_000_000);
  expect(calls).toEqual([8]);
});

afterAll(() => {
  if (original) Object.defineProperty(globalThis, 'navigator', original);
  else delete (globalThis as { navigator?: unknown }).navigator;
});
