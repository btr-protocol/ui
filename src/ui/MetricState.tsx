import { type Cell } from '../lib/cell';
import { DASH, type MetricPhase } from '../lib/metricPhase';
import { Figure } from './Figure';
import type { Ch } from './Loaders';

export type { MetricPhase };

export interface MetricStateProps {
  phase: MetricPhase;
  /** Formatted value. Rendered only when `phase` is 'live'; null falls through to 'empty'. */
  value: string | null | undefined;
  /** The refusal for 'unfillable'. A failed read shows the fixed 'Not read'; its raw detail goes to the console, never here. */
  reason?: string;
  /** Offered on 'error' as the Retry button. */
  retry?: () => void;
  /** What the number is, for the empty tooltip ("No fees booked in this window yet"). */
  emptyHint?: string;
  className?: string;
  /** Skeleton width while loading. */
  skeletonClassName?: string;
  /** Characters reserved for the figure, so the loading to value swap does not shift the layout. */
  ch?: Ch;
}

export function MetricState({
  phase,
  value,
  reason,
  retry,
  emptyHint,
  className,
  skeletonClassName = 'w-12',
  ch = 6,
}: MetricStateProps) {
  // One renderer: the phase picks the Cell, `Figure` draws it.
  const cell: Cell<string> =
    phase === 'loading'
      ? { s: 'loading' }
      : phase === 'live' && value != null && value !== DASH
        ? { s: 'value', v: value }
        : phase === 'error'
          ? { s: 'error', retry }
          : phase === 'unfillable'
            ? { s: 'unavailable', reason: 'unfillable', detail: reason ?? 'the book cannot fill this size, so no price is quoted' }
            : { s: 'na', why: phase === 'stale' ? 'Updating: shown once the next report lands.' : (emptyHint ?? 'Not reported for this window yet.') };
  return <Figure cell={cell} format={(v) => v} ch={ch} className={className} placeholderClassName={skeletonClassName} />;
}
