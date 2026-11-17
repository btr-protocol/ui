import { DASH } from './metricPhase';

/** What ONE displayed figure is doing right now. Every loading state of the kit is one of these; `Figure` renders it.
 *  Kinds: value (a real number, 0 included), loading (skeleton; "measuring" is loading too), unavailable (the one glyph), error (short message + retry). Never a made-up 0.
 *  `asOf` is epoch ms. Decided ONCE, in the data hook (`toCell`); `Figure` only draws it (stateless: no timers, no state). */
export type Cell<T> =
  | { s: 'value'; v: T; asOf?: number; /** A refresh is in flight while this value stays: draw the `refreshing` hairline, never a loader. */ refreshing?: boolean }
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

/** Pure helper for the hook that keeps `since`: returns when `key` began loading (kept in the caller's `starts` map), clears it when the
 *  read ends. So `toCell({ loading, since: loadingSince(starts, key, loading) })` always carries a start and a stuck load ends at the deadline. */
export function loadingSince(starts: Map<string, number>, key: string, loading: boolean, now: number = Date.now()): number | undefined {
  if (!loading) {
    starts.delete(key);
    return undefined;
  }
  const t = starts.get(key) ?? now;
  starts.set(key, t);
  return t;
}

type ToCellBase<T> = {
  value?: T | null;
  error?: unknown;
  now?: number;
  retry?: () => void;
  /** Epoch ms of the held value. Held value + failed read: `stale` (the age mark) ONLY when `asOf` is a real time; without it there is no honest age, so the read is `error` (never a false "stale 0s"). With a refresh in flight it is `value` + `refreshing`. */
  asOf?: number;
  /** Reason when nothing is loading, failing or held (default 'unserved'). */
  reason?: UnavailableReason;
};
/** `since` is REQUIRED while `loading` is true (type-enforced): past `LOADING_DEADLINE_MS` a still-loading read is `unavailable('timeout')`, so a
 *  loader always ends (decided on the hook's next render/poll, no timer). Keep it with `loadingSince`. */
export type ToCellOptions<T> = ToCellBase<T> &
  ({ loading?: false; since?: number; measuring?: false } | { loading: true; since: number; measuring?: false } | { loading: true; measuring: true; since?: number });

/** `measuring: true` is for a read that legitimately takes long (a hook APR accruing for days): the skeleton shows with NO deadline, still no label
 *  text. Use it only for a named, bounded-by-nature wait; every other load keeps `since` and ends at the deadline. */

/** The ONE adapter from a hook's `value | null | undefined` + flags to a Cell. A read that failed is `error`, never a 0; a value that is
 *  not a finite number (NaN/Infinity) is unread; a real 0 stays `value`. A value we already hold is never blanked: a refresh keeps it
 *  (`refreshing`), a failed refresh marks it `stale`. */
export function toCell<T>(o: ToCellOptions<T>): Cell<T> {
  const v = o.value;
  const now = o.now ?? Date.now();
  const held = v != null && !(typeof v === 'number' && !Number.isFinite(v));
  if (held) {
    if (o.error) return o.asOf !== undefined ? { s: 'stale', v: v as T, asOf: o.asOf } : { s: 'error', retry: o.retry };
    return { s: 'value', v: v as T, asOf: o.asOf, ...(o.loading && { refreshing: true }) };
  }
  if (o.error) return { s: 'error', retry: o.retry };
  if (o.loading) return !o.measuring && now - (o.since as number) >= LOADING_DEADLINE_MS ? { s: 'unavailable', reason: 'timeout' } : { s: 'loading' };
  return { s: 'unavailable', reason: o.reason ?? 'unserved' };
}
