import { type Cell, NA_GLYPH, assertNever } from '../lib/cell';
import { cn } from '../lib/cn';
import { BORDER_RADIUS } from '../lib/design';
import { Button } from './Button';
import { Icon } from './Icon';
import { type Ch, ValuePlaceholder, useInBusy } from './Loaders';

type Reason = Extract<Cell<unknown>, { s: 'unavailable' }>['reason'];
const REASON: Record<Reason, string> = {
  timeout: 'Timed out',
  unserved: 'Not served',
  'rate-limited': 'Rate limited',
  unfillable: 'Unfillable',
};

/** "5m", "2h", "3d": how old a stale figure is. */
export function ageLabel(asOf: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - asOf) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export interface FigureProps<T> {
  cell: Cell<T>;
  /** Formats a value. A measured zero is a value: it prints as zero, never the n/a glyph. */
  format: (v: T) => string;
  /** Characters reserved for the figure (tabular figures): the loading placeholder and the value take the same width. */
  ch?: Ch;
  className?: string;
  /** Classes of the loading placeholder (a width). */
  placeholderClassName?: string;
  /** What the figure is ("TVL"): names the Retry button ("Retry TVL"). */
  label?: string;
  /** `tile` writes an error as the words "Not read"; the default (a table cell) is a warning mark. Both are one light node: no tab stop, no role, no tooltip stack. */
  variant?: 'cell' | 'tile';
}

/** THE renderer of a figure: one state, one look, everywhere. Stateless (the data hook decides the Cell with `toCell`) and LIGHT: a value,
 *  unavailable and na are one text node in one span (`title` carries the reason), never a focus stop. Unavailable is the one `-`; error is a
 *  different mark (warning icon / "Not read") and carries NO `role="alert"`: the section (`Loader error`, the table, the banner) owns the one alert.
 *  A loading figure announces itself unless it sits in a busy `Loader`. A refresh over a held value is `refreshing` (a CSS hairline on the span). */
export function Figure<T>({ cell, format, ch, className, placeholderClassName, label, variant = 'cell' }: FigureProps<T>) {
  const inBusy = useInBusy();
  const cls = (more?: string) => cn('inline-block tabular-nums', ch && `ch-${ch}`, more, className);
  switch (cell.s) {
    case 'value':
      return (
        <span data-state="value" className={cls(cell.refreshing ? 'refreshing' : undefined)}>
          {format(cell.v)}
        </span>
      );
    case 'stale':
      return (
        <span data-state="stale" className={cls()}>
          <span className="opacity-60">{format(cell.v)}</span>
          <span className={cn('ml-1.5 bg-bg-3 px-1 text-2xs text-fg-2', BORDER_RADIUS)}>stale {ageLabel(cell.asOf)}</span>
        </span>
      );
    case 'loading':
      return (
        <span data-state="loading" className={cls()}>
          <ValuePlaceholder ch={ch} className={placeholderClassName} />
          {!inBusy && <span className="sr-only">Loading</span>}
        </span>
      );
    case 'error':
      return (
        <span data-state="error" className={cls('inline-flex items-center gap-1 text-warning')} title="Not read">
          {variant === 'tile' ? 'Not read' : <><Icon name="warning" size={11} aria-hidden /><span className="sr-only">Not read</span></>}
          {cell.retry && <Button size="xs" variant="ghost" aria-label={label ? `Retry ${label}` : 'Retry'} leftIcon={<Icon name="refresh-cw" size={12} />} onClick={cell.retry} />}
        </span>
      );
    case 'unavailable':
      return (
        <span data-state="unavailable" className={cls('text-fg-3')} title={`Unavailable: ${cell.detail ? `${REASON[cell.reason]}, ${cell.detail}` : REASON[cell.reason]}`}>
          {NA_GLYPH}
        </span>
      );
    case 'na':
      return (
        <span data-state="na" className={cls('text-fg-3')} title={`Not applicable: ${cell.why}`}>
          {NA_GLYPH}
        </span>
      );
    default:
      return assertNever(cell);
  }
}
