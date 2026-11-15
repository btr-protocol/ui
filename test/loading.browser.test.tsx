// Real-browser checks of the loaders (Chromium via playwright-core): width-stable value swap, compositor-only sweep, reduced motion,
// one role=status in Busy, every Figure state distinct. SHOT_DIR=<dir> also saves renders. Needs Chromium (`bunx playwright install chromium`).
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// KIT_ROOT points the same tests at another checkout (e.g. the old markup) to prove they fail there.
const root = process.env.KIT_ROOT ?? join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/loading-browser');

function chromium(): string | undefined {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  for (const base of [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      for (const sub of readdirSync(join(base, d))) {
        const bin = join(base, d, sub, 'chrome-headless-shell');
        if (existsSync(bin)) return bin;
      }
    }
  }
}

type Page = import('playwright-core').Page;
const exe = chromium();
let launching: Promise<import('playwright-core').Browser | undefined> | undefined;
async function setup() {
  if (!exe) return undefined;
  mkdirSync(cache, { recursive: true });
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/loading-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser', define: { 'import.meta.url': JSON.stringify(`file://${root}/src/lib/assets.ts`) } });
  if (!built.success) throw new Error(built.logs.join('\n'));
  writeFileSync(join(cache, 'in.css'), `@import "${join(root, 'src/styles/index.css')}";`);
  writeFileSync(join(cache, 'tw.config.js'), `import preset from '${join(root, 'src/styles/tailwind.preset.js')}'; export default { presets: [preset], future: { hoverOnlyWhenSupported: true }, content: ['${root}/src/**/*.{ts,tsx}', '${root}/test/fixtures/*.tsx'] };`);
  const tw = Bun.spawnSync([join(root, 'node_modules/.bin/tailwindcss'), '-c', join(cache, 'tw.config.js'), '-i', join(cache, 'in.css'), '-o', join(cache, 'page.css')], { stderr: 'pipe' });
  if (tw.exitCode) throw new Error(tw.stderr.toString());
  writeFileSync(join(cache, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="page.css"></head><body><script src="page.js"></script></body></html>');
  const { chromium: pw } = await import('playwright-core');
  return pw.launch({ executablePath: exe });
}
let browser: import('playwright-core').Browser | undefined;
beforeAll(async () => {
  launching = setup();
  browser = await launching;
}, 120000);
// The browser close is bounded and reported (console.error with the file name) when it stalls: every test has already run by then.
afterAll(async () => {
  const b = await launching?.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<void>((done) => { timer = setTimeout(() => { console.error('loading.browser.test.tsx: browser close stalled for 25 s'); done(); }, 25000); });
  try { await Promise.race([b?.close().catch(() => {}), stalled]); } finally { clearTimeout(timer); }
}, 40000);

const contexts: import('playwright-core').BrowserContext[] = [];
// A context close that stalls on a loaded machine is reported (and fails the hook), never swallowed; afterAll's browser close reaps it.
afterEach(async () => {
  for (const c of contexts.splice(0)) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<never>((_, fail) => { timer = setTimeout(() => fail(new Error('context close stalled for 20 s')), 20000); });
    try { await Promise.race([c.close().catch(() => {}), stalled]); } finally { clearTimeout(timer); }
  }
}, 30000);


type V = 'all' | 'swap' | 'busy';
async function open(v: V, o: { width?: number; light?: boolean; reduced?: boolean } = {}) {
  const ctx = await browser!.newContext({ viewport: { width: o.width ?? 1440, height: 900 }, colorScheme: o.light ? 'light' : 'dark', ...(o.reduced ? { reducedMotion: 'reduce' as const } : {}) });
  contexts.push(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`file://${join(cache, 'index.html')}?v=${v}`);
  if (o.light) await page.evaluate(() => document.documentElement.classList.add('light'));
  // Colour transitions run after the theme flips; measuring or capturing inside them reads a half-faded button (the cause of the 'invisible Retry' light capture).
  if (o.light) await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition)));
  return page;
}
const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 40000);

t('value swap from ValuePlaceholder changes no width', async () => {
  const page = await open('swap');
  await page.locator('#fig [data-state=loading]').waitFor();
  const w = () => page.locator('#fig [data-state]').evaluate((e) => e.getBoundingClientRect().width);
  const before = await w();
  await page.evaluate(() => (window as unknown as { __flip: () => void }).__flip());
  await page.locator('#fig [data-state=value]').waitFor();
  expect(Math.abs((await w()) - before)).toBeLessThanOrEqual(0.5);
});

