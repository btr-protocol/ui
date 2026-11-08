// ChartPanel: the bordered frame for a metrics chart (front metrics stack style). Header = title + live
// readout (hovered value and date) on the left, controls on the right; body = optional value table
// (the legend) left of the chart on xl+, stacked under it below xl.
import type { ComponentChildren, Ref } from 'preact';
import { cn } from '../lib/cn';

export interface ChartPanelProps {
  title: ComponentChildren;
  /** Headline value (latest at rest). Hosts that repaint on hover write `valueRef.textContent` directly (no re-render). */
  value?: ComponentChildren;
  /** Date of the readout (hovered bucket, else latest). */
  date?: ComponentChildren;
  valueRef?: Ref<HTMLSpanElement>;
  dateRef?: Ref<HTMLSpanElement>;
  /** Right side of the header: range, units, view and chart-type toggles. */
  controls?: ComponentChildren;
  /** Value table (the legend). Left of the chart on lg+, under it below xl. */
  table?: ComponentChildren;
  /** Table column width on xl+ (CSS length). */
  tableWidth?: string;
  /** Accessible name of the table region. */
  tableLabel?: string;
  children: ComponentChildren;
  className?: string;
}

export function ChartPanel({ title, value, date, valueRef, dateRef, controls, table, tableWidth = 'clamp(20rem, 34%, 28rem)', tableLabel, children, className }: ChartPanelProps) {
  return (
    <section className={cn('surface overflow-hidden rounded-lg border border-border bg-bg-1', className)}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2.5">
        <div className="mr-auto min-w-0">
          <h3 className="truncate font-title text-sm font-semibold text-fg-0">{title}</h3>
          <div className="flex flex-wrap items-baseline gap-x-2" aria-live="off">
            <span ref={valueRef} className="font-title text-xl font-bold tabular-nums text-fg-0">{value}</span>
            <span ref={dateRef} className="font-title text-xs tabular-nums text-fg-3">{date}</span>
          </div>
        </div>
        {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
      </header>
      <div
        className={cn('grid min-w-0', table && 'xl:grid-cols-[var(--cp-w)_minmax(0,1fr)]')}
        style={table ? ({ '--cp-w': tableWidth } as Record<string, string>) : undefined}
      >
        {table && (
          <div role="region" aria-label={tableLabel} className="min-w-0 border-t border-border max-xl:order-last xl:border-r xl:border-t-0">
            {table}
          </div>
        )}
        <div className="min-w-0 p-1">{children}</div>
      </div>
    </section>
  );
}
