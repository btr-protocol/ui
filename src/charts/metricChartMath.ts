import { fmtApr, fmtRatio } from '../lib/metricFormat';
import { formatCompact, formatCurrencyCompact } from '../lib/format';
import { DASH } from '../lib/metricPhase';
import type { MouseEventParams, UTCTimestamp } from 'lightweight-charts';

export type MetricSeriesType = 'area' | 'line' | 'histogram';
export type MetricValueFormat = 'usd' | 'pct' | 'yield' | 'count' | 'bps' | 'compact' | 'multiple';

export interface MetricPoint {
  t: number;
  v: number | null;
  /** A part of this bucket was skipped or unmeasured: `v` understates (or is a gap), never a 0. */
  partial?: boolean;
}

export interface MetricSeriesSpec {
  id: string;
  /** Stable key of the linked side-table row/category. Defaults to id. */
  rowKey?: string;
  label: string;
  type: MetricSeriesType;
  color: string;
  /** Pane index. Panes stack top to bottom and share the time scale. */
  pane?: number;
  points: MetricPoint[];
  /** Stack this series on top of the previous one in the same pane. */
  stack?: boolean;
  /** Fill/stroke alpha. Drops a series to a supporting role without giving it a second colour. */
  opacity?: number;
  /** A STACKED area's fill, faded toward the chart background by this much (0..1) yet still opaque: a pale band per series under its
   *  full-colour line (composition readable, no band bleeding through another). Needs the chart background (seriesPaint `bg`). */
  fade?: number;
  /** Vertical scale. 'right'/'left' are the pane's visible axes; 'hidden' puts the
   *  series on its own overlay scale that is never drawn and never shared with any
   *  other series - a count next to a dollar figure must not co-scale with it. */
  scale?: 'right' | 'left' | 'hidden';
  /** A filled series (area, bars) opens its axis at zero. `false` opts out where the reading is a
   *  small gap between two large levels (TVL vs flow-implied TVL); an area then autoscales to its own
   *  padded min/max (`paddedRange`) and its fill still runs to the bottom of the plot. */
  zeroBase?: boolean;
  /** Area for a series that is <= 0 (drawdown): the fill runs from the curve UP to 0, and the axis tops out at 0. */
  invert?: boolean;
  /** Pool aggregate drawn over per-asset series. */
  dashed?: boolean;
  /** No own y-axis: muted min/max in the legend instead of a second scale. */
  extent?: boolean;
  /** Legend/extent format; defaults to the pane's. */
  format?: MetricValueFormat;
  /** The legend's reading at rest, from the back's window summary: the SAME figure the KPI tiles and
   *  tables print. Absent = the pane's latest bucket. A bucket the back has not measured yet (the
   *  newest hook interval) is no reading, and must not stand in for the window. */
  resting?: number | null;
}

export interface MetricPaneSpec {
  /** Vertical weight relative to the other panes. */
  stretch?: number;
  format?: MetricValueFormat;
  /** Logarithmic right scale (equity curves). Read at mount, like `priceTags`: change it with the chart's key. Needs values > 0. */
  log?: boolean;
  /** Format for the left scale, when the pane carries two. */
  leftFormat?: MetricValueFormat;
  /**
   * Widest the right scale may open, as [min, max].
   *
   * Autoscale on its own is set by the single most extreme point, so one asset
   * at -83% flattens every other series into a hairline at the top of the pane.
   * The pane still scales to the data when the data is calmer than these bounds;
   * this only stops one outlier from owning the axis. Points outside are drawn
   * and clipped, never dropped, and the crosshair still reads their true value.
   */
  bounds?: [number, number];
}

/** Basis points to at most 2dp: '4 bps', '0.25 bps'. */
export const fmtBps = (v: number) => (Number.isFinite(v) ? `${Number(v.toFixed(2))} bps` : DASH);
/** `fmtBps` with the decimals an axis span asks for (more than its 2dp only where the span needs them). */
const fmtBpsAt = (v: number, decimals: number) =>
  !Number.isFinite(v) || decimals <= 2
    ? fmtBps(v)
    : `${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} bps`;

/** Legend / readout trim: drops the surplus span digits but keeps the ladder's 2dp, so a flat
 *  reading prints "1.00" and not "1.0000" (`trimZeros` would print "1"). */