t('the sweep runs on the compositor and animates; reduced motion holds it still and slows the spinner to >= 2 s', async () => {
  const probe = () => ({ sk: [...document.querySelectorAll('.sk')].map((e) => { const a = getComputedStyle(e, '::after'); return { name: a.animationName, op: a.opacity, dur: a.animationDuration }; }), sp: (() => { const s = getComputedStyle(document.querySelector('.spinner')!); return { name: s.animationName, dur: parseFloat(s.animationDuration) * (s.animationDuration.endsWith('ms') ? 0.001 : 1) }; })() });
  const live = await (await open('all')).evaluate(probe);
  expect(live.sk.length).toBeGreaterThan(3);
  for (const k of live.sk) { expect(k.name).toBe('loader-sweep'); expect(k.dur).toBe('1.4s'); }
  expect(live.sp.name).toBe('loader-spin');
  expect(live.sp.dur).toBeCloseTo(0.9, 2);
  const still = await (await open('all', { reduced: true })).evaluate(probe);
  for (const k of still.sk) { expect(k.name).toBe('none'); expect(k.op).toBe('0'); }
  expect(still.sp.name).toBe('loader-spin');
  expect(still.sp.dur).toBeGreaterThanOrEqual(2);
});

t('no loader animates a layout property', async () => {
  const css = await Bun.file(join(root, 'src/styles/index.css')).text();
  const keyframes = [...css.matchAll(/@keyframes (loader-[\w-]+) \{([\s\S]*?)\n\}/g)];
  expect(keyframes.length).toBe(3);
  for (const [, name, body] of keyframes) expect(body, name).not.toMatch(/background-position|width|height|top|left|right|bottom/);
});

t('a 200-row loading table in Busy: one status node that stays mounted, aria-busy toggles, placeholders are hidden', async () => {
  const page = await open('busy');
  await page.locator('tr').nth(199).waitFor();
  expect(await page.locator('[role=status]').count()).toBe(1);
  expect(await page.locator('[role=status]').textContent()).toBe('Loading pools');
  expect(await page.locator('[aria-busy=true]').count()).toBe(1);
  expect(await page.locator('[aria-busy=true] [role=status]').count()).toBe(0); // the status lives OUTSIDE the busy region
  expect(await page.locator('[data-state=loading] .sk').count()).toBe(200);
  await page.evaluate(() => (window as unknown as { __busy: (b: boolean) => void }).__busy(false));
  await page.locator('[aria-busy=false]').waitFor();
  expect(await page.locator('[role=status]').count()).toBe(1); // same node, text cleared
  expect(await page.locator('[role=status]').textContent()).toBe('');
});

t('Figure: every state has its own accessible text; a measured zero prints as zero; the n/a glyph is the one hyphen', async () => {
  const page = await open('all');
  await page.locator('[data-state=na]').waitFor();
  const rows = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((r) => { const f = r.querySelector('[data-state]') as HTMLElement; return { state: f.dataset.state!, text: f.textContent!.trim(), sk: !!f.querySelector('.sk'), warn: !!f.querySelector('svg'), retry: f.querySelector('[aria-label^=Retry]')?.getAttribute('aria-label') ?? null, focusable: !!f.querySelector('[tabindex="0"]') }; }));
  const by = (i: number) => rows[i]!;
  expect(by(0).text).toBe('1234.50');
  expect(by(1).text).toBe('0.00');
  expect(by(2).text).toMatch(/^1234\.50stale 5m$/);
  expect(by(3)).toMatchObject({ sk: true, text: '' }); // inside Busy: silent, the one status speaks
  expect(by(4).text).toBe('Measuring depth');
  expect(by(5).text).toContain('Unavailable: Could not load');
  expect(by(5)).toMatchObject({ warn: true, retry: 'Retry', focusable: true });
  expect(by(6).text).toContain('Unavailable: Unfillable, no depth');
  expect(by(7).text).toContain('Unavailable: Timed out');
  expect(by(8).text).toContain('Unavailable: Rate limited');
  expect(by(9).text).toBe('-Not applicable: No fees booked in this window');
  expect(by(9).focusable).toBe(true);
  expect(rows.some((r) => r.text.includes(String.fromCharCode(8212)))).toBe(false);
  expect(new Set(rows.map((r) => r.text + r.sk + r.warn)).size).toBe(rows.length - 0);
  // a loading figure OUTSIDE a Busy announces itself as plain hidden text (no live region)
  expect(await page.locator('#solo').textContent()).toBe('Loading');
  // axe aria-hidden-focus: no focusable element is, or sits inside, an aria-hidden subtree
  expect(await page.evaluate(() => [...document.querySelectorAll('[tabindex],button,a[href],input')].filter((e) => e.closest('[aria-hidden=true]')).length)).toBe(0);
});

