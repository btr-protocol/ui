// WCAG contrast of the theme token pairs, computed from src/styles/tokens.css itself (no hand-copied numbers).
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** Declarations of every top-level block whose selector is exactly `sel`. */
function decls(sel: string): Record<string, string> {
  const out: Record<string, string> = {};
  let from = 0;
  for (;;) {
    const at = css.indexOf(`\n${sel} {`, from - 1);
    const i = at < 0 && from === 0 && css.startsWith(`${sel} {`) ? 0 : at;
    if (i < 0) break;
    const open = css.indexOf('{', i);
    let d = 1, j = open + 1;
    while (d) d += css[j] === '{' ? 1 : css[j] === '}' ? -1 : 0, j++;
    for (const m of css.slice(open + 1, j - 1).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    from = j;
  }
  return out;
}
const dark = decls(':root');
const light = { ...dark, ...decls('.light') };

type RGBA = [number, number, number, number];
function resolve(v: string, vars: Record<string, string>): RGBA {
  v = v.trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) {
    if (!(ref[1] in vars)) throw new Error(`undefined ${ref[1]}`);
    return resolve(vars[ref[1]], vars);
  }
  if (v[0] === '#') {
    const h = v.length === 4 ? [...v.slice(1)].map((c) => c + c).join('') : v.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = v.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)%)?\s*\)$/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], rgb[4] ? +rgb[4] / 100 : 1];
  const mix = v.match(/^color-mix\(in srgb,\s*(.+?)\s+([\d.]+)%,\s*(.+)\)$/);
  if (mix) {
    const a = resolve(mix[1], vars), b = resolve(mix[3], vars), p = +mix[2] / 100;
    return [a[0] * p + b[0] * (1 - p), a[1] * p + b[1] * (1 - p), a[2] * p + b[2] * (1 - p), 1];
  }
  throw new Error(`cannot resolve ${v}`);
}
const over = (c: RGBA, bg: number[]): number[] => [0, 1, 2].map((i) => c[i] * c[3] + bg[i] * (1 - c[3]));
const lum = (c: number[]) => c.reduce((s, x, i) => { x /= 255; return s + (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]; }, 0);
function ratio(vars: Record<string, string>, fg: string, bg: string): number {
  const b = over(resolve(`var(${bg})`, vars), [255, 255, 255]);
  const f = over(resolve(`var(${fg})`, vars), b);
  const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const [name, vars] of Object.entries({ dark, light })) {
  test(`${name}: body and muted text >= 4.5:1 on every surface`, () => {
    for (const fg of ['--fg-0', '--fg-1', '--fg-2'])
      for (const bg of ['--bg-0', '--bg-1', '--bg-2', '--bg-3'])
        expect(ratio(vars, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
  test(`${name}: tone text >= 4.5:1 on surfaces and on its own tint`, () => {
    const tints: Record<string, string> = { '--fg-success': '--bg-green', '--fg-error': '--bg-red', '--fg-secondary': '--bg-blue', '--fg-primary': '--bg-orange', '--fg-warning': '--bg-orange' };
    for (const fg of ['--fg-success', '--fg-error', '--fg-warning', '--fg-primary', '--fg-secondary', '--fg-info'])
      for (const bg of ['--bg-0', '--bg-1', '--bg-2']) expect(ratio(vars, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const [fg, bg] of Object.entries(tints)) expect(ratio(vars, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
  test(`${name}: series, brand mark and UI lines >= 3:1 on the canvas and raised surfaces`, () => {
    for (const i of [1, 2, 3, 4, 5, 6])
      for (const bg of ['--bg-0', '--bg-1']) expect(ratio(vars, `--series-${i}`, bg), `series-${i} on ${bg}`).toBeGreaterThanOrEqual(3);
    expect(ratio(vars, '--line-ui', '--bg-0')).toBeGreaterThanOrEqual(3);
    for (const bg of ['--bg-0', '--bg-1', '--bg-2']) expect(ratio(vars, '--line-ui', bg), `ProgressSteps missing segment (.progress-pending base, --line-ui) on ${bg}`).toBeGreaterThanOrEqual(3);
    expect(ratio(vars, '--brand-safe', '--bg-0')).toBeGreaterThanOrEqual(3);
  });
}
test('light canvas is a soft off-white, raised surfaces are lighter than the canvas', () => {
  expect(light['--paper']).toMatch(/^#f[5-9]/i);
  expect(light['--paper']).not.toMatch(/^#f(a|b|c|d|e|f)/i);
  const [c, r] = [resolve('var(--bg-0)', light), resolve('var(--bg-1)', light)];
  expect(lum(r.slice(0, 3))).toBeGreaterThan(lum(c.slice(0, 3)));
});
