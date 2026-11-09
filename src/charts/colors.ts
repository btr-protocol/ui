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

const rgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
function toHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const sat = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, sat, l];
}
function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
/** Hue order for `distinctShade`: 12 hues 30 deg apart, neighbours in the list as far apart as possible. */
const HUE_ORDER = [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11];
export const DISTINCT_MAX = HUE_ORDER.length;
/** The i-th of at most DISTINCT_MAX clearly distinct series colours (#rrggbb): 12 hues 30 deg apart starting at the brand orange, same
 *  saturation, theme-tuned lightness, yellows/greens darker on light (the bright yellow is unreadable on white). Past 12 a chart should fold
 *  its tail into one "Other" series, never reuse a hue. */
export function distinctShade(i: number, theme: 'light' | 'dark'): string {
  const h = (25 + 30 * HUE_ORDER[((i % DISTINCT_MAX) + DISTINCT_MAX) % DISTINCT_MAX]) % 360;
  const bright = h >= 45 && h <= 165; // yellow -> green: high luminance at equal lightness
  const l = theme === 'light' ? (bright ? 0.36 : 0.47) : bright ? 0.55 : 0.62;
  return fromHsl(h, 0.7, l);
}

/** The n-th DISTINCT series colour as #rrggbb: the palette for the first SERIES_COUNT, then, lap by lap, the same palette with the HUE rotated (+28 deg per
 *  lap, so orange does not come back as a lighter orange) and the lightness alternated, so a view with many series (every asset of a Safe) never repeats
 *  a colour among the visible ones. Re-read after a theme switch. */
export function seriesShade(i: number): string {
  const base = themeColor(seriesVar(i));
  const lap = Math.floor(Math.max(0, i) / SERIES_COUNT);
  if (lap === 0) return base;
  const [h, s, l] = toHsl(rgb(base));
  const dl = (lap % 2 === 1 ? 0.12 : -0.1) * Math.ceil(lap / 2);
  return fromHsl((h + 28 * lap) % 360, Math.min(1, s), Math.min(0.85, Math.max(0.25, l + dl)));
}
