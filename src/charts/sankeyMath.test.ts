import { describe, expect, test } from 'bun:test';
import { type SankeyLink, placeLabels, sankeyLayout } from './sankeyMath';

const L = [
  { id: 'USDC', label: 'USDC' },
  { id: 'WETH', label: 'WETH' },
];
const R = [
  { id: 'WETH', label: 'WETH' },
  { id: 'USDC', label: 'USDC' },
];
const link = (from: string, to: string, value: number | null): SankeyLink => ({
  id: `${from}>${to}`,
  from,
  to,
  value,
});

describe('sankeyLayout', () => {
  test('one shared scale: equal totals fill the same column height', () => {
    const g = sankeyLayout(L, R, [link('USDC', 'WETH', 60), link('WETH', 'USDC', 40)], 600, 300, {
      gap: 0,
      label: 80,
    });
    const h = (boxes: { height: number }[]) => boxes.reduce((s, b) => s + b.height, 0);
    expect(Math.round(h(g.left))).toBe(Math.round(h(g.right)));
    expect(g.leftTotal).toBe(100);
  });

  test('an unpriced link is not drawn and does not shrink the priced ribbons', () => {
    const priced = sankeyLayout(L, R, [link('USDC', 'WETH', 100)], 600, 300);
    const mixed = sankeyLayout(L, R, [link('USDC', 'WETH', 100), link('WETH', 'USDC', null)], 600, 300);
    expect(mixed.ribbons).toHaveLength(1);
    expect(mixed.ribbons[0]!.thickness).toBeCloseTo(priced.ribbons[0]!.thickness, 6);
  });

  test('ribbons stack inside a node and never exceed it', () => {
    const g = sankeyLayout(
      L,
      R,
      [link('USDC', 'WETH', 30), link('USDC', 'USDC', 30), link('WETH', 'USDC', 40)],
      600,
      300,
    );
    const usdc = g.left.find((n) => n.id === 'USDC')!;
    const out = g.ribbons.filter((r) => r.from === 'USDC');
    expect(out.reduce((s, r) => s + r.thickness, 0)).toBeCloseTo(usdc.height, 6);
  });

  test('a tail of hairline nodes still fits the plot, and its labels never share a line', () => {
    const left = [
      { id: 'A', label: 'A' },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, label: `T${i}` })),
    ];
    const right = [{ id: 'B', label: 'B' }];
    const links = [
      link('A', 'B', 1000),
      ...Array.from({ length: 10 }, (_, i) => link(`t${i}`, 'B', 1e-6)),
    ];
    const height = 200;
    const g = sankeyLayout(left, right, links, 600, height);
    expect(g.ribbons.length).toBeGreaterThan(0);
    const bottom = Math.max(...g.left.map((n) => n.y + n.height));
    expect(bottom).toBeLessThanOrEqual(height + 1e-6);
    const labels = placeLabels(g.left, height, 'left');
    const ys = labels.map((l) => l.y);
    expect(new Set(ys).size).toBe(ys.length);
    for (const l of labels) expect(l.y).toBeLessThanOrEqual(height);
    // The label sits at the bar's left edge; the component adds its own 6px gutter.
    expect(labels[0]!.x).toBe(g.left[0]!.x);
  });

  test('degenerate width or height draws nothing rather than inverted geometry', () => {
    const flat = sankeyLayout(L, R, [link('USDC', 'WETH', 10)], 10, 300);
    expect(flat.ribbons).toEqual([]);
    expect(sankeyLayout(L, R, [link('USDC', 'WETH', 10)], 600, 0).ribbons).toEqual([]);
  });
});
