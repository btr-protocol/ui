// ChartStack: time-series panes stacked in ONE frame on a shared x axis, the layout of the front's metrics page. Every pane is a MetricChart with
// the hover legend (series label + value at the crosshair), zoom / pan and the crosshair are linked across panes (one sync group), only the bottom
// pane draws the time axis, and the header reads the hovered timestamp. `table` is a left slot (series selector / legend) like ChartPanel.
import type { ComponentChildren } from 'preact';
import { useId, useMemo, useRef } from 'preact/hooks';
import { cn } from '../lib/cn';
import { MetricChart, type MetricPaneSpec, type MetricSeriesSpec } from './MetricChart';
import type { MetricValueFormat } from './metricChartMath';
import { extent } from './seriesMath';

export interface StackPane {
  id: string;
  title: string;
  series: MetricSeriesSpec[];
  format: MetricValueFormat;
  /** Logarithmic right scale (read at mount: the stack remounts the pane when it changes). */
  log?: boolean;
  /** Pane height in px (default 190; the first pane 260). */
  height?: number;
  bounds?: MetricPaneSpec['bounds'];
}

export interface ChartStackProps {
  title: ComponentChildren;
  panes: readonly StackPane[];
  /** Right side of the header: range, scale, export. */
  controls?: ComponentChildren;
  /** Left column (series selector). Below xl it stacks under the charts. */
  table?: ComponentChildren;
  tableWidth?: string;
  tableLabel?: string;
  /** Changes when the theme changes, so canvas colours are re-read (pass the theme name). */
  themeKey?: string;
  className?: string;
  emptyMessage?: string;
}

const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function ChartStack({ title, panes, controls, table, tableWidth = 'clamp(16rem, 28%, 22rem)', tableLabel, themeKey = '', className, emptyMessage }: ChartStackProps) {
  const sync = useId();
  const dateRef = useRef<HTMLSpanElement>(null);
  const range = useMemo(() => {
    const e = extent(panes.flatMap((p) => p.series.flatMap((s) => s.points.filter((x) => x.v != null).map((x) => x.t))));
    return e ? { from: e[0], to: e[1] } : undefined;
  }, [panes]);
  const onHover = (t: number | null) => {
    if (dateRef.current) dateRef.current.textContent = t == null ? '' : fmtDate(t);
  };
  // One time grid for every series of every pane (gaps as null): the panes then agree on bar positions, so zoom / pan / crosshair sync is exact.
  const shown = useMemo(() => {
    const live = panes.filter((p) => p.series.length);
    const grid = [...new Set(live.flatMap((p) => p.series.flatMap((s) => s.points.map((x) => x.t))))].sort((a, b) => a - b);
    return live.map((p) => ({
      ...p,
      series: p.series.map((s) => {
        const at = new Map(s.points.map((x) => [x.t, x]));
        return { ...s, points: grid.map((t) => at.get(t) ?? { t, v: null }) };
      }),
    }));
  }, [panes]);
  return (
    <section className={cn('surface overflow-hidden rounded-lg border border-border bg-bg-1', className)}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-3 py-2">
        <h3 className="mr-auto min-w-0 truncate font-title text-sm font-semibold text-fg-0">{title}</h3>
        <span ref={dateRef} className="font-numeric text-xs tabular-nums text-fg-2" aria-live="off" />
        {controls && <div className="flex flex-wrap items-center gap-2 [&>*]:shrink-0">{controls}</div>}
      </header>
      <div className={cn('grid min-w-0', table && 'xl:grid-cols-[var(--cs-w)_minmax(0,1fr)]')} style={table ? ({ '--cs-w': tableWidth } as Record<string, string>) : undefined}>
        {table && (
          <div role="region" aria-label={tableLabel} className="min-w-0 border-border max-xl:order-last max-xl:border-t xl:border-r">
            {table}
          </div>
        )}
        <div className="min-w-0">
          {shown.length === 0 && <div className="py-12 text-center text-sm text-fg-2">{emptyMessage ?? 'Select a strategy'}</div>}
          {shown.map((p, i) => (
            <div key={p.id} className={cn('min-w-0', i > 0 && 'border-t border-border')} style={{ height: p.height ?? (i === 0 ? 260 : 190) }}>
              <MetricChart
                key={`${themeKey}-${p.id}-${p.log ? 'log' : 'lin'}-${p.series.map((s) => s.id).join()}`}
                title={p.title}
                watermark={false}
                series={p.series}
                panes={[{ format: p.format, log: p.log, bounds: p.bounds }]}
                range={range}
                syncId={`${sync}`}
                onHoverTime={onHover}
                timeAxis={i === shown.length - 1}
                className="h-full"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