export const legendTrim = (s: string): string => s.replace(/(\.\d\d\d*?)0+(?=\D*$)/, '$1');

/** One legend / crosshair reading. Only a reading whose decimals the axis span chose (it differs from
 *  the span-less ladder) loses its surplus zeros; a ladder reading keeps them ("0.450%" stays). */
export function legendText(format: MetricValueFormat, span: number | undefined, v: number): string {
  const spanned = formatter(format, span)(v);
  return spanned === formatter(format)(v) ? spanned : legendTrim(spanned);
}

/** A tick that is float noise around zero (a stacked pane's baseline lands on 1e-16) reads 0, not
 *  "0.0₁₄694%". */
const snap0 = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);

/** Axis / last-value labels drop trailing zeros: "$800.00K" -> "$800K", "$1.20M" -> "$1.2M", "$0.00" -> "$0". The legend keeps the fixed ladder. */
export const trimZeros = (s: string): string =>
  s.replace(/(\.\d*?)0+(?=\D*$)/, '$1').replace(/\.(?=\D*$)/, '');

/** Decimals that tell two axis ticks apart when the scale spans `span`. lightweight-charts picks
 *  its own tick step from the pixel height (one label every ~30px, so never more than ~50 ticks on
 *  a pane), and its custom-formatter callback gets the value alone: the step is not available. The
 *  decimals are read from a 1/50th of the span instead, one digit finer than any tick the library
 *  draws, so no two ticks print the same label ("1.01 1.01 1.01 1 1 1 0.99" on a base-1 index that
 *  moves 2%). `trimZeros` drops the surplus digits on the ticks that do not need them. */
export function axisDecimals(span: number): number {
  if (!Number.isFinite(span) || span <= 0) return 0;
  return Math.min(8, Math.max(0, Math.ceil(-Math.log10(span / 50) - 1e-9)));
}

/** A price a ladder already printed (`base`, e.g. the SDK `formatPrice`) with the decimals the axis
 *  `span` needs when the ladder has fewer: a stable pair at 1.0000 prints 1.00002, 1.00004 instead
 *  of one label at every tick. Digits past the ladder's own decimals lose their trailing zeros; a
 *  ladder that already tells the ticks apart (or has no plain decimals) is returned as is. */
export function atSpan(base: string, v: number, span: number | undefined): string {
  if (span == null || !Number.isFinite(v) || !/^-?[\d,]+(\.\d+)?$/.test(base)) return base;
  const dp = axisDecimals(span);
  const own = base.split('.')[1]?.length ?? 0;
  if (dp <= own) return base;
  const full = v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const keep = full.length - (dp - own);
  let end = full.length;
  while (end > keep && full[end - 1] === '0') end--;
  return full.slice(0, end);
}

/** Value formatter of one metric format. `span` = the height of the axis the value sits on (max -
 *  min of the autoscaled range): a format whose default decimals are too coarse for that span
 *  prints more, never fewer (`axisDecimals`). Without it the format's fixed ladder applies. */
export function formatter(format: MetricValueFormat, span?: number): (v: number) => string {
  const f = formatRaw(format, span ?? 0);
  return (v) => f(snap0(v));
}

/** K/M/B/T divisor a value is printed in, and its suffix. */
const compactUnit = (a: number): [number, string] =>
  a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'B'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'K'] : [1, ''];

/** The compact ladder of one value, with the decimals the axis span asks for. The span is read in
 *  the value's own K/M/B unit (a $20 span on $5,000 is 0.02K), so a tick on a thin axis is never
 *  the same label as its neighbour at any magnitude. Within the ladder's 2dp it is the ladder. */
function compactAt(v: number, span: number, usd: boolean): string {
  // A non-finite reading prints as the ladder does for it ("$0" / "0"), never "NaN".
  if (!Number.isFinite(v)) return usd ? formatCurrencyCompact(v) : formatCompact(v);
  const [d, unit] = compactUnit(Math.abs(v));
  const dp = axisDecimals(span / d);
  if (dp <= 2) return usd ? formatCurrencyCompact(v) : formatCompact(v);
  const body = (Math.abs(v) / d).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return `${v < 0 ? '-' : ''}${usd ? '$' : ''}${body}${unit}`;
}

