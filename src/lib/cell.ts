import { useEffect, useState } from 'preact/hooks';
import { DASH } from './metricPhase';

/** What ONE displayed figure is doing right now. Every loading state of the kit is one of these; `Figure` renders it.
 *  Kinds: value (a real number, 0 included), loading (skeleton; "measuring" is loading too), unavailable (the one glyph), error (short message + retry). Never a made-up 0.
 *  `asOf` / `since` are epoch ms. */
export type Cell<T> =
  | { s: 'value'; v: T; asOf?: number }
  | { s: 'stale'; v: T; asOf: number }
  | { s: 'loading'; since: number }
  | { s: 'error'; retry?: () => void }
  | { s: 'unavailable'; reason: 'timeout' | 'unserved' | 'rate-limited' | 'unfillable'; detail?: string }
  | { s: 'na'; why: string };

export type CellState = Cell<unknown>['s'];
export type UnavailableReason = Extract<Cell<unknown>, { s: 'unavailable' }>['reason'];

/** The ONE "no number" glyph of the kit (a hyphen; no em dash anywhere). */
export const NA_GLYPH = DASH;

/** Compile-time exhaustiveness for a `switch (cell.s)`: a new state fails the build wherever it is not handled. */
export function assertNever(x: never): never {
  throw new Error(`unhandled state: ${JSON.stringify(x)}`);
}

export const LOADING_DEADLINE_MS = 15000;

/** Loaders never spin forever: a loading cell older than the deadline becomes unavailable('timeout'). */
export function expireLoading<T>(cell: Cell<T>, now: number, deadlineMs = LOADING_DEADLINE_MS): Cell<T> {
  return cell.s === 'loading' && now - cell.since >= deadlineMs ? { s: 'unavailable', reason: 'timeout' } : cell;
}

/** `expireLoading` as a hook: ONE timer per loading cell re-renders it when its deadline passes, so a loader always ends. Returns the cell to render. */
export function useCellDeadline<T>(cell: Cell<T>, deadlineMs = LOADING_DEADLINE_MS): Cell<T> {
  const [, tick] = useState(0);
  const since = cell.s === 'loading' ? cell.since : undefined;
  useEffect(() => {
    if (since === undefined) return;
    const left = since + deadlineMs - Date.now();
    const id = setTimeout(() => tick((n) => n + 1), Math.max(0, left));
    return () => clearTimeout(id);
  }, [since, deadlineMs]);
  return expireLoading(cell, Date.now(), deadlineMs);
}

/** The ONE adapter from a hook's `value | null | undefined` + flags to a Cell. A read that failed is `error`, never a 0; a value that is
 *  not a finite number (NaN/Infinity) is unread; a real 0 stays `value`. A value we already hold wins over a refresh or a failed refresh (stale). */
export function toCell<T>(o: {
  value?: T | null;
  loading?: boolean;
  error?: unknown;
  /** When loading began (epoch ms); keeps the 15 s deadline stable across re-renders. Default: now. */
  since?: number;
  retry?: () => void;
  /** Epoch ms of the held value, when it is older than a refresh in flight. */
  asOf?: number;
  /** Reason when nothing is loading, failing or held (default 'unserved'). */
  reason?: UnavailableReason;
}): Cell<T> {
  const v = o.value;
  const held = v != null && !(typeof v === 'number' && !Number.isFinite(v));
  if (held) return o.error && o.asOf !== undefined ? { s: 'stale', v: v as T, asOf: o.asOf } : { s: 'value', v: v as T, asOf: o.asOf };
  if (o.error) return { s: 'error', retry: o.retry };
  if (o.loading) return { s: 'loading', since: o.since ?? Date.now() };
  return { s: 'unavailable', reason: o.reason ?? 'unserved' };
}
