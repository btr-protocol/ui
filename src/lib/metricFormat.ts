/** Metric display helpers, verbatim from the btr.markets front (`lib/protocolMetricsFormat.ts`).
 *  Null / NaN / stale => DASH (never invent $0 / 0%). */

import {
  formatCompact,
  formatPercentSig,
  formatYield,
} from '@btr-protocol/sdk/utils/format';
import { formatUsd } from './format';
import { DASH } from './metricPhase';

export { DASH };

/** Finite value, else null: 'no data' never becomes a fake zero. */
export function num(v: number | null | undefined): number | null {
  return v != null && Number.isFinite(v) ? v : null;
}

export function fmtUsd(v: number | null | undefined, stale = false): string {
  if (stale || v == null || !Number.isFinite(v)) return DASH;
  return formatUsd(v);
}

/** Signed percent through the shared magnitude-adaptive formatter (three significant figures);
 *  values that round onto ±0 print unsigned `0.00%`. */
export function fmtSignedPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return clampSignedZeroPct(formatPercentSig(v * 100, 3, true));
}

/** Collapse `+0%` / `-0.00%` / `0%` onto unsigned `0.00%`. */
export function clampSignedZeroPct(text: string): string {
  return /^[+-]?0(?:\.0+)?%$/.test(text) ? '0.00%' : text;
}

export function fmtCount(v: number | null | undefined, stale = false): string {
  if (stale || v == null || !Number.isFinite(v)) return DASH;
  // A count under a thousand is a whole number ("0", "5"), never "0.00".
  return Math.abs(v) < 1000 ? String(Math.round(v) + 0) : formatCompact(v);
}

/** Everything the fee/revenue split reads. The back's explicit fields win; lp/proto are the
 *  fallback for a back that predates the split. */
export interface FeeSplitInput {
  lpFeesUsd?: number | null;
  protoFeesUsd?: number | null;
  feesUsd?: number | null;
  revenueUsd?: number | null;
  protocolSharePct?: number | null;
}

/**
 * Fees / revenue / protocol share under ONE definition, matching the indexer's `fee_split`:
 *   fees = LP fees + protocol fees, revenue = protocol fees, share = revenue / fees.
 * A missing leg is not a zero: an unknown split stays null and renders "-". A measured zero
 * (a coop-only window books a real 0 protocol fee) still reads as 0.
 */
export function feeSplit(m: FeeSplitInput): {
  fees: number | null;
  revenue: number | null;
  share: number | null;
} {
  const lp = num(m.lpFeesUsd);
  const proto = num(m.protoFeesUsd);
  const fees = num(m.feesUsd) ?? (lp == null && proto == null ? null : (lp ?? 0) + (proto ?? 0));
  const revenue = num(m.revenueUsd) ?? proto;
  const share =
    num(m.protocolSharePct) ??
    (fees != null && fees > 0 && revenue != null ? revenue / fees : null);
  return { fees, revenue, share };
}

/**
 * TVL-weighted mean of ONE rate over the rows it is folded from: a rate cannot be summed, and a
 * row with no rate cedes to the rows that have one instead of counting as 0. The summary weights a
 * fee APR this way; the hook leg is recovered by the same law, because the payload carries it per
 * LEG and a pool's own row has no strategy figure. Weights that are all unusable fall back to the
 * plain mean - the rate still says something, it just carries no size.
 */
export function weightedRate<T>(
  rows: readonly T[],
  value: (row: T) => number | null | undefined,
  weight: (row: T) => number | null | undefined,
): number | null {
  let weighted = 0;
  let totalWeight = 0;
  let plain = 0;
  let seen = 0;
  for (const row of rows) {
    const v = num(value(row));
    if (v === null) continue;
    seen += 1;
    plain += v;
    const w = num(weight(row));
    if (w !== null && w > 0) {
      weighted += v * w;
      totalWeight += w;
    }
  }
  if (seen === 0) return null;
  return totalWeight > 0 ? weighted / totalWeight : plain / seen;
}

/** Input already in percent units (12.5 → "12.5%"). */

/** Ratio 0-1 (or >1 coverage) → percent string, through the shared adaptive formatter:
 *  three significant figures at every magnitude, so a 0.42% rate never reads as "0%". */
export function fmtRatio(v: number | null | undefined, stale = false, _decimals = 2): string {
  if (stale || v == null || !Number.isFinite(v)) return DASH;
  return formatPercentSig(v * 100, 3);
}

/**
 * The app's one yield string. Takes a decimal ratio as the collector reports it (0.12 → "12%",
 * 0.0368 → "3.68%", 22.2 → "2220%"). Every APR/APY renders through here: `formatYield` owns the
 * rounding law, this wrapper only the ratio-to-percent scaling and the stale/missing dash.
 */
export function fmtApr(v: number | null | undefined, stale = false): string {
  if (stale || v == null || !Number.isFinite(v)) return DASH;
  return formatYield(v * 100);
}

/**
 * Allocation / share column: `pct` is already in percent units (0.912 = 0.912%).
 * Floored (never rounded up) to 0.01% with exactly 2 decimals, so the cell is at most "100.00%" wide
 * and never switches to subscript notation. Anything above 0 but under 0.01% reads "<0.01%": an
 * allocation that small is insignificant, which is why this deliberately differs from the auto
 * formatter (`formatPercentSig`) used for rates.
 */
export function fmtShare(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return DASH;
  if (pct < 0) return `-${fmtShare(-pct)}`;
  if (pct === 0) return '0.00%';
  const floored = Math.floor(pct * 100 + 1e-9) / 100; // 1e-9: 0.29 * 100 = 28.999999999999996
  return floored < 0.01 ? '<0.01%' : `${floored.toFixed(2)}%`;
}

/** Window length from milliseconds: "7d", "36h", "20m". Missing = dash. */
export function fmtWindowMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return DASH;
  const h = ms / 3600_000;
  if (h >= 48) return `${Math.round(h / 24)}d`;
  if (h >= 1) return `${Math.round(h)}h`;
  return `${Math.max(1, Math.round(ms / 60_000))}m`;
}

/** Fixed-point decimals, dash for a missing figure (balances, burn rates, ratios). */
export const fmtFixed = (v: number | null | undefined, d = 4): string =>
  v == null ? DASH : v.toFixed(d);

export function fmtAge(sec: number | null | undefined, stale = false): string {
  if (stale || sec == null || !Number.isFinite(sec)) return DASH;
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

/** A ratio as a percent in a table cell: values below `floor` (default 0.01 %) read "<0.01%" instead of the subscript-zero form ("0.0₄739%"). */
export function fmtRatioFloor(v: number | null | undefined, floor = 0.0001): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return v !== 0 && Math.abs(v) < floor ? `${v < 0 ? '-' : ''}<${(floor * 100).toFixed(2)}%` : fmtRatio(v);
}
