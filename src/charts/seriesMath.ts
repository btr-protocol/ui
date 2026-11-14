/** Generic time-series statistics for charts (equity -> returns, rolling windows, distribution). Pure, no DOM. Points are MetricPoint-like ({t ms, v}). */
import type { MetricPoint } from './metricChartMath';

const fin = (v: number | null): v is number => v != null && Number.isFinite(v);

export const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN);
export const std = (xs: readonly number[]): number => {
  if (xs.length < 2) return Number.NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
/** Linear-interpolated quantile, q in [0, 1]. */
export function quantile(xs: readonly number[], q: number): number {
  if (!xs.length) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = q * (s.length - 1);
  const lo = Math.floor(i);
  return s[lo] + (s[Math.min(s.length - 1, lo + 1)] - s[lo]) * (i - lo);
}

/** Simple returns of a level series (equity): one point per step, null stays a gap. */
export function returns(points: readonly MetricPoint[]): MetricPoint[] {
  const out: MetricPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].v;
    const b = points[i].v;
    out.push({ t: points[i].t, v: fin(a) && fin(b) && a > 0 ? b / a - 1 : null });
  }
  return out;
}

/** Statistic of the trailing `window` points, null until the window is full (or when it holds a gap). */
export function rolling(points: readonly MetricPoint[], window: number, fn: (vs: number[]) => number): MetricPoint[] {
  return points.map((p, i) => {
    if (i + 1 < window) return { t: p.t, v: null };
    const vs: number[] = [];
    for (let k = i + 1 - window; k <= i; k++) {
      const v = points[k].v;
      if (!fin(v)) return { t: p.t, v: null };
      vs.push(v);
    }
    const r = fn(vs);
    return { t: p.t, v: Number.isFinite(r) ? r : null };
  });
}

/** Rolling compounded return over `window` steps of a RETURN series. */
export const rollingReturn = (r: readonly MetricPoint[], window: number) => rolling(r, window, (vs) => vs.reduce((a, b) => a * (1 + b), 1) - 1);
/** Rolling annualised volatility of a return series (`perYear` steps a year). */
export const rollingVol = (r: readonly MetricPoint[], window: number, perYear = 365) => rolling(r, window, (vs) => std(vs) * Math.sqrt(perYear));
/** Rolling annualised Sharpe (mean / std, zero risk-free) of a return series. */
export const rollingSharpe = (r: readonly MetricPoint[], window: number, perYear = 365) => rolling(r, window, (vs) => (mean(vs) / std(vs)) * Math.sqrt(perYear));

export interface Bins {
  edges: number[];
  counts: number[];
}

/** Equal-width histogram of `xs` between `range` (default min..max); values outside fold into the end bins. */
export function histogram(xs: readonly number[], nbins = 41, range?: [number, number]): Bins {
  const v = xs.filter(Number.isFinite);
  if (!v.length) return { edges: [], counts: [] };
  const [lo0, hi0] = extent(v) ?? [0, 0];
  let lo = range?.[0] ?? lo0;
  let hi = range?.[1] ?? hi0;
  if (!(hi > lo)) [lo, hi] = [lo - 0.5, hi + 0.5];
  const w = (hi - lo) / nbins;
  const counts = new Array<number>(nbins).fill(0);
  for (const x of v) counts[Math.min(nbins - 1, Math.max(0, Math.floor((x - lo) / w)))]++;
  return { edges: Array.from({ length: nbins + 1 }, (_, i) => lo + i * w), counts };
}

/** Normal density at x. */
export const normalPdf = (x: number, mu: number, sigma: number) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

export type Period = 'day' | 'week' | 'month';
const bucket = (t: number, p: Period) => {
  const d = new Date(t);
  return p === 'month' ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) : p === 'week' ? Math.floor((t / 86400000 + 3) / 7) : Math.floor(t / 86400000);
};
/** Re-bin a series to week / month bars: a LEVEL series (equity, drawdown, a rolling statistic) keeps its last value of each bar; a RETURN series
 *  (`mode: 'compound'`) compounds the returns inside the bar. Gaps (null) are skipped; a bar with no value is dropped. */
export function resample(points: readonly MetricPoint[], period: Period, mode: 'last' | 'compound' = 'last'): MetricPoint[] {
  if (period === 'day') return [...points];
  const out: MetricPoint[] = [];
  let key: number | null = null;
  for (const p of points) {
    if (p.v == null) continue;
    const k = bucket(p.t, period);
    if (k !== key) {
      out.push({ t: p.t, v: mode === 'compound' ? 1 + p.v : p.v });
      key = k;
    } else {
      const o = out[out.length - 1];
      o.t = p.t;
      o.v = mode === 'compound' ? (o.v as number) * (1 + p.v) : p.v;
    }
  }
  return mode === 'compound' ? out.map((o) => ({ t: o.t, v: (o.v as number) - 1 })) : out;
}

/** min / max of the finite values without spreading the array onto the stack (`Math.min(...xs)` throws RangeError past ~120k items). */
export function extent(xs: Iterable<number>): [number, number] | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of xs) {
    if (!Number.isFinite(x)) continue;
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return lo <= hi ? [lo, hi] : undefined;
}
