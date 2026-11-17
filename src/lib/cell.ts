import { DASH } from './metricPhase';

/** What ONE displayed figure is doing right now. Every loading state of the kit is one of these; `Figure` renders it.
 *  Kinds: value (a real number, 0 included), loading (skeleton; "measuring" is loading too), unavailable (the one glyph), error (short message + retry). Never a made-up 0.
 *  `asOf` is epoch ms. Decided ONCE, in the data hook (`toCell`); `Figure` only draws it (stateless: no timers, no state). */
export type Cell<T> =
  | { s: 'value'; v: T; asOf?: number }
  | { s: 'stale'; v: T; asOf: number }
  | { s: 'loading' }
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

/** The ONE adapter from a hook's `value | null | undefined` + flags to a Cell. A read that failed is `error`, never a 0; a value that is
 *  not a finite number (NaN/Infinity) is unread; a real 0 stays `value`. A value we already hold wins over a refresh or a failed refresh (stale). */
export function toCell<T>(o: {
  value?: T | null;
  loading?: boolean;
  error?: unknown;
  /** When loading began (epoch ms), kept by the hook. Past `LOADING_DEADLINE_MS` a still-loading read is `unavailable('timeout')`, so a loader always ends (decided on the hook's next render/poll, no timer). */
  since?: number;
  now?: number;
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
  if (o.loading) return o.since !== undefined && (o.now ?? Date.now()) - o.since >= LOADING_DEADLINE_MS ? { s: 'unavailable', reason: 'timeout' } : { s: 'loading' };
  return { s: 'unavailable', reason: o.reason ?? 'unserved' };
}
