import { type Cell, LOADING_DEADLINE_MS, NA_GLYPH, assertNever, useCellDeadline } from '../lib/cell';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Tooltip } from './FloatingPanel';
import { Icon } from './Icon';
import { ValuePlaceholder, useInBusy } from './Loaders';

type Reason = Extract<Cell<unknown>, { s: 'unavailable' }>['reason'];
const REASON: Record<Reason, string> = {
  error: 'Could not load',
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
  ch?: number;
  className?: string;
  /** Classes of the loading placeholder (a width). */
  placeholderClassName?: string;
  /** What the figure is ("TVL"): names the Retry button ("Retry TVL"). */
  label?: string;
  /** A loading cell older than this becomes unavailable('timeout') (default 15 s). */
  deadlineMs?: number;
}

/** THE renderer of a figure: one state, one look, everywhere. Reasons are real text (visually hidden for assistive tech, shown through a
 *  focusable Tooltip). A loading figure announces itself unless it sits in a `Busy`, whose one status does that. */
export function Figure<T>({ cell: input, format, ch, className, placeholderClassName, label, deadlineMs = LOADING_DEADLINE_MS }: FigureProps<T>) {
  const cell = useCellDeadline(input, deadlineMs);
  const inBusy = useInBusy();
  const box = (children: preact.ComponentChildren) => (
    <span data-state={cell.s} style={ch ? { minWidth: `${ch}ch` } : undefined} className={cn('inline-block tabular-nums', className)}>
      {children}
    </span>
  );
  /** The glyph is focusable and tooltipped; the same words are in the DOM as hidden text. */
  const reasoned = (glyph: preact.ComponentChildren, said: string, extra?: preact.ComponentChildren) => (
    <>
      <Tooltip content={said} side="bottom">
        <span tabIndex={0} className="inline-flex cursor-help items-center gap-1 rounded-xs"><span aria-hidden="true" className="inline-flex items-center gap-1">{glyph}</span></span>
      </Tooltip>
      <span className="sr-only">{said}</span>
      {extra}
    </>
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
      return box(
        <>
          <ValuePlaceholder ch={ch} className={placeholderClassName} />
          {!inBusy && <span className="sr-only">Loading</span>}
        </>,
      );
    case 'measuring':
      return box(<span className="text-fg-3">Measuring{cell.note ? ` ${cell.note}` : ''}</span>);
    case 'unavailable': {
      const said = `Unavailable: ${cell.detail ? `${REASON[cell.reason]}, ${cell.detail}` : REASON[cell.reason]}`;
      return box(
        reasoned(
          <span className="inline-flex items-center gap-1 text-warning">
            <span className="text-fg-3">{NA_GLYPH}</span>
            <Icon name={cell.reason === 'unfillable' ? 'x-circle' : 'warning'} size={11} aria-hidden />
          </span>,
          said,
          cell.retry && <Button size="xs" variant="ghost" aria-label={label ? `Retry ${label}` : 'Retry'} icon={<Icon name="refresh-cw" />} onClick={cell.retry} />,
        ),
      );
    }
    case 'na':
      return box(reasoned(<span className="text-fg-3">{NA_GLYPH}</span>, `Not applicable: ${cell.why}`));
    default:
      return assertNever(cell);
  }
}
