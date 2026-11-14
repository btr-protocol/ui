// Doughnut: share-of-total ring with a legend table (swatch, label, value, share). SVG, colours are the --series-n tokens
// (`seriesCss`), so a theme switch repaints with no JS. Hovering a legend row or a slice lifts that slice; the centre reads it.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { type Slice, arcs, ringPath, seriesCss } from './heatmapMath';

export interface DoughnutProps {
  slices: readonly Slice[];
  /** Value text of a slice and of the total (default: the number as is). */
  format?: (v: number) => string;
  /** Centre caption at rest, under the total. */
  caption?: string;
  /** Accessible name. */
  label: string;
  /** Ring size in px (default 160). */
  size?: number;
  /** Legend shows at most this many rows; the rest folds into "Other" (default 12, the colour-distinct limit). */
  max?: number;
  /** Colours by slice id (e.g. keep a strategy's colour across charts); default by order. */
  colorOf?: (id: string, index: number) => string;
  emptyMessage?: string;
  footer?: ComponentChildren;
  className?: string;
}

const pctText = (s: number) => `${(s * 100).toFixed(s < 0.1 ? 1 : 0)}%`;

export function Doughnut({
  slices,
  format = (v) => String(Number(v.toPrecision(4))),
  caption = 'total',
  label,
  size = 160,
  max = 12,
  colorOf,
  emptyMessage = 'No data',
  footer,
  className,
}: DoughnutProps) {
  const [hot, setHot] = useState<string | null>(null);
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const folded =
    sorted.length > max
      ? [...sorted.slice(0, max - 1), { id: '\0other', label: 'Other', value: sorted.slice(max - 1).reduce((a, s) => a + s.value, 0) }]
      : sorted;
  const list = arcs(folded);
  const total = list.reduce((a, s) => a + s.value, 0);
  if (!list.length) return <div className={cn('py-8 text-center text-sm text-fg-2', className)}>{emptyMessage}</div>;
  const color = (id: string, i: number) => colorOf?.(id, i) ?? seriesCss(i);
  const R = 50;
  const r = 32;
  const cur = list.find((a) => a.id === hot);
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }} onPointerLeave={() => setHot(null)}>
      <svg viewBox="-54 -54 108 108" width={size} height={size} role="img" aria-label={label}>
        {list.map((a, i) => (
          <path
            key={a.id}
            d={ringPath(a.from, a.to, hot === a.id ? R + 2 : R, r)}
            fill={color(a.id, i)}
            stroke="var(--bg-1)"
            strokeWidth="0.8"
            opacity={hot && hot !== a.id ? 0.45 : 1}
            onPointerEnter={() => setHot(a.id)}
          >
            <title>{`${a.label}: ${format(a.value)} (${pctText(a.share)})`}</title>
          </path>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center" aria-hidden="true">
        <span className="font-numeric text-base font-semibold tabular-nums text-fg-0">{cur ? pctText(cur.share) : format(total)}</span>
        <span className="max-w-full truncate text-2xs text-fg-2">{cur ? cur.label : caption}</span>
      </div>
      </div>
      <ul className="m-0 min-w-0 flex-1 list-none space-y-0.5 p-0 text-xs" style={{ minWidth: '12rem' }}>
        {list.map((a, i) => (
          <li
            key={a.id}
            onPointerEnter={() => setHot(a.id)}
            onPointerLeave={() => setHot(null)}
            className={cn('flex items-center gap-2 rounded-sm px-1 py-0.5', hot === a.id && 'bg-bg-3')}
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: color(a.id, i) }} />
            <span className="min-w-0 flex-1 truncate text-fg-1" title={a.label}>
              {a.label}
            </span>
            <span className="font-numeric tabular-nums text-fg-2">{format(a.value)}</span>
            <span className="w-10 text-right font-numeric tabular-nums text-fg-0">{pctText(a.share)}</span>
          </li>
        ))}
        {footer}
      </ul>
    </div>
  );
}
