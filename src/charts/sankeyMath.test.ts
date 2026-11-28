import { describe, expect, test } from 'bun:test';
import { type SankeyLink, sankeyLayout } from './sankeyMath';

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
});
