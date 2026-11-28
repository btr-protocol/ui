// Sankey layout: two columns (a source total and a sink total), ribbons weighted by value.
// Pure and exported so the geometry is testable without a browser; the component only paints.

export interface SankeySide {
  id: string;
  label: string;
  /** Palette role of the node bar (callers pass theme colours, never hex here). */
  color?: string;
}

export interface SankeyLink {
  id: string;
  from: string;
  to: string;
  /** Priced notional. null = unpriced: the link is counted in the table, not drawn as zero width. */
  value: number | null;
}

export interface SankeyNodeBox {
  id: string;
  label: string;
  color?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SankeyRibbon {
  id: string;
  from: string;
  to: string;
  value: number;
  /** Pixel thickness at the source end. */
  thickness: number;
  d: string;
}

export interface SankeyGeometry {
  left: SankeyNodeBox[];
  right: SankeyNodeBox[];
  ribbons: SankeyRibbon[];
  leftTotal: number;
  rightTotal: number;
  /** Pixels per USD, the one scale both columns share. */
  scale: number;
}

const sum = (m: Map<string, number>, id: string): number => m.get(id) ?? 0;

/**
 * Lay out two columns in `width` x `height`. The scale is shared by both columns: a swap puts the
 * same notional into one source leg and one sink leg, so the two totals agree in the data and the
 * bars stay comparable. Unpriced links are excluded from the scale (never a 0-width bar).
 */
export function sankeyLayout(
  left: readonly SankeySide[],
  right: readonly SankeySide[],
  links: readonly SankeyLink[],
  width: number,
  height: number,
  opts: { nodeWidth?: number; gap?: number; label?: number } = {},
): SankeyGeometry {
  const nodeWidth = opts.nodeWidth ?? 8;
  const gap = opts.gap ?? 8;
  const label = opts.label ?? 96;
  const priced = links.filter(
    (l): l is SankeyLink & { value: number } => l.value != null && Number.isFinite(l.value) && l.value > 0,
  );
  const lt = new Map<string, number>();
  const rt = new Map<string, number>();
  for (const l of priced) {
    lt.set(l.from, sum(lt, l.from) + l.value);
    rt.set(l.to, sum(rt, l.to) + l.value);
  }
  const leftTotal = [...lt.values()].reduce((a, b) => a + b, 0);
  const rightTotal = [...rt.values()].reduce((a, b) => a + b, 0);
  const usable = height - gap * Math.max(0, left.length - 1);
  const usableR = height - gap * Math.max(0, right.length - 1);
  const scale = Math.max(
    0,
    Math.min(
      leftTotal > 0 ? usable / leftTotal : 0,
      rightTotal > 0 ? usableR / rightTotal : 0,
    ),
  );
  const xL = label;
  const xR = width - label - nodeWidth;
  const place = (side: readonly SankeySide[], totals: Map<string, number>, x: number): SankeyNodeBox[] => {
    let y = 0;
    return side.map((n) => {
      const h = Math.max(1, sum(totals, n.id) * scale);
      const box = { ...n, x, y, width: nodeWidth, height: h };
      y += h + gap;
      return box;
    });
  };
  const lBoxes = place(left, lt, xL);
  const rBoxes = place(right, rt, xR);
  const byId = (boxes: SankeyNodeBox[]) => new Map(boxes.map((b) => [b.id, b]));
  const lb = byId(lBoxes);
  const rb = byId(rBoxes);
  // Running offsets keep sibling ribbons stacked in the same order at both ends.
  const lOff = new Map<string, number>();
  const rOff = new Map<string, number>();
  const ordered = [...priced].sort(
    (a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to),
  );
  const ribbons: SankeyRibbon[] = [];
  for (const l of ordered) {
    const s = lb.get(l.from);
    const t = rb.get(l.to);
    if (!s || !t) continue;
    const th = Math.max(1, l.value * scale);
    const y0 = s.y + (lOff.get(l.from) ?? 0);
    const y1 = t.y + (rOff.get(l.to) ?? 0);
    lOff.set(l.from, (lOff.get(l.from) ?? 0) + th);
    rOff.set(l.to, (rOff.get(l.to) ?? 0) + th);
    const mx = (s.x + s.width + t.x) / 2;
    ribbons.push({
      id: l.id,
      from: l.from,
      to: l.to,
      value: l.value,
      thickness: th,
      d: `M${s.x + s.width},${y0} C${mx},${y0} ${mx},${y1} ${t.x},${y1} L${t.x},${y1 + th} C${mx},${y1 + th} ${mx},${y0 + th} ${s.x + s.width},${y0 + th} Z`,
    });
  }
  return { left: lBoxes, right: rBoxes, ribbons, leftTotal, rightTotal, scale };
}
