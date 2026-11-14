/** Pure helpers of Heatmap / Doughnut: no DOM, no lightweight-charts. */

/** Series colour as a CSS value (theme-reactive, no canvas parse). The first six are the `--series-n` tokens; each further lap mixes the
 *  same token toward the text colour / canvas, alternately, so a view with many slices never repeats a colour among neighbours. */
export function seriesCss(i: number, count = 6): string {
  const k = ((i % count) + count) % count;
  const lap = Math.floor(Math.max(0, i) / count);
  const base = `var(--series-${k + 1})`;
  if (lap === 0) return base;
  const pct = Math.max(45, 78 - 11 * Math.ceil(lap / 2));
  return `color-mix(in srgb, ${base} ${pct}%, var(${lap % 2 === 1 ? '--fg-0' : '--bg-0'}))`;
}

export interface HeatDomain {
  min: number;
  max: number;
}

/** Domain of a value grid. `diverging` centres on 0 (symmetric about the larger magnitude). Non-finite cells are ignored. */
export function heatDomain(values: readonly (readonly (number | null | undefined)[])[], diverging: boolean): HeatDomain {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of values)
    for (const v of row)
      if (v != null && Number.isFinite(v)) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
  if (lo > hi) return { min: 0, max: 1 };
  if (diverging) {
    const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    return { min: -m, max: m };
  }
  return lo === hi ? { min: lo, max: lo + 1 } : { min: lo, max: hi };
}

/** Cell fill: share (0..1) of the tone mixed into the surface. Diverging: green above 0, red below; sequential: the brand colour. */
export function heatTone(v: number | null | undefined, d: HeatDomain, diverging: boolean): { tone: string; share: number } | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (diverging) {
    const m = Math.max(Math.abs(d.min), Math.abs(d.max)) || 1;
    return { tone: v >= 0 ? '--green' : '--red', share: Math.min(1, Math.abs(v) / m) * 0.7 };
  }
  return { tone: '--orange', share: Math.min(1, Math.max(0, (v - d.min) / (d.max - d.min || 1))) * 0.7 };
}

export const heatFill = (t: { tone: string; share: number } | null): string | undefined =>
  t ? `color-mix(in srgb, var(${t.tone}) ${Math.round(t.share * 100)}%, var(--bg-1))` : undefined;

export interface Slice {
  id: string;
  label: string;
  value: number;
}

export interface Arc extends Slice {
  /** Share of the total, 0..1. */
  share: number;
  /** Start / end angle in turns (0 = 12 o'clock, clockwise). */
  from: number;
  to: number;
}

/** Slices with a positive finite value, in the given order, with their share and angular span. Folds nothing: the caller decides "Other". */
export function arcs(slices: readonly Slice[]): Arc[] {
  const kept = slices.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = kept.reduce((a, s) => a + s.value, 0);
  let at = 0;
  return kept.map((s) => {
    const share = total > 0 ? s.value / total : 0;
    const arc = { ...s, share, from: at, to: at + share };
    at += share;
    return arc;
  });
}

/** SVG path of a ring segment (outer radius ro, inner ri, centre 0,0) between two angles in turns. A full ring is split in two halves. */
export function ringPath(from: number, to: number, ro: number, ri: number): string {
  const span = Math.min(to - from, 0.99999);
  const pt = (t: number, r: number) => {
    const a = 2 * Math.PI * t - Math.PI / 2;
    return `${(r * Math.cos(a)).toFixed(3)} ${(r * Math.sin(a)).toFixed(3)}`;
  };
  const large = span > 0.5 ? 1 : 0;
  const e = from + span;
  return `M${pt(from, ro)}A${ro} ${ro} 0 ${large} 1 ${pt(e, ro)}L${pt(e, ri)}A${ri} ${ri} 0 ${large} 0 ${pt(from, ri)}Z`;
}
