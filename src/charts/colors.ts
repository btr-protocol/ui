import { mix } from './metricChartMath';

/** Resolved (canvas-parseable) theme colours for lightweight-charts, which takes no CSS variables.
 *  Read fresh from the live tokens on every call, so a theme switch is picked up at once. */
export interface ThemeColors {
  fg2: string;
  bg1: string;
  bg2: string;
  chartBorder: string;
  chartText: string;
}

let ctx: CanvasRenderingContext2D | null = null;
const to = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
const hex = (r: number, g: number, b: number) => `#${to(r)}${to(g)}${to(b)}`;

/** Any CSS colour to #rrggbb; #000000 on failure. */
function parseColor(value: string): string {
  const v = value.trim();
  if (!v) return '#000000';
  if (v[0] === '#') return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase() : v.toLowerCase();
  // Canvas does not support color-mix(): mix manually.
  const m = v.match(/color-mix\(in\s+srgb,\s*([^,]+?)\s+(\d+(?:\.\d+)?)%,\s*([^)]+)\)/i);
  if (m) {
    const p = parseFloat(m[2]) / 100;
    const a = parseColor(m[1]);
    const b = parseColor(m[3]);
    const c = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
    return hex(c(a, 1) * p + c(b, 1) * (1 - p), c(a, 3) * p + c(b, 3) * (1 - p), c(a, 5) * p + c(b, 5) * (1 - p));
  }
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return '#000000';
  ctx.fillStyle = v;
  const n = String(ctx.fillStyle);
  if (n[0] === '#') return n.toLowerCase();
  const rgb = n.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) return hex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  const srgb = n.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (srgb) return hex(parseFloat(srgb[1]) * 255, parseFloat(srgb[2]) * 255, parseFloat(srgb[3]) * 255);
  return '#000000';
}

export function chartColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  const get = (name: string) => parseColor(s.getPropertyValue(name));
  return {
    fg2: get('--fg-2'),
    bg1: get('--bg-1'),
    bg2: get('--bg-2'),
    chartBorder: get('--border-color'),
    // Text tokens may be non-colour shorthand; the front passes the raw value.
    chartText: s.getPropertyValue('--chart-text').trim(),
  };
}

/** One theme token (e.g. `--orange`) as #rrggbb. */
export const themeColor = (name: string): string => parseColor(getComputedStyle(document.documentElement).getPropertyValue(name));

export const SERIES_COUNT = 6;
/** CSS variable of the n-th series colour (cycles after 6). Pair with `themeColor` for the canvas. */
export const seriesVar = (i: number): string => `--series-${(((i % SERIES_COUNT) + SERIES_COUNT) % SERIES_COUNT) + 1}`;
/** The first `n` series colours as #rrggbb for the live theme (re-read after a theme switch). */
export const seriesColors = (n: number): string[] => Array.from({ length: n }, (_, i) => themeColor(seriesVar(i)));

/** The n-th DISTINCT series colour as #rrggbb: the palette for the first SERIES_COUNT, then lighter / darker variants of it lap by lap, so a view with
 *  many series (every asset of a Safe) never repeats a colour among the visible ones. Re-read after a theme switch. */
export function seriesShade(i: number): string {
  const base = themeColor(seriesVar(i));
  const lap = Math.floor(Math.max(0, i) / SERIES_COUNT);
  if (lap === 0) return base;
  const toward = lap % 2 === 1 ? '#ffffff' : '#000000';
  return mix(base, toward, Math.min(0.7, 0.3 + 0.12 * Math.floor((lap - 1) / 2)));
}
