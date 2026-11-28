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

/** A plot that cannot hold its own labels and bars: draw nothing rather than inside-out geometry. */
const EMPTY: SankeyGeometry = { left: [], right: [], ribbons: [], leftTotal: 0, rightTotal: 0, scale: 0 };

const sum = (m: Map<string, number>, id: string): number => m.get(id) ?? 0;
const MIN_BAR = 1;

/**
 * Lay out two columns in `width` x `height`. The scale is shared by both columns: a swap puts the
 * same notional into one source leg and one sink leg, so the two totals agree in the data and the
 * bars stay comparable. Unpriced links are excluded (never a 0-width bar).
 *
 * Every bar is at least 1 px, so the scale is solved against the FLOORED pixel heights rather than
 * against the dollars alone: the rail the floors produce is what has to fit, and a sub-pixel tail
 * of many tiny nodes must not push the last node into the caption.
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
  // Labels own a gutter on each side, never more than half the plot and never less than zero.
  const label = Math.max(0, Math.min(opts.label ?? 96, (width - nodeWidth) / 2));
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
  if (!(width > 0) || !(height > 0) || left.length === 0 || right.length === 0) return EMPTY;

  // Bar height from the node's own priced total, floored at a hairline; its ribbons stack by the
  // same values, so they always fit inside it (a sub-pixel ribbon is drawn thin, not widened).
  const heightsOf = (side: readonly SankeySide[], totals: Map<string, number>, s: number): Map<string, number> => {
    const h = new Map<string, number>();
    for (const n of side) h.set(n.id, Math.max(MIN_BAR, sum(totals, n.id) * s));
    return h;
  };
  const railHeight = (side: readonly SankeySide[], h: Map<string, number>) =>
    [...h.values()].reduce((a, b) => a + b, 0) + gap * Math.max(0, side.length - 1);
  const fits = (s: number) =>
    railHeight(left, heightsOf(left, lt, s)) <= height &&
    railHeight(right, heightsOf(right, rt, s)) <= height;
  // The floors alone can exceed a short plot: then there is no scale that fits, and nothing is
  // drawn (the caller's table still carries every figure).
  if (!fits(0)) return EMPTY;
  // Largest scale whose floored rails still fit; monotone in s, so bisect.
  let lo = 0;
  let hi = Math.min(
    leftTotal > 0 ? height / leftTotal : 0,
    rightTotal > 0 ? height / rightTotal : 0,
  );
  if (hi <= 0) return EMPTY;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const scale = lo;
  const lHeights = heightsOf(left, lt, scale);
  const rHeights = heightsOf(right, rt, scale);
  const xL = label;
  const xR = width - label - nodeWidth;
  if (!(xR > xL)) return EMPTY;
  const place = (side: readonly SankeySide[], h: Map<string, number>, x: number): SankeyNodeBox[] => {
    let y = 0;
    return side.map((n) => {
      const box = { ...n, x, y, width: nodeWidth, height: h.get(n.id) ?? MIN_BAR };
      y += box.height + gap;
      return box;
    });
  };
  const lBoxes = place(left, lHeights, xL);
  const rBoxes = place(right, rHeights, xR);
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
    const th = l.value * scale;
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

export interface SankeyLabel {
  id: string;
  label: string;
  /** The text anchor: the bar's inner edge (the component adds its own gutter). */
  x: number;
  y: number;
}

const LABEL_LINE = 11;

/**
 * One line per label, never two on top of each other: the tail of a rail is a run of 1 px nodes,
 * so each label sits on its own node where it can and slides down to the next free line where it
 * cannot. A label that would leave the plot is dropped, not clipped.
 */
export function placeLabels(
  nodes: readonly SankeyNodeBox[],
  height: number,
  rail: 'left' | 'right',
): SankeyLabel[] {
  const out: SankeyLabel[] = [];
  let floor = -Infinity;
  for (const n of nodes) {
    const want = n.y + Math.min(n.height, LABEL_LINE) / 2;
    const y = Math.max(want, floor + LABEL_LINE);
    if (y > height - LABEL_LINE / 2) continue;
    floor = y;
    // The left rail's text ends at the bar's left edge; the right rail's starts at its right one.
    out.push({ id: n.id, label: n.label, x: rail === 'left' ? n.x : n.x + n.width, y });
  }
  return out;
}