t('the Retry button is visible in light and dark: a box, and 3:1 contrast against its background', async () => {
  for (const light of [false, true]) {
    const page = await open('all', { width: 390, light });
    await page.locator('[aria-label^=Retry]').waitFor();
    const m = await page.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 1;
      const cx = cv.getContext('2d', { willReadFrequently: true })!;
      const rgba = (c: string) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0]!, d[1]!, d[2]!, d[3]! / 255]; };
      const lum = (r: number, g: number, b: number) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
      const btn = document.querySelector('[aria-label^=Retry]') as HTMLElement;
      const box = btn.getBoundingClientRect(), svg = btn.querySelector('svg')!.getBoundingClientRect();
      let bgc = [0, 0, 0, 0];
      for (let e: Element | null = btn; e && bgc[3]! < 1; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3]! > 0) bgc = bgc[3] === 0 ? c : bgc; }
      const [fr, fg, fb, fa] = rgba(getComputedStyle(btn).color), [br, bg, bb] = bgc as [number, number, number];
      const mix = (f: number, b: number) => f * fa! + b * (1 - fa!);
      const l1 = lum(mix(fr!, br), mix(fg!, bg), mix(fb!, bb)), l2 = lum(br, bg, bb);
      return { w: box.width, h: box.height, sw: svg.width, onScreen: box.right <= innerWidth && box.left >= 0, ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), op: getComputedStyle(btn).opacity };
    });
    expect(m.w).toBeGreaterThan(0); expect(m.h).toBeGreaterThan(0); expect(m.sw).toBeGreaterThan(0);
    expect(m.onScreen).toBe(true);
    expect(m.op).toBe('1');
    expect(m.ratio, `light=${light}`).toBeGreaterThanOrEqual(3);
  }
});

t('the sweep shares one clock: every sweeping element carries a phase set once, no per-cell delay values differ by position', async () => {
  const page = await open('all');
  const d = await page.evaluate(() => [...document.querySelectorAll('.sk')].map((e) => (e as HTMLElement).style.getPropertyValue('--sk-phase')));
  expect(d.length).toBeGreaterThan(3);
  for (const v of d) expect(v).toMatch(/^-\d+ms$/);
  await page.waitForTimeout(200);
  const d2 = await page.evaluate(() => [...document.querySelectorAll('.sk')].map((e) => (e as HTMLElement).style.getPropertyValue('--sk-phase')));
  expect(d2).toEqual(d); // never recomputed
});

t('sizes and fills passed by className beat the loader defaults; lite mode and RTL are handled', async () => {
  const page = await open('all');
  const m = await page.evaluate(() => {
    const sp = document.createElement('span'); sp.className = 'spinner h-8 w-8'; document.body.appendChild(sp);
    const sk = document.createElement('span'); sk.className = 'sk block h-4 w-10 bg-transparent'; document.body.appendChild(sk);
    const r = sp.getBoundingClientRect();
    document.documentElement.setAttribute('data-lite', '');
    const lite = getComputedStyle(document.querySelector('.sk')!, '::after').animationName;
    document.documentElement.removeAttribute('data-lite');
    document.documentElement.dir = 'rtl';
    const rtl = [getComputedStyle(document.querySelector('.sk')!, '::after').animationName, getComputedStyle(document.querySelector('.spinner')!).animationDirection];
    return { w: r.width, bg: getComputedStyle(sk).backgroundColor, bgDefault: getComputedStyle(document.querySelector('.sk:not(.bg-transparent)')!).backgroundColor, lite, rtl };
  });
  expect(m.w).toBe(32);
  expect(m.bg).not.toBe(m.bgDefault);
  expect(m.lite).toBe('none');
  expect(m.rtl).toEqual(['loader-sweep-rtl', 'reverse']);
});

t('renders for review (SHOT_DIR)', async () => {
  const dir = process.env.SHOT_DIR;
  if (!dir) { console.log('loading.browser.test.tsx: SHOT_DIR unset, skipping the review renders'); return; }
  for (const [width, light, name] of [[1440, false, '1440-dark'], [390, false, '390-dark'], [390, true, '390-light']] as const) {
    const page = await open('all', { width, light });
    await page.locator('[data-state=na]').waitFor();
    await page.screenshot({ path: join(dir, `loading-${name}.png`), fullPage: true });
  }
});
