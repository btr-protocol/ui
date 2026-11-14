/**
 * MetricChart: the metrics-page time-series chart.
 *
 * Same library and conventions as the swap price chart: lightweight-charts,
 * transparent background, no gridlines, house crosshair, and the same
 * `layout.panes.separatorColor` token. See usePriceChartEngine.ts.
 *
 * Every series carries a last-value axis label and a dashed line at that value,
 * the treatment the swap chart gives last price and mid.
 *
 * `range` pins the time scale to the window the tab queried, so the charts
 * stacked in a column share one x axis without any cross-chart sync: fitContent
 * would instead give each of them the extent of its own first and last non-null
 * bucket, and those differ per metric.
 *
 * The chart fills its container via autoSize: it never sets a pixel width, so a
 * metric cell can never grow an inner scrollbar.
 */

import { NUMERIC_FONT_FAMILY, SCALE_ON, scrollOn, tickMarkFormatter, timeLabel } from '../lib/chart';
import { cn } from '../lib/cn';
import { Spinner } from '../ui/Spinner';
import { ChartShell } from './ChartShell';
import { chartColors } from './colors';
import {
  adoptChart,
  getTDLC,
  ifChartAlive,
  removeChart,
  useChartDisposed,
  whenHostReady,
} from './tdlc';
import type { IChartApi, ISeriesApi, MouseEventParams, UTCTimestamp } from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createGesture } from './gesture';
import { SERIES_HIGHLIGHT, useSeriesHover } from './SeriesHover';
import {
  type MetricPaneSpec,
  type MetricSeriesSpec,
  type TimeExtent,
  bottomMargin,
  crosshairTimeMs,
  formatter,
  latestActiveTime,
  legendText,
  legendValueNodes,
  logicalToSec,
  nonNegative,
  paddedRange,
  ownValueAt,
  paintOrder,
  restingValue,
  seriesSpan,
  secToLogical,
  seriesPaint,
  stackedPoints,
  timeGrid,
  trimZeros,
} from './metricChartMath';
export { underwater } from './metricChartMath';

/** Cross-chart time-range + crosshair sync for metrics panes that share a syncId. */
type SyncListener = {
  applyRange: (from: number, to: number) => void;
  applyCrosshair: (time: number | null) => void;
};
const syncBuses = new Map<string, Set<SyncListener>>();

/** Last range broadcast per group: a peer whose first payload lands after the gesture adopts it. */
const groupRanges = new Map<string, { from: number; to: number }>();

/** Put the crosshair of every chart in a sync group on the bucket holding `tMs` (null: back to the
 *  resting last-point highlight). Lets a table row point at its chart date. */
export function highlightSyncTime(id: string, tMs: number | null): void {
  const t = tMs == null ? null : Math.floor(tMs / 1000);
  for (const peer of groupBus(id)) peer.applyCrosshair(t);
}

function groupBus(id: string): Set<SyncListener> {
  return syncBuses.get(id) ?? new Set();
}

function syncBus(id: string): Set<SyncListener> {
  let set = syncBuses.get(id);
  if (!set) {
    set = new Set();
    syncBuses.set(id, set);
  }
  return set;
}

export {
  axisDecimals,
  crosshairTimeMs,
  formatter,
  latestActiveTime,
  legendValueNodes,
  restingValue,
  ownValueAt,
  stackedPoints,
} from './metricChartMath';
export type {
  MetricPaneSpec,
  MetricPoint,
  MetricSeriesSpec,
  MetricSeriesType,
  MetricValueFormat,
  TimeExtent,
} from './metricChartMath';