/** `span`: the axis height; its `axisDecimals` is the floor the value's decimals must meet (0 = the
 *  format's own ladder). Only the formats whose ladder is a fixed decimal count respond to it (a
 *  plain number, a percent, the compact $ and plain ladders); a count and the significant-figure
 *  yield already read distinctly or are whole things. */
function formatRaw(format: MetricValueFormat, span = 0): (v: number) => string {
  const decimals = axisDecimals(span);
  // Same compact $ ladder as AssetBars / StatTile (`usd()`): always 2 fraction digits
  // so axis ticks and the projected last-value label match ($280.00K, $400.00).
  if (format === 'usd') return (v) => compactAt(v, span, true);
  // Same ratio formatter the metric tiles use; a chart axis and the tile above it
  // disagreeing about decimals is how "3.68%" ended up next to "3.7%". A span too thin for its
  // three significant figures (a 0.02% band around zero) prints the decimals the span needs.
  if (format === 'pct')
    return (v) => {
      // Fixed decimals only where they beat the three significant figures of this value
      // (50.001% vs 50.002% on a thin band); elsewhere the shared sig-fig law stands.
      const x = v * 100;
      if (!Number.isFinite(x)) return fmtRatio(v, false, 2);
      const sig = x === 0 ? 2 : Math.max(0, 2 - Math.floor(Math.log10(Math.abs(x))));
      return decimals - 2 > sig
        ? `${x.toLocaleString('en-US', { minimumFractionDigits: decimals - 2, maximumFractionDigits: decimals - 2 })}%`
        : fmtRatio(v, false, 2);
    };
  // 'yield' is NOT 'pct': a coverage ratio wants a fixed 2dp, a yield wants significant figures,
  // and an APR axis reading "3.7%" under a table cell reading "3.68%" is the same disagreement
  // one line up, one level of precision out. A span too thin for those three figures (3.66-3.70%)
  // prints the percent decimals it needs, the same rule as 'pct'.
  if (format === 'yield')
    return (v) => {
      const x = v * 100;
      if (!Number.isFinite(x)) return fmtApr(v);
      const sig = x === 0 ? 2 : Math.max(0, 2 - Math.floor(Math.log10(Math.abs(x))));
      return decimals - 2 > sig
        ? `${x.toLocaleString('en-US', { minimumFractionDigits: decimals - 2, maximumFractionDigits: decimals - 2 })}%`
        : fmtApr(v);
    };
  if (format === 'bps') return (v) => fmtBpsAt(v, decimals);
  // An index rebased to 1 (equity multiple): '2.5x'.
  if (format === 'multiple') return (v) => (Number.isFinite(v) ? `${trimZeros(v.toFixed(Math.abs(v) < 10 ? 2 : 1))}x` : formatCompact(v));
  // Counts are whole things - IPs, wallets, sessions. The compact ladder's 2dp is right for
  // magnitudes ("1.23M") but renders 5 as "5.00", and an axis tick reading "2.50 unique IPs"
  // is not a quantity that exists. Round, and drop decimals below the compact threshold.
  if (format === 'count')
    return (v) => (Math.abs(v) < 1000 ? String(Math.round(v)) : formatCompact(Math.round(v)));
  // A plain number (a base-1 index, a ratio): the compact ladder's 2dp, unless the axis span asks
  // for more at this value's magnitude.
  return (v) => compactAt(v, span, false);
}

