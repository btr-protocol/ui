import { useEffect, useState } from 'preact/hooks';
import { DASH } from './metricPhase';

/** What ONE displayed figure is doing right now. Every loading state of the kit is one of these; `Figure` renders it.
 *  `asOf` / `since` are epoch ms. */
export type Cell<T> =
  | { s: 'value'; v: T; asOf?: number }
  | { s: 'stale'; v: T; asOf: number }
  | { s: 'loading'; since: number }
  | { s: 'measuring'; note?: string }
  | { s: 'unavailable'; reason: 'error' | 'timeout' | 'unserved' | 'rate-limited' | 'unfillable'; detail?: string; retry?: () => void }
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
