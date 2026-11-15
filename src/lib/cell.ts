import { DASH } from './metricPhase';

/** What ONE displayed figure is doing right now. Every loading state of the kit is one of these; `Figure` renders it.
 *  `asOf` / `since` are epoch ms. */
export type Cell<T> =
  | { s: 'value'; v: T; asOf?: number }
  | { s: 'stale'; v: T; asOf: number }
  | { s: 'loading'; since?: number }
  | { s: 'measuring'; note?: string }
  | { s: 'unavailable'; reason: 'error' | 'timeout' | 'unserved' | 'rate-limited'; detail?: string; retry?: () => void }
  | { s: 'na'; why: string };

export type CellState = Cell<unknown>['s'];
export type UnavailableReason = Extract<Cell<unknown>, { s: 'unavailable' }>['reason'];

/** The ONE "no number" glyph of the kit (a hyphen; no em dash anywhere). */
export const NA_GLYPH = DASH;

/** Compile-time exhaustiveness for a `switch (cell.s)`: a new state fails the build wherever it is not handled. */
export function assertNever(x: never): never {
  throw new Error(`unhandled state: ${JSON.stringify(x)}`);
}

/** Loaders never spin forever: a loading cell older than the deadline becomes unavailable('timeout'). A cell without `since` is left alone. */
export function expireLoading<T>(cell: Cell<T>, now: number, deadlineMs = 15000): Cell<T> {
  return cell.s === 'loading' && cell.since != null && now - cell.since >= deadlineMs ? { s: 'unavailable', reason: 'timeout' } : cell;
}