export function MetricChart({
  title,
  watermark = true,
  series,
  panes = [{}],
  height,
  loading = false,
  emptyMessage = 'No data in range',
  actions,
  legend = true,
  range,
  timeAxis = true,
  syncId,
  onHoverTime,
  onViewportChange,
  className,
  priceTags = true,
}: {
  title?: string;
  /** The title also as a ghost watermark behind the plot (the front's metrics charts do). `false`: the legend heading only. */
  watermark?: boolean;
  series: MetricSeriesSpec[];
  panes?: MetricPaneSpec[];
  /** Standalone use. Inside MetricsGrid the cell owns the height. */
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  actions?: preact.ComponentChildren;
  /** Value tags on the price axis (last value + crosshair). `false` where a header already reads the value and the tag would
   *  overprint the axis tick labels (dense value-table panels). Read at mount: change it with the chart's key. */
  priceTags?: boolean;
  /** Floating legend chips over the plot. `false` when the legend lives in a value table (ChartPanel). */
  legend?: boolean;
  /** Queried window, in ms. Pins the x axis so stacked charts align. */
  range?: { from: number; to: number };
  /** Stacked charts share one x axis: only the bottom one draws it. */
  timeAxis?: boolean;
  /** Shared group id: pans/zooms/crosshair stay aligned across sibling charts. */
  syncId?: string;
  /** Crosshair bucket time (ms) while the cursor is over data; null on leave.
   *  Lets a side table live-link to the hovered date. */
  onHoverTime?: (t: number | null) => void;
  /** Visible-range changes the USER caused (pan/zoom/peer sync), debounced. The virtual
   *  data loader listens here: it refetches the newly visible span at its own grain. */
  onViewportChange?: (fromMs: number, toMs: number) => void;
  className?: string;
}) {
  const { active, setActive, bindings } = useSeriesHover();
  const hoverRef = useRef(setActive);
  hoverRef.current = setActive;
  const matches = (s: MetricSeriesSpec) =>
    active?.seriesId ? active.seriesId === s.id : active?.key === (s.rowKey ?? s.id);
  const hasMatch = active != null && series.some(matches);
  useEffect(() => {
    if (active && active.source !== 'row' && !hasMatch) {
      for (const channel of ['pointer', 'focus', 'touch'] as const)
        setActive(null, active.source, channel);
    }
  }, [active, hasMatch]);
  const disposed = useChartDisposed();
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // Create is async. Series/data/hover effects that ran while chartRef was null
  // must re-run after createChart, or the canvas stays blank forever.
  const [chartEpoch, setChartEpoch] = useState(0);
  const seriesRef = useRef<Map<string, ISeriesApi<'Area' | 'Line' | 'Histogram'>>>(new Map());
  const legendRef = useRef<HTMLDivElement>(null);
  // Height of each series' autoscaled axis range, written by its autoscaleInfoProvider on every
  // scale pass. Fallback for `spanOf` until the price scale has a range of its own.
  const spanRef = useRef<Map<string, number>>(new Map());
  // The span the tick / legend / crosshair decimals follow (`axisDecimals`): the height of the price
  // scale the series is drawn on. That is the union of every series on a shared scale, so a flat
  // series first on the axis cannot set the decimals for the ticks its neighbours share.
  const spanOf = (spec: MetricSeriesSpec): number | undefined => {
    return seriesSpan(spec, (id, pane) => chartRef.current?.priceScale(id, pane), spanRef.current);
  };
  const fittedRef = useRef(false);
  const syncingRef = useRef(false);
  // Logical range as last applied by us (data push or peer sync). LWC fires its range event after
  // the flag is cleared, so an event matching this snapshot is an echo, not a gesture.
  const snapRef = useRef<{ from: number; to: number } | null>(null);
  const listenerRef = useRef<SyncListener | null>(null);
  // Resting state: with no pointer on the chart the crosshair sits on the LAST bucket, the same
  // one the legend reads. `restingRef` marks that programmatic move so its event is not a hover.
  const restingRef = useRef(false);
  const hoveringRef = useRef(false);
  // Union of all series' bucket times, refreshed with each data push. The sync
  // logic clamps every visible range against this so no chart can be zoomed or
  // panned past the common data window.
  const extentRef = useRef<TimeExtent | null>(null);
  // Specs used by the async series-attach callback: setData must run in THAT
  // turn, not in a sibling effect. React/Preact flushes the data effect in the
  // same commit, while getTDLC().then still has an empty seriesRef.
  const seriesNowRef = useRef(series);
  // Pane 0's top inset follows the legend height (`fit`); pushData re-applies it with the bottom.
  const topRef = useRef(0.12);
  seriesNowRef.current = series;
  const rangeNowRef = useRef(range);
  rangeNowRef.current = range;

  // Seed every legend label with its series' latest value whenever the data identity changes,
  // so a freshly loaded chart shows numbers at rest, not empty spans.
  const dataKey = useMemo(
    () =>
      series
        .map((sp) => `${sp.id}:${sp.points.length}:${sp.points.at(-1)?.t ?? 0}:${sp.resting ?? ''}`)
        .join('|'),
    [series],
  );

  // The legend floats over the plot and wraps from `sm` up, so a pane with several series puts a
  // second and third row on the bars. Keep the top pane's plot below the legend: its price-scale
  // top margin follows the legend's measured height (never less than the 12% default).
  useEffect(() => {
    const el = legendRef.current;
    const chart = chartRef.current;
    if (!el || !chart || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      const h = chart.panes()[0]?.getHeight() ?? 0;
      if (h <= 0) return;
      const top = Math.min(0.6, Math.max(0.12, (el.offsetHeight + 14) / h));
      topRef.current = top;
      for (const id of ['right', 'left'] as const)
        chart.priceScale(id, 0).applyOptions({
          scaleMargins: { top, bottom: bottomMargin(seriesNowRef.current, 0, id) },
        });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chartEpoch, dataKey]);
  useEffect(() => {
    const el = legendRef.current;
    if (!el) return;
    // One bucket for the whole pane, so the labels are a readable SLICE of one moment rather than
    // each series' own last non-null point, which is a different date per label.
    const at = latestActiveTime(series);
    const nodes = legendValueNodes(el);
    for (const spec of series) {
      const node = nodes.get(spec.id);
      if (!node) continue;
      let raw = restingValue(spec, at);
      if (raw == null && spec.resting === undefined)
        for (let i = spec.points.length - 1; i >= 0; i--) {
          const v = spec.points[i]?.v;
          if (v != null && Number.isFinite(v)) {
            raw = v;
            break;
          }
        }
      const pane = panes[spec.pane ?? 0] ?? {};
      const fmt =
        spec.format ??
        (spec.scale === 'left' ? pane.leftFormat : pane.format) ??
        pane.format ??
        'usd';
      node.textContent = raw == null ? '' : legendText(fmt, spanOf(spec), raw);
    }
  }, [dataKey, panes]);

  const hasData = useMemo(
    () => series.some((s) => s.points.some((p) => p.v != null && Number.isFinite(p.v))),
    [series],
  );

  const restCrosshair = (chart: IChartApi) => {
    const specs = seriesNowRef.current;
    const at = latestActiveTime(specs);
    const first = seriesRef.current.values().next().value;
    if (at == null || !first) return;
    restingRef.current = true;
    syncingRef.current = true;
    try {
      chart.setCrosshairPosition(NaN, Math.floor(at / 1000) as UTCTimestamp, first);
    } catch {
      /* series empty */
    } finally {
      syncingRef.current = false;
      restingRef.current = false;
    }
  };

  /** Paint whatever `seriesNowRef` currently holds onto attached APIs. Must run in
   *  the same turn as `addSeries`: a sibling effect races `getTDLC().then` and
   *  leaves a live canvas with no points. */
  const pushData = (chart: IChartApi) => {
    const specs = seriesNowRef.current;
    let points = 0;
    const hadExtent = extentRef.current != null;
    extentRef.current = timeGrid(specs.flatMap((sp) => sp.points.map((p) => p.t)));
    // A data update moves the logical window under a stationary pointer: it is not a gesture, so
    // it must not be broadcast to the group.
    syncingRef.current = true;
    try {
      specs.forEach((spec, i) => {
        const api = seriesRef.current.get(spec.id);
        if (!api) return;
        const below = specs.slice(0, i).filter((o) => (o.pane ?? 0) === (spec.pane ?? 0));
        const data = stackedPoints(spec, below);
        points += data.length;
        api.setData(data);
      });
      // Sign is read from the data NOW, never at attach: a chart mounts empty and a signed pane
      // (coverage vs par, skew) must not be floored at zero when its first negative bucket lands.
      for (const spec of specs) {
        const scale = spec.scale ?? 'right';
        if (scale === 'hidden' || !seriesRef.current.has(spec.id)) continue;
        const pane = spec.pane ?? 0;
        chart.priceScale(scale, pane).applyOptions({
          scaleMargins: {
            top: pane === 0 ? topRef.current : 0.12,
            bottom: bottomMargin(specs, pane, scale),
          },
        });
      }
      snapRef.current = chart.timeScale().getVisibleLogicalRange();
    } finally {
      syncingRef.current = false;
    }
    if (!hoveringRef.current && points > 0) restCrosshair(chart);
    const group = syncId ? groupRanges.get(syncId) : undefined;
    if (!hadExtent && extentRef.current && group && points > 0 && listenerRef.current) {
      listenerRef.current.applyRange(group.from, group.to);
      fittedRef.current = true;
      return;
    }
    if (fittedRef.current || points === 0) return;
    const r = rangeNowRef.current;
    try {
      syncingRef.current = true;
      const ext = extentRef.current;
      if (r && ext) {
        // Whitespace room on the left (logical range: the time-range API clips to the data) so the first tick label,
        // centred on its tick, is not cut at the edge.
        const from = Math.max(secToLogical(r.from / 1000, ext), 0); // never before the data: a short history fits, as the time-range API did
        const to = secToLogical(r.to / 1000, ext);
        const w = Math.max(chart.timeScale().width(), 1);
        chart.timeScale().setVisibleLogicalRange({ from: from - (to - from) * Math.min(0.08, 36 / w), to });
      } else if (r) {
        chart.timeScale().setVisibleRange({
          from: (r.from / 1000) as UTCTimestamp,
          to: (r.to / 1000) as UTCTimestamp,
        });
      } else {
        chart.timeScale().fitContent();
      }
      fittedRef.current = true;
      snapRef.current = chart.timeScale().getVisibleLogicalRange();
    } catch {
      /* empty series: first real payload will fit */
    } finally {
      syncingRef.current = false;
    }
  };

  // Chart is created once. Series are reconciled separately so a data refresh
  // never tears down and rebuilds the canvas (that caused flicker on the swap page).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const host = await whenHostReady(
        () => hostRef.current,
        () => cancelled,
      );
      if (!host || cancelled || chartRef.current) return;
      const { createChart, ColorType } = await getTDLC();
      if (cancelled || chartRef.current) return;
      const colors = chartColors();
      const chart = adoptChart(
        cancelled,
        createChart(host, {
          autoSize: true,
          // Cumulative stacks depend on paint order, including while hovered.
          hoveredSeriesOnTop: false,
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: colors.chartText,
            fontFamily: NUMERIC_FONT_FAMILY,
            // Axis type drives the price-scale WIDTH: the scale sizes to its widest label, so
            // `minimumWidth` is only a floor and cannot shrink it. 10px is the same rung as the
            // chart's own captions.
            fontSize: 10,
            attributionLogo: false,
            panes: {
              separatorColor: colors.chartBorder,
              separatorHoverColor: colors.chartBorder,
              enableResize: false,
            },
          },
          localization: { timeFormatter: (time: number) => timeLabel(time) },
          grid: { vertLines: { visible: false }, horzLines: { visible: false } },
          timeScale: {
            borderColor: colors.chartBorder,
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 4,
            tickMarkFormatter: (time: number, type: number) => tickMarkFormatter(time, type),
            visible: timeAxis,
          },
          rightPriceScale: {
            borderColor: colors.chartBorder,
            textColor: colors.chartText,
            visible: true,
            mode: panes[0]?.log ? 1 : 0, // PriceScaleMode.Logarithmic
            scaleMargins: { top: 0.12, bottom: 0.08 },
            // The scale reserved 64px and the labels never reached its right edge - dead gutter
            // on desktop, a real bite out of the plot at 320px. 44px still fits "$450.00K".
            minimumWidth: 44,
          },
          leftPriceScale: {
            borderColor: colors.chartBorder,
            textColor: colors.chartText,
            visible: false,
            scaleMargins: { top: 0.12, bottom: 0.08 },
            minimumWidth: 44,
          },
          crosshair: {
            mode: 0,
            vertLine: { labelBackgroundColor: colors.bg2, color: colors.fg2 },
            horzLine: { labelBackgroundColor: colors.bg2, color: colors.fg2, labelVisible: priceTags },
          },
          handleScroll: scrollOn(),
          handleScale: { ...SCALE_ON },
        }),
      );
      if (!chart) return;
      chartRef.current = chart;
      setChartEpoch((n) => n + 1);
    })();
    return () => {
      cancelled = true;
      removeChart(chartRef.current);
      chartRef.current = null;
      seriesRef.current.clear();
    };
  }, []);

  // Reconcile series: rebuild only when the series identity set changes.
  const shape = series
    .map(
      (s) =>
        `${s.id}:${s.type}:${s.pane ?? 0}:${s.scale ?? 'right'}:${s.dashed ? 'd' : ''}:${s.extent ? 'e' : ''}`,
    )
    .join('|');
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    let cancelled = false;
    getTDLC().then(({ AreaSeries, HistogramSeries, LineSeries }) => {
      if (cancelled || disposed.current) return;
      ifChartAlive(disposed, () => {
        for (const s of seriesRef.current.values()) chart.removeSeries(s);
      });
      if (disposed.current) return;
      seriesRef.current.clear();
      chart.applyOptions({
        leftPriceScale: { visible: series.some((s) => s.scale === 'left' && !s.extent) },
      });

      for (const spec of paintOrder(series)) {
        const paneIndex = spec.pane ?? 0;
        const pane = panes[paneIndex] ?? {};
        const scaleId = spec.scale ?? 'right';
        // A per-series format wins: the crosshair label must agree with the legend
        // chip, which already reads spec.format.
        const fmtKind =
          spec.format ??
          (scaleId === 'left' ? pane.leftFormat : pane.format) ??
          pane.format ??
          'usd';
        // Built per call: the span is only known once the series has autoscaled, and it changes
        // with every zoom.
        const fmt = (v: number) => formatter(fmtKind, spanOf(spec))(v);
        // Last-value axis label plus a dashed rule at that value, the treatment the
        // swap chart gives last price and mid.
        //
        // NOT for a STACKED series. The library draws that label at the value it plotted, which
        // for a stack is the RUNNING TOTAL, so an axis tag in South America's colour would read
        // the sum of every band below it plus itself, and eight near-identical tags would stack up
        // the axis each asserting a number that is not its series'. Same class of bug as printing
        // the cumulative value in the legend (`ownValueAt` exists to stop that); the legend is the
        // honest per-series readout and it stays live at rest and under the crosshair.
        const stacked = spec.stack === true;
        const common = {
          ...seriesPaint(spec, 1, spec.fade ? chartColors().bg1 : undefined),
          priceScaleId: scaleId === 'hidden' ? `hidden:${spec.id}` : scaleId,
          lastValueVisible: priceTags && !stacked && !spec.extent && spec.scale !== 'hidden',
          priceLineVisible: !stacked && !spec.extent && spec.scale !== 'hidden',
          priceLineWidth: 1 as const,
          priceLineStyle: 2,
          priceFormat: { type: 'custom' as const, formatter: (v: number) => trimZeros(fmt(v)), minMove: 0.00000001 },
        };
        // Clamp the autoscale, never the data. autoScaleProvider intersects the
        // library's own range with the pane's bounds, so a calm pane still fits
        // itself and only an outlier-driven range is reined in.
        const b = scaleId === 'right' ? pane.bounds : undefined;
        // A series that never goes below zero must not open the axis below it: the library pads
        // the autoscale, which read as a "-$500" floor under a volume chart of non-negatives. The
        // sign is read from the live spec on every autoscale, not frozen at attach.
        const bounded =
          b || scaleId !== 'hidden'
            ? {
                autoscaleInfoProvider: (
                  orig: () => { priceRange: { minValue: number; maxValue: number } } | null,
                ) => {
                  const r = orig();
                  if (!r) return r;
                  const lo = b ? Math.max(r.priceRange.minValue, b[0]) : r.priceRange.minValue;
                  const live = seriesNowRef.current.find((x) => x.id === spec.id);
                  const floor = scaleId !== 'hidden' && live != null && nonNegative(live.points);
                  // An area opted out of the zero base reads its own min/max, padded (the fill still
                  // runs to the bottom of the plot).
                  const out =
                    spec.type === 'area' && spec.zeroBase === false && scaleId !== 'hidden'
                      ? (() => {
                          const pr = paddedRange(r.priceRange.minValue, r.priceRange.maxValue, floor);
                          return {
                            ...r,
                            priceRange: {
                              minValue: b ? Math.max(pr.min, b[0]) : pr.min,
                              maxValue: b ? Math.min(pr.max, b[1]) : pr.max,
                            },
                          };
                        })()
                      : {
                          ...r,
                          priceRange: {
                            // A filled series is read against its baseline: zero-based (a 5% floor keeps the $0 tick off the time axis).
                            minValue: floor
                              ? spec.type === 'line' || spec.zeroBase === false
                                ? Math.max(lo, 0)
                                : -r.priceRange.maxValue * 0.05
                              : lo,
                            maxValue: b ? Math.min(r.priceRange.maxValue, b[1]) : r.priceRange.maxValue,
                          },
                        };
                  // The range the axis will draw: its height sizes the tick decimals (`spanOf`).
                  spanRef.current.set(spec.id, out.priceRange.maxValue - out.priceRange.minValue);
                  return out;
                },
              }
            : {};
        Object.assign(common, bounded);
        // Underwater curve: values <= 0, the axis tops out at 0 and the fill runs from the curve up to that line (an inverted area).
        if (spec.invert)
          Object.assign(common, {
            autoscaleInfoProvider: (orig: () => { priceRange: { minValue: number; maxValue: number } } | null) => {
              const r = orig();
              return r ? { ...r, priceRange: { minValue: r.priceRange.minValue, maxValue: 0 } } : r;
            },
          });
        const api =
          spec.type === 'histogram'
            ? chart.addSeries(
                HistogramSeries,
                {
                  ...common,
                  // A STACKED bar is opaque for the same reason a stacked band is: every bar is
                  // drawn from the baseline up to its running total, so a translucent one tints
                  // every segment beneath it and the stack reads as overlapping bars. Paint order
                  // (see `paintOrder`) is what keeps the segments apart, and it needs them opaque.
                  // An unstacked histogram stays a wash: it sits BEHIND the lines it annotates.
                },
                paneIndex,
              )
            : spec.type === 'area'
              ? chart.addSeries(
                  AreaSeries,
                  {
                    ...common,
                    // A stacked band is a SOLID slab, not a wash: its fill runs to the baseline
                    // over the band below it, so a translucent one tints everything under it and
                    // the stack reads as overlapping curves. The bands are kept apart by paint
                    // order (see `paintOrder`), which needs them opaque to work at all.
                    lineWidth: 2,
                    lineStyle: spec.dashed ? 2 : 0,
                    invertFilledArea: spec.invert === true,
                  },
                  paneIndex,
                )
              : chart.addSeries(
                  LineSeries,
                  {
                    ...common,
                    lineWidth: 2,
                    lineStyle: spec.dashed ? 2 : 0,
                  },
                  paneIndex,
                );
        if (spec.scale === 'hidden') {
          // The overlay scale exists only once the series does. Hidden and full-height:
          // the series autoscales against the whole pane, never a default inset.
          chart.priceScale(`hidden:${spec.id}`).applyOptions({
            visible: false,
            scaleMargins: { top: 0.05, bottom: 0.05 },
          });
        }
        seriesRef.current.set(spec.id, api);
      }

      // Histograms are created before areas within a pane so the bars sit behind.
      const apis = chart.panes();
      panes.forEach((p, i) => {
        if (p.stretch != null && apis[i]) apis[i].setStretchFactor(p.stretch);
      });
      fittedRef.current = false;
      pushData(chart);
      emphasisRef.current();
    });
    return () => {
      cancelled = true;
    };
  }, [shape, panes.length, chartEpoch]);

  // Later payloads (poll, zoom grain). First paint is `pushData` inside series attach.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || seriesRef.current.size === 0) return;
    pushData(chart);
  }, [series, range, chartEpoch]);

  // Repaint emphasis without rebuilding series or changing data/axis geometry.
  const applyEmphasis = () => {
    for (const spec of series) {
      seriesRef.current
        .get(spec.id)
        ?.applyOptions(seriesPaint(spec, hasMatch && !matches(spec) ? 0.5 : 1, chartColors().bg1));
    }
  };
  const emphasisRef = useRef(applyEmphasis);
  emphasisRef.current = applyEmphasis;
  useEffect(applyEmphasis, [active, series, chartEpoch]);

  // Hover readout + optional cross-chart sync (visible range + crosshair time).
  const latest = useRef({ series, panes });
  latest.current = { series, panes };
  const onHoverTimeRef = useRef(onHoverTime);
  onHoverTimeRef.current = onHoverTime;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const lastEmitRef = useRef<{ from: number; to: number } | null>(null);
  const userTouchedRef = useRef(false);
  // Any wheel / pointer / touch on the plot: only then does a range change count as a gesture to mirror to the group. Layout-driven changes
  // (first fit, resize, a peer's first data) are not gestures, and broadcasting them collapsed every pane to the default window.
  // Dropped again once the input stops (`createGesture`), so the range changes that follow are layout, not gestures.
  const gestureRef = useRef(createGesture());
  useEffect(() => {
    const g = gestureRef.current;
    const up = () => g.release();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      g.dispose();
    };
  }, []);
  const rafRef = useRef<number | null>(null);
  const pendingTimeRef = useRef<MouseEventParams['time'] | null>(null);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handler = (param: MouseEventParams) => {
      if (restingRef.current) return;
      hoveringRef.current = param.time != null && param.point != null;
      // rAF throttle: hoverT drives React sort+bars, 60fps → 1 React commit/frame
      pendingTimeRef.current = param.time;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (disposed.current) return;
          onHoverTimeRef.current?.(crosshairTimeMs(pendingTimeRef.current));
        });
      }
      const { series: specs, panes: paneSpecs } = latest.current;
      let hit = specs.find((s) => seriesRef.current.get(s.id) === param.hoveredSeries);
      // Histogram hit ranges overlap because each cumulative bar starts at zero.
      // Resolve the visible segment, rather than selecting the whole stack's top bar.
      if (
        param.point &&
        param.time != null &&
        (!hit || hit.type === 'histogram') &&
        specs.some((s) => s.type === 'histogram' && s.stack)
      ) {
        const pane = param.paneIndex ?? 0;
        const y = param.point.y;
        const time = crosshairTimeMs(param.time);
        hit =
          specs.find((s) => {
            if (s.type !== 'histogram' || !s.stack || (s.pane ?? 0) !== pane) return false;
            const api = seriesRef.current.get(s.id);
            const point = api && param.seriesData.get(api);
            const own = time == null ? null : ownValueAt(s, time);
            if (!api || !point || !('value' in point) || own == null || own === 0) return false;
            const top = api.priceToCoordinate(point.value);
            const base = api.priceToCoordinate(point.value - own);
            return (
              top != null &&
              base != null &&
              y >= Math.min(top, base) - 1 &&
              y <= Math.max(top, base) + 1
            );
          }) ?? hit;
      }
      hoverRef.current(hit ? { key: hit.rowKey ?? hit.id, seriesId: hit.id } : null, 'plot');
      const el = legendRef.current;
      if (!el) return;
      const leaving = param.time == null;
      const nodes = legendValueNodes(el);
      for (const spec of specs) {
        const node = nodes.get(spec.id);
        if (!node) continue;
        const api = seriesRef.current.get(spec.id);
        const point = api && param.seriesData ? param.seriesData.get(api) : undefined;
        const pane = paneSpecs[spec.pane ?? 0] ?? {};
        const fmt =
          spec.format ??
          (spec.scale === 'left' ? pane.leftFormat : pane.format) ??
          pane.format ??
          'usd';
        // The value ON the chart is the running total for a stacked series. Re-read the spec for
        // this series' OWN value at the hovered bucket: printing what is plotted would put the
        // cumulative sum under every stacked label.
        const hoveredMs = crosshairTimeMs(param.time);
        let raw =
          hoveredMs != null
            ? ownValueAt(spec, hoveredMs)
            : point && 'value' in point
              ? (point.value as number)
              : null;
        // Cursor off the data (pane miss or mouse-out): fall back to the pane's latest active
        // bucket, the same reading the legend shows at rest, never an empty label.
        if (raw == null && leaving) {
          const at = latestActiveTime(specs);
          raw = restingValue(spec, at);
        }
        node.textContent = raw == null ? '' : legendText(fmt, spanOf(spec), raw);
      }
      if (param.time == null) restCrosshair(chart);
      if (syncId && !syncingRef.current) {
        const t = param.time != null ? (typeof param.time === 'number' ? param.time : null) : null;
        for (const peer of syncBus(syncId)) {
          if (peer === listener) continue;
          peer.applyCrosshair(t);
        }
      }
    };
    const onRange = () => {
      // Report every user-driven range immediately so the idle gate can reset
      // while the pointer is still moving. Grain upgrade runs after settle.
      if (!syncingRef.current && userTouchedRef.current && onViewportChangeRef.current) {
        const vr = chart.timeScale().getVisibleRange();
        if (vr) {
          const from = Math.floor((vr.from as number) / 60) * 60_000;
          const to = Math.ceil((vr.to as number) / 60) * 60_000;
          const last = lastEmitRef.current;
          if (!last || last.from !== from || last.to !== to) {
            lastEmitRef.current = { from, to };
            onViewportChangeRef.current(from, to);
          }
        }
      }
      // Mirror the exact visible window to the group (see `logicalToSec`): no clamping, so a
      // peer shows the same span even beyond its own data.
      if (!syncId || syncingRef.current || !gestureRef.current.active) return;
      const lr = chart.timeScale().getVisibleLogicalRange();
      const ext = extentRef.current;
      if (!lr || !ext) return;
      const snap = snapRef.current;
      if (snap && Math.abs(snap.from - lr.from) < 0.01 && Math.abs(snap.to - lr.to) < 0.01) return;
      snapRef.current = { from: lr.from, to: lr.to };
      const from = logicalToSec(lr.from, ext);
      const to = logicalToSec(lr.to, ext);
      groupRanges.set(syncId, { from, to });
      for (const peer of syncBus(syncId)) {
        if (peer === listener) continue;
        peer.applyRange(from, to);
      }
    };
    const listener: SyncListener = {
      applyRange: (from, to) => {
        const c = chartRef.current;
        const ext = extentRef.current;
        if (!c || !ext) return;
        const next = { from: secToLogical(from, ext), to: secToLogical(to, ext) };
        // Skip no-op echoes: a peer applying our own broadcast back must not ping-pong the group.
        const cur = c.timeScale().getVisibleLogicalRange();
        if (cur && Math.abs(cur.from - next.from) < 0.01 && Math.abs(cur.to - next.to) < 0.01) {
          return;
        }
        syncingRef.current = true;
        try {
          c.timeScale().setVisibleLogicalRange(next);
          snapRef.current = c.timeScale().getVisibleLogicalRange();
        } catch {
          /* empty chart */
        }
        syncingRef.current = false;
      },
      applyCrosshair: (time) => {
        const c = chartRef.current;
        if (!c) return;
        // The legend of a PEER pane follows the linked crosshair: the library's move event does not carry the peer's own values.
        const paint = (tMs: number | null) => {
          const el = legendRef.current;
          if (!el) return;
          const nodes = legendValueNodes(el);
          const { series: specs, panes: paneSpecs } = latest.current;
          const at = tMs ?? latestActiveTime(specs);
          for (const spec of specs) {
            const node = nodes.get(spec.id);
            if (!node) continue;
            const pane = paneSpecs[spec.pane ?? 0] ?? {};
            const fmt = spec.format ?? (spec.scale === 'left' ? pane.leftFormat : pane.format) ?? pane.format ?? 'usd';
            const raw = tMs != null ? ownValueAt(spec, tMs) : restingValue(spec, at);
            node.textContent = raw == null ? '' : formatter(fmt)(raw);
          }
        };
        syncingRef.current = true;
        if (time == null) {
          c.clearCrosshairPosition();
          syncingRef.current = false;
          restCrosshair(c);
          paint(null);
          return;
        }
        {
          const first = seriesRef.current.values().next().value;
          if (first) {
            // Snap to the bucket holding the time: a row's event time rarely sits on a bucket.
            const ext = extentRef.current;
            const at = ext ? (ext.times.findLast((x) => x <= time) ?? ext.times[0]!) : time;
            paint(at * 1000);
            try {
              c.setCrosshairPosition(NaN, at as UTCTimestamp, first);
            } catch {
              /* series empty */
            }
          }
        }
        syncingRef.current = false;
      },
    };
    if (syncId) syncBus(syncId).add(listener);
    listenerRef.current = listener;
    chart.subscribeCrosshairMove(handler);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (syncId) syncBus(syncId).delete(listener);
      if (listenerRef.current === listener) listenerRef.current = null;
      ifChartAlive(disposed, () => {
        chart.unsubscribeCrosshairMove(handler);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      });
    };
  }, [syncId, chartEpoch]);

  return (
    <ChartShell
      title={watermark ? title : undefined}
      loading={loading && !hasData}
      loadingTitle="Loading chart"
      empty={!hasData && !loading}
      emptyMessage={emptyMessage}
      watermarkBoxStyle={{ paddingRight: 52 }}
      height={height}
      className={className}
    >
      {/* The chart owns the FULL cell; title and legend float over the canvas,
          top-left, in the house glass chip so lines stay legible under them.
          pointer-events passes through to the crosshair except on actions. */}
      <div
        ref={hostRef}
        className="absolute inset-0 z-raised"
        onWheel={(e) => {
          gestureRef.current.pulse();
          if (e.ctrlKey || e.metaKey) userTouchedRef.current = true;
        }}
        onPointerDown={() => {
          gestureRef.current.press();
          userTouchedRef.current = true;
        }}
        onTouchStart={() => gestureRef.current.pulse()}
        onTouchMove={() => gestureRef.current.pulse()}
        onTouchEnd={() => gestureRef.current.pulse()}
      />
      {/* Legend floats over the plot; the watermark, loading and empty states live in ChartShell. */}
      {/* Legend stays exactly ONE line at every width. It floats OVER the plot, so wrapping is
          not a graceful degradation - at 320px the second and third rows landed on the series
          themselves. `.scroll-x` is the house idiom for this (chart toolbar, wide rows): the
          strip pans instead of growing. The 72px right inset is the price scale
          (`minimumWidth: 44` below, plus its label padding): without it the last legend entry
          printed on top of the top axis label. */}
      <div className="absolute inset-x-0 top-0 z-label flex items-start justify-between gap-3 pl-3 pr-[52px] py-1.5 flex-nowrap pointer-events-none">
        <div
          // Below `sm` this stays ONE panning line: at 320px a wrapped legend put its second and
          // third rows on top of the series. From `sm` up it wraps instead of clipping a label
          // mid-word ("Afric"): a pane with nine categories cannot fit them on one line at any
          // honest font size, and the glass chip grows with the rows so the text stays legible.
          className={cn('flex flex-col min-w-0 rounded-md bg-glass backdrop-blur px-1.5 py-0.5 pointer-events-auto', !legend && 'hidden')}
          ref={legendRef}
        >
          {title && <h3 className="shrink-0 text-sm font-semibold text-fg-0">{title}</h3>}
          <div className="flex items-center gap-x-3 gap-y-0.5 min-w-0 max-sm:flex-nowrap max-sm:scroll-x sm:flex-wrap">
            {series.map((s) => {
              const selected = hasMatch && matches(s);
              return (
                <span
                  key={s.id}
                  data-series={s.id}
                  {...bindings({ key: s.rowKey ?? s.id, seriesId: s.id }, 'legend')}
                  style={{ opacity: hasMatch && !selected ? 0.5 : 1 }}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-fg-2 rounded-sm transition-opacity focus-visible:outline focus-visible:outline-ring',
                    selected && SERIES_HIGHLIGHT,
                  )}
                >
                  {/* The swatch carries the series' TREATMENT, not just its hue: a dashed
                    low-emphasis line and a filled band share a palette entry, and two identical
                    squares would be the only thing on the chart that hides that. */}
                  <span
                    className={cn(
                      'shrink-0',
                      s.dashed ? 'w-3.5 border-t-2 border-dashed' : 'w-2.5 h-2.5 rounded-sm',
                    )}
                    style={{
                      ...(s.dashed ? { borderColor: s.color } : { backgroundColor: s.color }),
                      opacity: s.opacity ?? 1,
                    }}
                  />
                  {s.label}
                  {/* D3: EVERY series label is live - latest value at rest, hovered value under
                  the crosshair. No static min/max ranges; those never moved (the Swaps count). */}
                  {/* The value is hidden below `sm`: the price-scale tag already prints it, in the
                    series colour, at rest AND under the crosshair. Four "EURCB -44.29%" entries
                    cannot share a 320px legend line, four "EURCB" entries can. */}
                  <span
                    data-value={s.id}
                    className="font-numeric text-fg-0 min-w-0 max-sm:hidden"
                  />
                </span>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 shrink-0 rounded-md bg-glass backdrop-blur px-1 py-0.5">
          {/* A first load gets the full skeleton below; only an actual refresh of
              live data earns a spinner, so polls never flash. */}
          {loading && hasData && <Spinner />}
          {actions}
        </div>
      </div>
    </ChartShell>
  );
}
