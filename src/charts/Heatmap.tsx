// Heatmap: a labelled grid of tinted cells (correlation matrix, year x month returns). HTML grid, not canvas, so text stays crisp and
// the cells inherit the theme tokens (--green / --red / --orange mixed into --bg-1). `diverging` centres the scale on 0.
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { type HeatDomain, heatDomain, heatFill, heatTone } from './heatmapMath';

export interface HeatmapProps {
  rows: readonly string[];
  cols: readonly string[];
  /** values[r][c]; null / NaN = no data (empty cell). */
  values: readonly (readonly (number | null | undefined)[])[];
  /** Cell text; default none (colour only). */
  format?: (v: number) => string;
  /** Centre the colour scale on 0 (correlation, returns). Default true. */
  diverging?: boolean;
  /** Fixed scale; default the data range. */
  domain?: HeatDomain;
  /** Accessible name of the grid. */
  label: string;
  /** Hover / focus readout line under the grid, e.g. (r, c, v) => "A x B: 0.42". */
  describe?: (row: string, col: string, v: number) => string;
  /** Cell edge in rem (default 2). Text shows only when it fits. */
  cell?: number;
  /** Width of the row-label column in rem (default 9). */
  labelWidth?: number;
  /** Rotate column labels (many columns). */
  slantCols?: boolean;
  /** Content after the grid (legend, note). */
  footer?: ComponentChildren;
  className?: string;
}

/** Arrow / Home / End move over the grid (clamped); anything else returns null. */
export function moveCell(key: string, r: number, c: number, nr: number, nc: number): [number, number] | null {
  const k = Math.max(0, nr - 1);
  const m = Math.max(0, nc - 1);
  switch (key) {
    case 'ArrowUp': return [Math.max(0, r - 1), c];
    case 'ArrowDown': return [Math.min(k, r + 1), c];
    case 'ArrowLeft': return [r, Math.max(0, c - 1)];
    case 'ArrowRight': return [r, Math.min(m, c + 1)];
    case 'Home': return [r, 0];
    case 'End': return [r, m];
    default: return null;
  }
}

export function Heatmap({
  rows,
  cols,
  values,
  format,
  diverging = true,
  domain,
  label,
  describe,
  cell = 2,
  labelWidth = 9,
  slantCols = false,
  footer,
  className,
}: HeatmapProps) {
  const d = domain ?? heatDomain(values, diverging);
  const [hot, setHot] = useState<{ r: number; c: number } | null>(null);
  // Roving tabindex: the grid is ONE tab stop (the active cell); arrows move inside it.
  const [active, setActive] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const grid = useRef<HTMLDivElement>(null);
  const ar = Math.min(active.r, Math.max(0, rows.length - 1));
  const ac = Math.min(active.c, Math.max(0, cols.length - 1));
  const hv = hot ? values[hot.r]?.[hot.c] : null;
  const readout =
    hot && hv != null && Number.isFinite(hv)
      ? (describe?.(rows[hot.r], cols[hot.c], hv) ?? `${rows[hot.r]} / ${cols[hot.c]}: ${format ? format(hv) : hv}`)
      : '';
  return (
    <div className={cn('min-w-0', className)}>
      <div className="overflow-x-auto">
        <div
          ref={grid}
          role="grid"
          aria-label={label}
          className="grid w-max gap-px text-2xs"
          style={{ gridTemplateColumns: `${labelWidth}rem repeat(${cols.length}, ${cell}rem)` }}
          onPointerLeave={() => setHot(null)}
          onKeyDown={(e) => {
            const to = moveCell(e.key, ar, ac, rows.length, cols.length);
            if (!to) return;
            e.preventDefault();
            setActive({ r: to[0], c: to[1] });
            grid.current?.querySelector<HTMLElement>(`[data-cell="${to[0]}-${to[1]}"]`)?.focus();
          }}
        >
          <div role="row" className="contents">
            <span role="columnheader" aria-hidden="true" />
            {cols.map((c) => (
              <span
                key={c}
                role="columnheader"
                title={c}
                className={cn('flex items-end justify-center pb-1 text-fg-2', slantCols ? 'h-24' : 'h-6')}
              >
                {slantCols ? (
                  <span className="origin-bottom-left -rotate-45 whitespace-nowrap" style={{ width: 0 }}>
                    {c}
                  </span>
                ) : (
                  c
                )}
              </span>
            ))}
          </div>
          {rows.map((r, ri) => (
            <div key={r} role="row" className="contents">
              <span role="rowheader" title={r} className="flex items-center truncate pr-2 text-fg-1" style={{ height: `${cell}rem` }}>
                <span className="truncate">{r}</span>
              </span>
              {cols.map((c, ci) => {
                const v = values[ri]?.[ci];
                const t = heatTone(v, d, diverging);
                const on = hot?.r === ri && hot?.c === ci;
                return (
                  <span
                    key={c}
                    role="gridcell"
                    data-cell={`${ri}-${ci}`}
                    tabIndex={ri === ar && ci === ac ? 0 : -1}
                    aria-label={t && v != null ? `${r}, ${c}: ${format ? format(v) : v}` : `${r}, ${c}: no data`}
                    title={t && v != null ? `${r} / ${c}: ${format ? format(v) : v}` : undefined}
                    onPointerEnter={() => t && setHot({ r: ri, c: ci })}
                    onFocus={() => {
                      setActive({ r: ri, c: ci });
                      if (t) setHot({ r: ri, c: ci });
                    }}
                    className={cn(
                      'flex items-center justify-center rounded-[2px] font-numeric tabular-nums text-fg-0 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      !t && 'bg-bg-2',
                      on && 'ring-1 ring-fg-1',
                    )}
                    style={{ height: `${cell}rem`, background: heatFill(t) }}
                  >
                    {t && v != null && format && cell >= 2 ? format(v) : ''}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex min-h-[1.25rem] flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-2" aria-live="off">
        <span className="font-numeric tabular-nums text-fg-1">{readout}</span>
        {footer}
      </div>
    </div>
  );
}
