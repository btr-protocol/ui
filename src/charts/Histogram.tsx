// Histogram: bars of a distribution, drawn at the panel's real pixel size (full width, full height), with an optional normal overlay scaled to the
// same bins, vertical markers whose labels never overprint, a log-count axis, and the end bins marked as overflow / underflow. SVG, tokens only.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { type Bins, normalPdf } from './seriesMath';

export interface HistogramMarker {
  x: number;
  label: string;
  /** red = a loss threshold; default muted. */
  tone?: 'red' | 'default';
}

export interface HistogramProps extends Bins {
  /** Tick / hover value text of an x position. */
  format: (x: number) => string;
  /** Normal curve fitted by the caller (mean, sd in x units): drawn over the bars, scaled to the bars' total area. */
  normal?: { mu: number; sigma: number };
  markers?: readonly HistogramMarker[];
  /** Count axis on log1p: a fat-tailed sample stays readable. */
  logCount?: boolean;
  /** The first / last bin hold everything beyond the plotted range: drawn lighter, with `<=` / `>=` in their tooltip. */
  edgeBins?: boolean;
  /** Accessible name. */
  label: string;
  height?: number;
  className?: string;
  emptyMessage?: string;
}

const LABEL_W = 74;
const ROW_H = 11;

/** Row (0..) of each marker label so that labels on the same row are at least LABEL_W px apart. */
export function labelRows(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const lastX: number[] = [];
  const rows = new Array<number>(xs.length).fill(0);
  for (const [x, i] of order) {
    let r = lastX.findIndex((lx) => x - lx >= LABEL_W);
    if (r < 0) r = lastX.length;
    lastX[r] = x;
    rows[i] = r;
  }
  return rows;
}

export function Histogram({ edges, counts, format, normal, markers = [], logCount = false, edgeBins = true, label, height = 240, className, emptyMessage = 'Not enough data' }: HistogramProps) {
  const host = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(200, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(200, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  const n = counts.length;
  const total = counts.reduce((a, b) => a + b, 0);
  if (n < 2 || !total) return <div className={cn('flex items-center justify-center py-8 text-sm text-fg-2', className)} style={{ minHeight: height }}>{emptyMessage}</div>;
  const lo = edges[0];
  const hi = edges[n];
  const bw = (hi - lo) / n;
  const padX = 6;
  const visible = markers.filter((m) => m.x >= lo && m.x <= hi);
  const top = 8 + ROW_H * Math.max(1, new Set(labelRows(visible.map((m) => (m.x - lo) / (hi - lo) * W))).size);
  const bottom = 20;
  const H = height;
  const sx = (x: number) => padX + ((x - lo) / (hi - lo)) * (W - 2 * padX);
  const yv = (c: number) => (logCount ? Math.log1p(c) : c);
  const pdfPeak = normal ? normalPdf(normal.mu, normal.mu, normal.sigma) * total * bw : 0;
  const max = Math.max(...counts.map(yv), yv(pdfPeak));
  const sy = (c: number) => H - bottom - (yv(c) / max) * (H - bottom - top);
  const curve = normal
    ? Array.from({ length: 161 }, (_, i) => {
        const x = lo + ((hi - lo) * i) / 160;
        return `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(normalPdf(x, normal.mu, normal.sigma) * total * bw).toFixed(1)}`;
      }).join('')
    : '';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo));
  const rows = labelRows(visible.map((m) => sx(m.x)));
  return (
    <div ref={host} className={cn('w-full', className)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block">
        {counts.map((c, i) => {
          const edge = edgeBins && (i === 0 || i === n - 1);
          return (
            <rect key={edges[i]} x={sx(edges[i]) + 0.5} y={sy(c)} width={Math.max(1, sx(edges[i + 1]) - sx(edges[i]) - 1)} height={Math.max(0, H - bottom - sy(c))} rx="1" fill="var(--series-2)" opacity={edge ? 0.4 : 0.8}>
              <title>{`${edge && i === 0 ? '<= ' : ''}${format(edges[i])} to ${format(edges[i + 1])}${edge && i === n - 1 ? ' and beyond' : ''}: ${c} (${((c / total) * 100).toFixed(1)}%)`}</title>
            </rect>
          );
        })}
        {curve && <path d={curve} fill="none" stroke="var(--fg-1)" strokeWidth="1.5" strokeDasharray="4 3" />}
        <line x1={padX} x2={W - padX} y1={H - bottom} y2={H - bottom} stroke="var(--border-color)" />
        {ticks.map((x, i) => (
          <text key={x} x={sx(x)} y={H - 5} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="fill-fg-2 font-numeric text-2xs">
            {format(x)}
          </text>
        ))}
        {visible.map((m, i) => {
          const x = sx(m.x);
          const flip = x > W - LABEL_W;
          return (
            <g key={m.label}>
              <line x1={x} x2={x} y1={top - 4 - (rows[i] ?? 0) * 0 } y2={H - bottom} stroke={m.tone === 'red' ? 'var(--red)' : 'var(--fg-2)'} strokeWidth="1" strokeDasharray="3 3" />
              <text x={flip ? x - 3 : x + 3} y={10 + (rows[i] ?? 0) * ROW_H} textAnchor={flip ? 'end' : 'start'} className={cn('font-numeric text-2xs', m.tone === 'red' ? 'fill-red' : 'fill-fg-1')}>
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