/** #rrggbb + alpha ⇒ rgba(). TDLC will not take a CSS variable. */
export function alpha(color: string, a: number): string {
  const hex = color.trim();
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Blend two `#rrggbb` colours, `t` = share of `b`. `getColors()` resolves every token to opaque
 *  hex, so mixing toward the background is how a colour fades without turning translucent. */
export function mix(a: string, b: string, t: number): string {
  if (a[0] !== '#' || b[0] !== '#' || a.length < 7 || b.length < 7) return a;
  const ch = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const to = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${[1, 3, 5].map((i) => to(ch(a, i) * (1 - t) + ch(b, i) * t)).join('')}`;
}

/** Initial colours and hover emphasis share the same alpha defaults. A STACKED series is drawn
 *  from its running total down to the baseline and relies on paint order to hide the bands
 *  beneath, so dimming it by alpha would let every band below show through and the stack would
 *  read as unstacked. It fades toward `bg` instead and keeps its alpha. */
export function seriesPaint(spec: MetricSeriesSpec, factor = 1, bg?: string) {
  const solid = spec.stack === true && bg != null;
  const base = solid && factor < 1 ? mix(spec.color, bg, 1 - factor) : spec.color;
  const f = solid ? 1 : factor;
  const fill = solid && spec.fade ? mix(base, bg, spec.fade) : base; // opaque but pale: the faded stacked band
  return {
    color: alpha(base, (spec.opacity ?? (spec.type === 'histogram' && !spec.stack ? 0.45 : 1)) * f),
    lineColor: alpha(base, (spec.opacity ?? 1) * f),
    topColor: alpha(fill, (spec.stack ? 1 : 0.28) * f),
    bottomColor: alpha(fill, (spec.stack ? 1 : 0.02) * f),
    priceLineColor: alpha(base, f),
  };
}

/**
 * Plots a stacked series at the RUNNING TOTAL of the series below it.
 *
 * lightweight-charts has no stacked-area series, so stacking is done in the DATA: series N is
 * drawn at (Σ series 1..N-1) + its own value, which is what makes the top edge the total and what
 * makes the bands unable to cross. `below` is the same-pane specs that precede this one, so the
 * DECLARED order is the stack order.
 *
 * The value the chart then holds is cumulative and is NOT what the legend may print; every
 * readout re-reads `spec.points` for the series' own value. See `ownValueAt`.
 */
export function stackedPoints(
  spec: MetricSeriesSpec,
  below: MetricSeriesSpec[],
): ({ time: UTCTimestamp; value: number } | { time: UTCTimestamp })[] {
  // Two running totals per bucket, one per sign: a diverging stack (coverage vs par, skew) grows
  // up from zero with its positives and down with its negatives, so a bar never covers a
  // neighbour of the other sign.
  const base = { pos: new Map<number, number>(), neg: new Map<number, number>() };
  if (spec.stack) {
    for (const other of below) {
      for (const p of other.points) {
        if (p.v == null || !Number.isFinite(p.v)) continue;
        const side = p.v < 0 ? base.neg : base.pos;
        side.set(p.t, (side.get(p.t) ?? 0) + p.v);
      }
    }
  }
  // A null bucket becomes whitespace, not a dropped point: dropping it would
  // draw a straight line across the gap and invent continuity that is not there.
  const byTime = new Map<number, { time: UTCTimestamp; value?: number }>();
  for (const p of spec.points) {
    const time = Math.floor(p.t / 1000) as UTCTimestamp;
    byTime.set(
      time,
      p.v == null || !Number.isFinite(p.v)
        ? { time }
        : { time, value: p.v + ((p.v < 0 ? base.neg : base.pos).get(p.t) ?? 0) },
    );
  }
  return [...byTime.values()].sort((a, b) => (a.time as number) - (b.time as number)) as (
    | { time: UTCTimestamp; value: number }
    | { time: UTCTimestamp }
  )[];
}

/**
 * Creation order = paint order, and a stacked pane must be painted TOP BAND FIRST.
 *
 * Every area fill, and every histogram bar, runs from its value down to the baseline, and a
 * stacked series' value is the running total, so the last one drawn covers every band beneath it.
 * That is true of bars exactly as it is of bands. Declared order stays the
 * STACK order (`stackedPoints` sums by spec index); only the order the APIs are created in is
 * reversed, and only for panes that stack. Panes that do not keep their declared order, where
 * later-drawn means on top.
 */
export function paintOrder(series: MetricSeriesSpec[]): MetricSeriesSpec[] {
  const byPane = new Map<number, MetricSeriesSpec[]>();
  for (const s of series) {
    const key = s.pane ?? 0;
    const group = byPane.get(key);
    if (group) group.push(s);
    else byPane.set(key, [s]);
  }
  const out: MetricSeriesSpec[] = [];
  for (const group of byPane.values()) {
    // A stacked pane paints its stack top band first; a series that is NOT part of it (a dashed
    // target over the bands) is painted last, on top of them, not under their opaque fills.
    if (!group.some((s) => s.stack)) out.push(...group);
    else
      out.push(
        ...[...group.filter((s) => s.stack || !s.dashed)].reverse(),
        ...group.filter((s) => !s.stack && s.dashed),
      );
  }
  return out;
}

/**
 * A series' OWN value at a bucket time (ms), or null.
 *
 * The single source for every readout. A stacked series is DRAWN at its running total, so reading
 * the value back off the chart would print the total under each label and every stacked legend
 * number would be wrong, larger the further up the stack you look.
 */
export function ownValueAt(spec: MetricSeriesSpec, tMs: number): number | null {
  // Compared at SECOND resolution: the chart is fed `floor(t / 1000)` and the crosshair hands
  // that back multiplied out, so a bucket whose ms are not a round second would never match.
  const sec = Math.floor(tMs / 1000);
  for (const p of spec.points) {
    if (Math.floor(p.t / 1000) !== sec) continue;
    return p.v != null && Number.isFinite(p.v) ? p.v : null;
  }
  return null;
}

/**
 * The bucket the legend reports at rest: the LAST one this pane actually observed.
 *
 * Not simply the last bucket. A stacked pane fills every bucket with a truthful 0 for the
 * categories that saw nothing, so a trailing bucket in which the whole pane was quiet prints a
 * row of zeros under labels whose bands plainly have height. The last bucket with any activity is
 * the honest "latest" reading, and a category that was genuinely 0 there still prints 0.
 */
export function latestActiveTime(series: MetricSeriesSpec[]): number | null {
  const totals = new Map<number, number>();
  for (const s of series)
    for (const p of s.points)
      if (p.v != null && Number.isFinite(p.v))
        totals.set(p.t, (totals.get(p.t) ?? 0) + Math.abs(p.v));
  let best: number | null = null;
  for (const [t, sum] of totals) if (sum > 0 && (best == null || t > best)) best = t;
  // Every bucket quiet (or a single all-zero series): fall back to the last bucket we have.
  if (best == null) for (const [t] of totals) if (best == null || t > best) best = t;
  return best;
}

/** What a legend label reads at rest: the spec's own `resting` (the back's window figure) when it
 *  has one, else its value in the pane's latest active bucket `at`. */
export function restingValue(spec: MetricSeriesSpec, at: number | null): number | null {
  if (spec.resting !== undefined) return spec.resting;
  return at == null ? null : ownValueAt(spec, at);
}

/** Height of an axis from its visible range, or `fallback` when the axis has no range yet. `read`
 *  throws while the scale is not attached (a legend can format before its series is), which reads as
 *  "no range". */
export function scaleSpan(
  read: () => { from: number; to: number } | null | undefined,
  fallback?: number,
): number | undefined {
  let r: { from: number; to: number } | null | undefined = null;
  try {
    r = read();
  } catch {
    /* not attached yet: the fallback */
  }
  return r ? r.to - r.from : fallback;
}

/** The span of the axis a series is drawn on (union of every series sharing that price scale), `fallback` until it has a range. */
export function seriesSpan(
  spec: { id: string; scale?: 'right' | 'left' | 'hidden'; pane?: number },
  priceScale: (scaleId: string, pane: number) => { getVisibleRange(): { from: number; to: number } | null | undefined } | undefined,
  fallback: ReadonlyMap<string, number>,
): number | undefined {
  const id = spec.scale === 'hidden' ? `hidden:${spec.id}` : (spec.scale ?? 'right');
  return scaleSpan(() => priceScale(id, spec.pane ?? 0)?.getVisibleRange(), fallback.get(spec.id));
}

/** Time grid of one chart: the sorted, de-duplicated bucket times of all its series, in seconds.
 *  LWC's logical index IS the position in this list. `barSec` = typical spacing (median), used to
 *  extrapolate beyond either end. */
export interface TimeExtent {
  times: number[];
  barSec: number;
}

/** Grid of a set of bucket times (ms). Null when there are none. */
export function timeGrid(timesMs: Iterable<number>): TimeExtent | null {
  const times = [...new Set([...timesMs].map((t) => Math.floor(t / 1000)))].sort((a, b) => a - b);
  if (times.length === 0) return null;
  const gaps = times
    .slice(1)
    .map((t, i) => t - times[i]!)
    .sort((a, b) => a - b);
  return { times, barSec: gaps.length ? gaps[Math.floor(gaps.length / 2)]! : 60 };
}

/**
 * Group zoom/pan sync works in LOGICAL (bar-index) space on the source chart and re-expresses the
 * window in time through that chart's own grid, so a peer mirrors it exactly, whitespace beyond the
 * data included (the time-range API clips to the data and made peers disagree with the active
 * chart). Inside the data the index<->time map interpolates the real, possibly irregular, bucket
 * times; beyond either end it extrapolates at the typical spacing.
 */
export function logicalToSec(l: number, g: TimeExtent): number {
  const { times, barSec } = g;
  const last = times.length - 1;
  if (l <= 0) return times[0]! + l * barSec;
  if (l >= last) return times[last]! + (l - last) * barSec;
  const i = Math.floor(l);
  return times[i]! + (l - i) * (times[i + 1]! - times[i]!);
}
export function secToLogical(t: number, g: TimeExtent): number {
  const { times, barSec } = g;
  const last = times.length - 1;
  if (t <= times[0]!) return (t - times[0]!) / barSec;
  if (t >= times[last]!) return last + (t - times[last]!) / barSec;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) lo = mid;
    else hi = mid;
  }
  return lo + (t - times[lo]!) / (times[hi]! - times[lo]!);
}

/**
 * Crosshair event time -> hovered bucket time in ms epoch, or null.
 *
 * lightweight-charts hands subscribeCrosshairMove a UTCTimestamp (SECONDS) or a
 * BusinessDay object, but every consumer of onHoverTime samples ms-epoch data
 * points (MetricPoint.t is ms; the chart itself divides by 1000 to feed the
 * library). Emitting raw param.time here is how the live-linked tables saw a
 * hover time three orders of magnitude below every bucket, flipped once to
 * their empty state on the first move, and then never followed the crosshair.
 */
export function crosshairTimeMs(time: MouseEventParams['time'] | null): number | null {
  if (time == null) return null;
  const sec = typeof time === 'number' ? time : Number(time); // BusinessDay => NaN
  return Number.isFinite(sec) ? sec * 1000 : null;
}

/** True when there is data and none of it is below zero (null buckets ignored): the axis floor
 *  may then be 0. An empty series says nothing about its sign, so it never floors. */
export const nonNegative = (points: MetricPoint[]) =>
  points.some((p) => p.v != null && Number.isFinite(p.v)) &&
  points.every((p) => p.v == null || p.v >= 0);

/** Bottom inset of a price scale: a scale whose series never dip below zero sits flush on it, so
 *  the inset cannot print a negative tick ("-$500") under a chart of non-negatives. */
export function bottomMargin(series: MetricSeriesSpec[], pane: number, scale: 'right' | 'left') {
  const on = series.filter((s) => (s.pane ?? 0) === pane && (s.scale ?? 'right') === scale);
  return on.length > 0 && on.every((s) => nonNegative(s.points)) ? 0.02 : 0.08;
}

/** Legend value spans by series id. Ids can carry visitor telemetry (device/browser dim keys), so
 *  they are matched as data, never spliced into a selector a quote or bracket would break. */
export function legendValueNodes(el: ParentNode): Map<string, HTMLElement> {
  const nodes = new Map<string, HTMLElement>();
  for (const n of el.querySelectorAll<HTMLElement>('[data-value]')) {
    const id = n.dataset.value;
    if (id != null) nodes.set(id, n);
  }
  return nodes;
}

/**
 * Visible y-range of a filled series that is NOT anchored at zero (`zeroBase: false`): the data's own
 * min/max padded by 10% of the span each side, so a daily wobble fills the plot instead of hugging a
 * line at the top. A flat series (span ~ 0) is padded by 1% of its level instead, never a degenerate
 * range. `nonNeg` keeps the floor at 0 so no "-$500" tick appears under non-negative data.
 */
export function paddedRange(min: number, max: number, nonNeg: boolean): { min: number; max: number } {
  const span = max - min;
  const pad = span > Math.abs(max) * 1e-6 ? span * 0.1 : Math.abs(max) * 0.01 || 1;
  const lo = min - pad;
  return { min: nonNeg ? Math.max(0, lo) : lo, max: max + pad };
}

/** Underwater curve of an equity series: each point's drawdown from the running peak as a ratio <= 0 (-0.12 = 12% below the high).
 *  Gaps (null) stay gaps and do not reset the peak. */
export function underwater(points: readonly MetricPoint[]): MetricPoint[] {
  let peak = -Infinity;
  return points.map((p) => {
    if (p.v == null || !Number.isFinite(p.v) || p.v <= 0) return { ...p, v: null };
    peak = Math.max(peak, p.v);
    return { ...p, v: p.v / peak - 1 };
  });
}
