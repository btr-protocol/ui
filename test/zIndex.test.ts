import { expect, test } from 'bun:test';
import { Z, Z_LAYERS } from '../src/lib/zIndex';
// @ts-expect-error plain JS preset, no types
import preset from '../src/styles/tailwind.preset.js';

const tokens = await Bun.file('src/styles/tokens.css').text();

test('z scale: unique values, strictly ascending in declaration order', () => {
  const v = Z_LAYERS.map((k) => Z[k]);
  expect(new Set(v).size).toBe(v.length);
  expect([...v].sort((a, b) => a - b)).toEqual(v);
});

test('z scale: tokens.css, the Tailwind preset and Z agree', () => {
  const zi = (preset as { theme: { extend: { zIndex: Record<string, string> } } }).theme.extend.zIndex;
  expect(Object.keys(zi)).toEqual([...Z_LAYERS]);
  for (const k of Z_LAYERS) {
    expect(zi[k]).toBe(`var(--z-index-${k})`);
    expect(new RegExp(`--z-index-${k}:\\s*${Z[k]};`).test(tokens)).toBe(true);
  }
  expect(tokens.match(/--z-index-[a-z]+:/g)?.length).toBe(Z_LAYERS.length);
});

test('kit src has no z-index literal', async () => {
  const bad: string[] = [];
  for (const f of new Bun.Glob('src/**/*.{ts,tsx,css,js}').scanSync('.')) {
    if (f.endsWith('zIndex.ts')) continue;
    const t = await Bun.file(f).text();
    t.split('\n').forEach((l, i) => {
      if (/\bz-\[|\bz-\d|zIndex:\s*\d|z-index:\s*\d/.test(l)) bad.push(`${f}:${i + 1}`);
    });
  }
  expect(bad).toEqual([]);
});
