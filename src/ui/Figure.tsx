import { type Cell, NA_GLYPH, assertNever } from '../lib/cell';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Icon } from './Icon';
import { ValuePlaceholder } from './Loaders';

const REASON: Record<Extract<Cell<unknown>, { s: 'unavailable' }>['reason'], string> = {
  error: 'Could not load',
  timeout: 'Timed out',
  unserved: 'Not served',
  'rate-limited': 'Rate limited',
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
  ch?: number;
  className?: string;
  /** Classes of the loading placeholder (a width). */
  placeholderClassName?: string;
}

/** THE renderer of a figure: one state, one look, everywhere. Wrap a loading region in `Busy` to announce it once. */
export function Figure<T>({ cell, format, ch, className, placeholderClassName }: FigureProps<T>) {
  const box = (children: preact.ComponentChildren, extra?: string, title?: string) => (
    <span title={title} data-state={cell.s} style={ch ? { minWidth: `${ch}ch` } : undefined} className={cn('inline-block tabular-nums', extra, className)}>
      {children}
    </span>
  );
  switch (cell.s) {
    case 'value':
      return box(format(cell.v));
    case 'stale':
      return box(
        <>
          <span className="opacity-60">{format(cell.v)}</span>
          <span className="ml-1.5 rounded-xs bg-bg-3 px-1 text-2xs text-fg-2">stale {ageLabel(cell.asOf)}</span>
        </>,
      );
    case 'loading':
      return box(<ValuePlaceholder ch={ch} className={placeholderClassName} />);
    case 'measuring':
      return box(<span className="text-fg-3">Measuring{cell.note ? ` ${cell.note}` : ''}</span>);
    case 'unavailable': {
      const title = cell.detail ? `${REASON[cell.reason]}: ${cell.detail}` : REASON[cell.reason];
      return box(
        <span className="inline-flex items-center gap-1 text-warning" aria-label={title}>
          <span className="text-fg-3">{NA_GLYPH}</span>
          <Icon name="warning" size={11} aria-hidden />
          {cell.retry && <Button size="xs" variant="ghost" aria-label="Retry" leftIcon={<Icon name="refresh-cw" size={12} />} onClick={cell.retry} />}
        </span>,
        undefined,
        title,
      );
    }
    case 'na':
      return box(<span className="text-fg-3">{NA_GLYPH}</span>, undefined, cell.why);
    default:
      return assertNever(cell);
  }
}
