// ChartStack: time-series panes stacked in ONE frame on a shared x axis, the layout of the front's metrics page. Every pane is a MetricChart with
// its own time axis and a compact title (no legend, no value tags over the plot); zoom / pan and the crosshair are linked across panes (one sync group),
// the header reads the hovered timestamp, and beside EACH pane sits its own small table of that pane series and their value at that timestamp, sorted live
// (like the front metrics page stacked panes). `table` is an optional left slot (series picker).
import type { ComponentChildren } from 'preact';
import { useCallback, useId, useMemo, useRef, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { Table } from '../ui/Table';
import { numCol, textCol } from '../ui/tableCols';
import { MetricChart, type MetricPaneSpec, type MetricSeriesSpec } from './MetricChart';
import { formatter, type MetricValueFormat } from './metricChartMath';
import { extent } from './seriesMath';

export interface StackPane {
  id: string;
  title: string;
  /** Column heading of this pane in the value table (default: the title). */
  short?: string;
  /** false: no column for this pane in the value table (default true). */
  values?: boolean;
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
  /** Left column (series picker). Below xl it stacks under the charts. */
  table?: ComponentChildren;
  tableWidth?: string;
  tableLabel?: string;
  /** Right pane width (CSS length). */
  valuesWidth?: string;
  /** Changes when the theme changes, so canvas colours are re-read (pass the theme name). */
  themeKey?: string;
  className?: string;
  emptyMessage?: string;
}

const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function ChartStack({ title, panes, controls, table, tableWidth = 'clamp(16rem, 28%, 22rem)', tableLabel, valuesWidth = '15rem', themeKey = '', className, emptyMessage }: ChartStackProps) {
  const sync = useId();
  const dateRef = useRef<HTMLSpanElement>(null);
  const range = useMemo(() => {
    const e = extent(panes.flatMap((p) => p.series.flatMap((s) => s.points.filter((x) => x.v != null).map((x) => x.t))));
    return e ? { from: e[0], to: e[1] } : undefined;
  }, [panes]);
  const [hover, setHover] = useState<number | null>(null);
  const onHover = useCallback((t: number | null) => {
    if (dateRef.current) dateRef.current.textContent = t == null ? '' : fmtDate(t);
    setHover(t);
  }, []);
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
  // Value table: one row per plain series (stacked bands are composition, not a reading), one column per pane, read at the hovered bucket (at rest: the latest).
  const value = (s: MetricSeriesSpec) => {
    const sec = hover == null ? null : Math.floor(hover / 1000);
    for (let i = s.points.length - 1; i >= 0; i--) {
      const x = s.points[i];
      if (sec == null ? x.v != null : Math.floor(x.t / 1000) === sec) return x.v;
    }
    return null;
  };
  // One small value table PER pane, stacked beside its chart (like the metrics page's stacked panes): the pane's own series and their value at the crosshair (at rest: the latest), sorted live.
  type Row = { s: MetricSeriesSpec };
  const paneTable = (p: (typeof shown)[number]) => {
    const rows: Row[] = p.series.filter((s) => !s.stack).map((s) => ({ s }));
    if (p.values === false || rows.length === 0) return <div className="max-xl:hidden xl:border-l xl:border-border" />;
    const fmt = formatter(p.format);
    return (
      <div role="region" aria-label={`Values at the crosshair: ${p.short ?? p.title}`} className="min-h-0 min-w-0 overflow-y-auto border-border max-xl:border-t xl:border-l">
        <Table
          variant="compact"
          frame={false}
          searchable={false}
          rowKey={(r) => r.s.id}
          data={rows}
          initialSort={{ key: 'v', dir: 'desc' }}
          columns={[
            { ...textCol<Row>('n', p.short ?? p.title, (r) => r.s.label), render: (r: Row) => (<span className="flex min-w-0 items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: r.s.color }} /><span className="block min-w-0 truncate text-fg-0" title={r.s.label}>{r.s.label}</span></span>) },
            { ...numCol<Row>('v', 'value', (r) => value(r.s), (v) => (v == null ? '' : fmt(v))), sortable: true },
          ]}
        />
      </div>
    );
  };
  // The charts re-render only when their data, theme or range change: a crosshair move (`hover`) re-renders the value tables alone.
  const charts = useMemo(
    () =>
      shown.map((p) => (
          <div key={p.id} className="flex min-h-0 min-w-0 flex-col max-xl:h-[var(--ph)]">
            <h4 className="shrink-0 px-3 pt-1 text-xs font-semibold text-fg-1">{p.title}</h4>
            <MetricChart
              key={`${themeKey}-${p.id}-${p.log ? 'log' : 'lin'}-${p.series.map((s) => s.id).join()}`}
              title={p.title}
              watermark={false}
              series={p.series}
              panes={[{ format: p.format, log: p.log, bounds: p.bounds }]}
              range={range}
              syncId={`${sync}`}
              onHoverTime={onHover}
              timeAxis
              legend={false}
              priceTags={false}
              className="min-h-0 flex-1"
            />
          </div>
      )),
    [shown, themeKey, sync, range, onHover],
  );
  return (
    <section className={cn('surface overflow-hidden rounded-lg border border-border bg-bg-1', className)}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-3 py-2">
        <h3 className="mr-auto min-w-0 truncate font-title text-sm font-semibold text-fg-0">{title}</h3>
        <span ref={dateRef} className="font-numeric text-xs tabular-nums text-fg-2" aria-live="off" />
        {controls && <div className="flex flex-wrap items-center gap-2 [&>*]:shrink-0">{controls}</div>}
      </header>
      <div className={cn('grid min-w-0', table ? 'xl:grid-cols-[var(--cs-w)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(0,1fr)]')} style={{ '--cs-w': tableWidth, '--cs-v': valuesWidth } as Record<string, string>}>
        {table && (
          <div role="region" aria-label={tableLabel} className="min-w-0 border-border max-xl:order-last max-xl:border-t xl:border-r">
            {table}
          </div>
        )}
        <div className="min-w-0">
          {shown.length === 0 && <div className="py-12 text-center text-sm text-fg-2">{emptyMessage ?? 'Select a strategy'}</div>}
          {shown.map((p, i) => (
            <div key={p.id} className={cn('grid min-w-0 xl:h-[var(--ph)] xl:grid-cols-[minmax(0,1fr)_var(--cs-v)]', i > 0 && 'border-t border-border')} style={{ '--ph': `${p.height ?? (i === 0 ? 260 : 190)}px` } as Record<string, string>}>
              {charts[i]}
              {paneTable(p)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
