// Real-browser checks of the connect modal rows (Chromium via playwright-core): one-surface rows, the hover-only remove
// button, and the wallet mark's fallback. Needs Chromium (`bunx playwright install chromium`).
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/wallet-rows-browser');

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
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/wallet-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser', define: { 'import.meta.url': JSON.stringify(`file://${root}/src/lib/walletIcon.ts`) } }); // the bundled wallet marks resolve to the files on disk
  if (!built.success) throw new Error(built.logs.join('\n'));
  writeFileSync(join(cache, 'in.css'), `@import "${join(root, 'src/styles/index.css')}";`);
  writeFileSync(join(cache, 'tw.config.js'), `import preset from '${join(root, 'src/styles/tailwind.preset.js')}'; export default { presets: [preset], future: { hoverOnlyWhenSupported: true }, content: ['${root}/src/**/*.tsx', '${root}/test/fixtures/*.tsx'] };`);
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
afterAll(async () => { await (await launching?.catch(() => undefined))?.close(); }, 30000);

const contexts: import('playwright-core').BrowserContext[] = [];
afterEach(async () => { for (const c of contexts.splice(0)) await c.close().catch(() => {}); }, 30000);

async function open(o: { touch?: boolean; light?: boolean; width?: number; icon?: 'ok' | 'broken' } = {}) {
  const ctx = await browser!.newContext({ viewport: { width: o.width ?? 1440, height: 900 }, ...(o.touch ? { hasTouch: true, isMobile: true } : {}), colorScheme: o.light ? 'light' : 'dark' });
  contexts.push(ctx);
  const page = await ctx.newPage();
  await page.goto(`file://${join(cache, 'index.html')}${o.icon ? `?icon=${o.icon}` : ''}`);
  if (o.light) await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.waitForSelector('[aria-labelledby=wm-installed-label] button');
  await page.waitForSelector('.row-x');
  return page;
}
// Computed colors serialize as rgb(), color(srgb ...) or oklab(...); a translucent one carries an alpha (`rgba(` or ` / a`).
const opaque = (c: string) => !c.includes('/') && !c.startsWith('rgba') && c !== 'transparent';

const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 30000);

const tagRight = (page: Page, scope: string) =>
  page.evaluate((s) => {
    const el = [...document.querySelectorAll(`${s} span`)].find((e) => e.children.length === 0 && e.textContent === 'Detected')!;
    return el.getBoundingClientRect().right;
  }, scope);

t('hovered Recent row is one surface: the remove button area has the row hover background', async () => {
  const page = await open();
  const rest = await page.evaluate(() => getComputedStyle(document.querySelector('.row-x > button')!).backgroundColor);
  await page.locator('.row-x').first().hover();
  await page.waitForFunction((r) => getComputedStyle(document.querySelector('.row-x > button')!).backgroundColor !== r && document.getAnimations().every((a) => a.playState === 'finished'), rest); // hover color, transitions done
  const m = await page.evaluate(() => {
    const r = document.querySelector('.row-x')!, b = r.querySelector('button')!, x = r.querySelector('.row-x-btn')!;
    const xr = x.getBoundingClientRect(), br = b.getBoundingClientRect();
    const at = document.elementFromPoint(xr.left + xr.width / 2, xr.top + xr.height / 2);
    const cs = getComputedStyle(b);
    return { within: xr.left >= br.left && xr.right <= br.right, bg: cs.backgroundColor, border: cs.borderBottomColor, ancestor: !!at && (x.contains(at) || at === x), rowW: r.getBoundingClientRect().width, btnW: br.width };
  });
  expect(m.within).toBe(true);
  expect(m.btnW).toBe(m.rowW);
  expect(m.ancestor).toBe(true);
  // Hovering the x itself (not the row button) keeps the same row background.
  await page.locator('.row-x-btn').first().hover();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'));
  const bg2 = await page.evaluate(() => getComputedStyle(document.querySelector('.row-x > button')!).backgroundColor);
  expect(bg2).toBe(m.bg);
});

t('at rest the Detected tag aligns in Recent and Installed rows and the x is not visible', async () => {
  const page = await open();
  await page.mouse.move(0, 0);
  const a = await tagRight(page, '[aria-labelledby=wm-recent-label] .row-x:first-child');
  const b = await tagRight(page, '[aria-labelledby=wm-installed-label]');
  expect(Math.abs(a - b)).toBeLessThanOrEqual(0.5);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.row-x-btn')!).opacity)).toBe('0');
  const h = await page.evaluate(() => [...document.querySelectorAll('[aria-labelledby=wm-recent-label] button:not(.row-x-btn), [aria-labelledby=wm-installed-label] button')].map((e) => e.getBoundingClientRect().height));
  expect(new Set(h).size).toBe(1);
});

t('x shows on hover and on focus-within, is clickable, reachable by Tab and named', async () => {
  const page = await open();
  const x = page.getByRole('button', { name: /^Remove Ambire from recent/ });
  expect(await x.count()).toBe(1);
  await page.locator('.row-x').first().hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.row-x-btn')!).opacity === '1');
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.row-x-btn')!).opacity === '0');
  await page.locator('.row-x > button').first().focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toMatch(/^Remove Ambire from recent/);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.row-x-btn')!).opacity === '1');
  await x.click();
  await page.waitForFunction(() => document.querySelectorAll('.row-x').length === 1);
});

t('coarse pointer: x always available and not hidden', async () => {
  const page = await open({ touch: true, width: 390 });
  expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
  const m = await page.evaluate(() => {
    const x = document.querySelector('.row-x-btn')!, r = x.getBoundingClientRect(), b = x.parentElement!.getBoundingClientRect();
    return { op: getComputedStyle(x).opacity, inside: r.right <= b.right && r.left >= b.left && r.width > 0 };
  });
  expect(Number(m.op)).toBeGreaterThan(0.5);
  expect(m.inside).toBe(true);
  await page.getByRole('button', { name: /^Remove Ambire from recent/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('.row-x').length === 1);
});

t('an icon with transparent areas: opaque tile, no generic glyph under it', async () => {
  const page = await open();
  const tile = page.locator('[aria-labelledby=wm-recent-label] .row-x').first().locator('span[aria-hidden=true]').first();
  await page.waitForFunction(() => { const i = document.querySelector('[aria-labelledby=wm-recent-label] .row-x img') as HTMLImageElement; return i && !i.classList.contains('opacity-0'); });
  const m = await tile.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, svgs: el.querySelectorAll('svg').length, imgs: el.querySelectorAll('img').length }));
  expect(opaque(m.bg)).toBe(true);
  expect(m.svgs).toBe(0);
  expect(m.imgs).toBe(1);
});

t('an icon that fails to load shows the generic glyph on the opaque tile', async () => {
  const page = await open({ icon: 'broken' });
  const tile = page.locator('[aria-labelledby=wm-recent-label] .row-x').first().locator('span[aria-hidden=true]').first();
  await tile.locator('img').waitFor({ state: 'detached' }); // the failed image is dropped
  await tile.locator('svg').waitFor();
  const m = await tile.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, imgs: el.querySelectorAll('img').length }));
  expect(opaque(m.bg)).toBe(true);
  expect(m.imgs).toBe(0);
});
