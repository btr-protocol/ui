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

t('a 200-row loading table in Busy: one role=status, aria-busy toggles, placeholders are hidden', async () => {
  const page = await open('busy');
  await page.locator('tr').nth(199).waitFor();
  expect(await page.locator('[role=status]').count()).toBe(1);
  expect(await page.locator('[aria-busy=true]').count()).toBe(1);
  expect(await page.locator('[data-state=loading] .sk').count()).toBe(200);
  expect(await page.locator('[role=status] ~ * [role=status], tr [role=status]').count()).toBe(0);
  await page.evaluate(() => (window as unknown as { __busy: (b: boolean) => void }).__busy(false));
  await page.locator('[aria-busy=false]').waitFor();
  expect(await page.locator('[role=status]').count()).toBe(0);
});

t('Figure: every state looks different; a measured zero prints as zero; the n/a glyph is the one hyphen', async () => {
  const page = await open('all');
  await page.locator('[data-state=na]').waitFor();
  const rows = await page.evaluate(() => [...document.querySelectorAll('tbody tr')].map((r) => { const f = r.querySelector('[data-state]') as HTMLElement; return { state: f.dataset.state!, text: f.textContent!.trim(), title: f.title, sk: !!f.querySelector('.sk'), warn: !!f.querySelector('svg'), retry: !!f.querySelector('[aria-label=Retry]') }; }));
  const by = (i: number) => rows[i]!;
  expect(by(0).text).toBe('1234.50');
  expect(by(1).text).toBe('0.00');
  expect(by(2).text).toMatch(/^1234\.50stale 5m$/);
  expect(by(3)).toMatchObject({ sk: true, text: '' });
  expect(by(4).text).toBe('Measuring depth');
  expect(by(5)).toMatchObject({ text: '-', warn: true, retry: true, title: 'Could not load' });
  expect(by(6).title).toBe('Timed out');
  expect(by(7).title).toBe('Rate limited');
  expect(by(8)).toMatchObject({ text: '-', warn: false, title: 'No fees booked in this window' });
  expect(rows.some((r) => [...r.text].some((c) => c.codePointAt(0) === 8212))).toBe(false); // no em dash
  expect(new Set(rows.slice(0, 5).map((r) => r.text + r.sk)).size).toBe(5);
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
