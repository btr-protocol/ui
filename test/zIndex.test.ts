import { expect, test } from 'bun:test';
import { Z, Z_LAYERS } from '../src/lib/zIndex';
// @ts-expect-error plain JS preset, no types
import preset, { zIndexScale, zIndexTheme } from '../src/styles/tailwind.preset.js';

const tokens = await Bun.file('src/styles/tokens.css').text();

test('z scale: unique values, strictly ascending in declaration order', () => {
  const v = Z_LAYERS.map((k) => Z[k]);
  expect(new Set(v).size).toBe(v.length);
  expect([...v].sort((a, b) => a - b)).toEqual(v);
});

test('preset exports the scale for consumer configs; numbers equal Z', () => {
  expect(Object.keys(zIndexScale)).toEqual([...Z_LAYERS]);
  for (const k of Z_LAYERS) expect(zIndexScale[k]).toBe(String(Z[k]));
  expect(zIndexTheme).toEqual((preset as any).theme.extend.zIndex);
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
      if (/\bz-\[|\bz-\d|z-index['"]?\s*:\s*['"]?\d|zIndex['"]?\s*:\s*['"]?\d/.test(l)) bad.push(`${f}:${i + 1}`);
    });
  }
  expect(bad).toEqual([]);
});

test('every z-<name> class in src is a layer of the scale (typos fail)', async () => {
  const known = new Set<string>(Z_LAYERS);
  const bad: string[] = [];
  for (const f of new Bun.Glob('src/**/*.{ts,tsx}').scanSync('.')) {
    // Comments mention "z-scale" / "z-index" in prose; only code is checked.
    const t = (await Bun.file(f).text()).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    for (const m of t.matchAll(/(?<![\w-])(?:[a-z-]+:)*-?z-([a-z][a-z-]*)(?![\w-])/g)) {
      if (!known.has(m[1]!)) bad.push(`${f}: ${m[0]}`);
    }
  }
  expect(bad).toEqual([]);
});
