/** lightweight-charts options and value formatters, verbatim from the btr.markets front metrics
 *  charts (`components/shared/metrics/MetricChart.tsx`, `metricChartMath.ts`, `charts/chartShared.ts`).
 *  No lightweight-charts import: the factory returns plain options the caller hands to `createChart`. */

import { formatCompact } from '@btr-protocol/sdk/utils/format';
import { formatUsd } from './format';

export type ChartValueFormat = 'usd' | 'count' | 'bps' | 'compact';

/** Basis points to at most 2dp: '4 bps', '0.25 bps'. */
export const fmtBps = (v: number) => `${Number(v.toFixed(2))} bps`;

/** A tick that is float noise around zero reads 0, not "0.0₁₄694%". */
const snap0 = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);

/** Axis tick / crosshair label / legend formatter. 'usd' is `formatUsd` (lib/format), the one
 *  magnitude rule shared with the app, so a chart and the tile above it read the same. */
export function chartFormatter(format: ChartValueFormat): (v: number) => string {
  const f = (v: number): string => {
    if (format === 'usd') return formatUsd(v);
    if (format === 'bps') return fmtBps(v);
    if (format === 'count')
      return Math.abs(v) < 1000 ? String(Math.round(v)) : formatCompact(Math.round(v));
    return formatCompact(v);
  };
  return (v) => f(snap0(v));
}

/** Time-axis ticks: lightweight-charts' default prints a bare day number or clock time ("6", "12:17",
 *  "7"), which reads as noise. Day boundaries and months get a short date; the rest the clock.
 *  UTC, like the library's own crosshair label. `type` is lightweight-charts' TickMarkType. */
export function tickMarkFormatter(time: number, type: number, locale = 'en-US'): string {
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hourCycle: 'h23', ...o }).format(new Date(time * 1000));
  if (type === 0) return f({ year: 'numeric' });
  if (type === 1) return f({ month: 'short' });
  if (type === 2) return f({ month: 'short', day: 'numeric' });
  return f({ hour: '2-digit', minute: '2-digit' });
}

/** Crosshair time label, same UTC clock as the ticks: "Nov 6, 12:17". */
export const timeLabel = (time: number, locale = 'en-US') =>
  `${tickMarkFormatter(time, 2, locale)}, ${tickMarkFormatter(time, 3, locale)}`;

export const NUMERIC_FONT_FAMILY =
  '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/** Resolved (canvas-parseable) colours; lightweight-charts takes no CSS variables. */
export interface ChartColors {
  chartText: string; // --chart-text (= --fg-2)
  chartBorder: string; // --border-color
  bg2: string; // --bg-2
  fg2: string; // --fg-2
}

/** Vertical touch gestures belong to the page, including on hybrid mouse/touch devices. */
export const scrollOn = () =>
  ({ mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }) as const;

export const SCALE_ON = { axisPressedMouseMove: true, mouseWheel: true, pinch: true } as const;

const scale = (c: ChartColors, visible: boolean) => ({
  borderColor: c.chartBorder,
  textColor: c.chartText,
  visible,
  scaleMargins: { top: 0.12, bottom: 0.08 },
  // 44px still fits "$450.00K"; a wider gutter bites the plot at 320px.
  minimumWidth: 44,
});

/** The front's `createChart` options: transparent background, 10px mono axis, no gridlines,
 *  house crosshair, 44px right scale. */
export function chartOptions(c: ChartColors, opts: { timeAxis?: boolean } = {}) {
  return {
    autoSize: true,
    hoveredSeriesOnTop: false,
    layout: {
      background: { type: 'solid' as const, color: 'transparent' },
      textColor: c.chartText,
      fontFamily: NUMERIC_FONT_FAMILY,
      fontSize: 10,
      attributionLogo: false,
      panes: { separatorColor: c.chartBorder, separatorHoverColor: c.chartBorder, enableResize: false },
    },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    timeScale: {
      borderColor: c.chartBorder,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 4,
      visible: opts.timeAxis ?? true,
      tickMarkFormatter,
    },
    localization: { timeFormatter: (t: number) => timeLabel(t) },
    rightPriceScale: scale(c, true),
    leftPriceScale: scale(c, false),
    crosshair: {
      mode: 0,
      vertLine: { labelBackgroundColor: c.bg2, color: c.fg2 },
      horzLine: { labelBackgroundColor: c.bg2, color: c.fg2 },
    },
    handleScroll: scrollOn(),
    handleScale: { ...SCALE_ON },
  };
}
