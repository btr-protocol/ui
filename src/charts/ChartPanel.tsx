// ChartPanel: the bordered frame for a metrics chart (front metrics stack style). Header = title + live
// readout (hovered value and date) on the left, controls on the right; body = optional value table
// (the legend) left of the chart on xl+, stacked under it below xl.
// The chart FILLS the body: on xl+ it is as tall as the value table (no empty band under it), below xl it has a floor of
// CHART_MIN_H. With `fullscreenKey` the header carries a full-size button: the panel itself becomes a full-viewport sheet
// (same element, so the chart stays mounted and just refits), its state lives in the history (`?modal=<key>`: Back closes it) and Esc closes it.
import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { cn } from '../lib/cn';
import { useModalRoute } from '../lib/modalRoute';
import { Icon } from '../ui/Icon';

/** Floor of the chart area (px-free, rem): phones and short tables. */
export const CHART_MIN_H = 'min-h-[18rem] sm:min-h-[22rem]';

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
  /** Adds the full-size button; one unique key per panel (it is the `?modal=` name). */
  fullscreenKey?: string;
  /** Accessible names of the full-size button (open / close). */
  fullscreenLabels?: { open: string; close: string };
}

export function ChartPanel({ title, value, date, valueRef, dateRef, controls, table, tableWidth = 'clamp(20rem, 34%, 28rem)', tableLabel, children, className, fullscreenKey, fullscreenLabels = { open: 'Full size', close: 'Close full size' } }: ChartPanelProps) {
  const [full, setFull] = useModalRoute(fullscreenKey ?? '\0');
  const open = !!fullscreenKey && full;
  const titleId = useId();
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setFull(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', esc);
    const btn = opener.current;
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = prev;
      btn?.focus({ preventScroll: true });
    };
  }, [open]);
  return (
    <section
      className={cn('surface overflow-hidden border border-border bg-bg-1', open ? 'fixed inset-0 z-[100] flex flex-col rounded-none' : 'rounded-lg', className)}
      {...(open ? { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId } : {})}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2.5">
        <div className="mr-auto min-w-0">
          <h3 id={titleId} className="truncate font-title text-sm font-semibold text-fg-0">{title}</h3>
          <div className="flex flex-wrap items-baseline gap-x-2" aria-live="off">
            <span ref={valueRef} className="font-title text-xl font-bold tabular-nums text-fg-0">{value}</span>
            <span ref={dateRef} className="font-title text-xs tabular-nums text-fg-3">{date}</span>
          </div>
        </div>
        {(controls || fullscreenKey) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {fullscreenKey && (
              <button
                ref={opener}
                type="button"
                onClick={() => setFull(!open)}
                aria-label={open ? fullscreenLabels.close : fullscreenLabels.open}
                title={open ? fullscreenLabels.close : fullscreenLabels.open}
                aria-expanded={open}
                className="tap-min inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border text-fg-2 hover:bg-bg-2 hover:text-fg-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name={open ? 'x' : 'corners-out'} className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </header>
      <div
        className={cn('grid min-w-0', table && 'xl:grid-cols-[var(--cp-w)_minmax(0,1fr)]', open && 'min-h-0 flex-1 overflow-y-auto xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden')}
        style={table ? ({ '--cp-w': tableWidth } as Record<string, string>) : undefined}
      >
        {table && (
          <div role="region" aria-label={tableLabel} className={cn('min-w-0 border-t border-border max-xl:order-last xl:border-r xl:border-t-0', open && 'xl:overflow-y-auto')}>
            {table}
          </div>
        )}
        <div className={cn('flex min-w-0 flex-col p-1', CHART_MIN_H, open && 'max-xl:min-h-[60dvh]')}>
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0 [&>*]:h-full">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
