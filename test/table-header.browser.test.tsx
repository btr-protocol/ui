// Table header geometry. Real-browser checks (Chromium via playwright-core): geometry cannot be asserted in a DOM emulation.
// Needs Chromium (`bunx playwright install chromium`): without one every test here fails with that instruction.
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/table-browser');

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

const exe = chromium();
let browser: import('playwright-core').Browser | undefined;

// The launch PROMISE is kept: afterAll awaits it, so a hook that timed out mid-launch still gets its browser closed.
let launching: Promise<import('playwright-core').Browser | undefined> | undefined;
async function setup() {
  if (!exe) return undefined;
  mkdirSync(cache, { recursive: true });
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/table-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser' });
  if (!built.success) throw new Error(built.logs.join('\n'));
  writeFileSync(join(cache, 'in.css'), `@import "${join(root, 'src/styles/index.css')}";`);
  writeFileSync(join(cache, 'tw.config.js'), `import preset from '${join(root, 'src/styles/tailwind.preset.js')}'; export default { presets: [preset], future: { hoverOnlyWhenSupported: true }, content: ['${root}/src/**/*.tsx', '${root}/test/fixtures/*.tsx'] };`);
  const tw = Bun.spawnSync([join(root, 'node_modules/.bin/tailwindcss'), '-c', join(cache, 'tw.config.js'), '-i', join(cache, 'in.css'), '-o', join(cache, 'page.css')], { stderr: 'pipe' });
  if (tw.exitCode) throw new Error(tw.stderr.toString());
  writeFileSync(join(cache, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="page.css"></head><body><script src="page.js"></script></body></html>');
  const { chromium: pw } = await import('playwright-core');
  return pw.launch({ executablePath: exe });
}
// Build + tailwind + Chromium launch take longer than bun's 5 s hook default.
beforeAll(async () => {
  launching = setup();
  browser = await launching;
}, 120000);
afterAll(async () => { await (await launching?.catch(() => undefined))?.close(); }, 120000);

// Every page `open()` hands out is closed here, also when its test throws.
const pages: import('playwright-core').Page[] = [];
afterEach(async () => { for (const p of pages.splice(0)) await p.close().catch(() => {}); });

// The edge effect and its ResizeObserver run after mount: wait until they have measured. A one-shot observer on every
// fade scroller is delivered after the component's own (created first, same frame), then two frames of slack.
// Every wait fails as an assertion after 5 s, never as the 30 s test timeout.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const until = (page: import('playwright-core').Page, fn: (a: any) => unknown, arg?: unknown) => page.waitForFunction(fn, arg, { timeout: 5000 });

async function settled(page: import('playwright-core').Page) {
  await page.evaluate(() => new Promise<void>((done, fail) => {
    const timer = setTimeout(() => fail(new Error('settled(): no resize notification within 5 s')), 5000);
    const els = [...document.querySelectorAll('.seg-fade')];
    const frames = () => requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); done(); }));
    if (!els.length) return frames();
    const ro = new ResizeObserver(() => { ro.disconnect(); frames(); });
    els.forEach((e) => ro.observe(e));
  }));
}

async function open(width: number, theme = 'dark') {
  const page = await browser!.newPage({ viewport: { width, height: 900 } });
  pages.push(page);
  await page.goto(`file://${join(cache, 'index.html')}`);
  if (theme === 'light') await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.waitForSelector('#t [role=search]');
  return page;
}
// No Chromium = a FAILING test, never a silent pass or skip: geometry is only asserted in a real browser.
const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 30000);

for (const w of [375, 1440])
  t(`${w}px: title + freshness + segments + search share one header row; search full height, ruled, no overflow`, async () => {
    const page = await open(w);
    const m = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      const s = document.querySelector('#t [role=search]')!;
      const hdr = s.parentElement!;
      const cs = getComputedStyle(s);
      return {
        hdr: hdr.getBoundingClientRect(), s: s.getBoundingClientRect(), title: r('#t h2'), fresh: r('#fresh'), seg: r('#t [aria-label="Action kind"]'),
        bl: parseFloat(cs.borderLeftWidth), hb: parseFloat(getComputedStyle(hdr).borderBottomWidth), bt: parseFloat(cs.borderTopWidth),
        scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        inHdr: [document.querySelector('#t h2'), document.querySelector('#fresh'), document.querySelector('#t [aria-label="Action kind"]')].every((e) => hdr.contains(e)),
      };
    });
    expect(m.inHdr).toBe(true);
    expect(m.scroll).toBe(0);
    expect(m.s.bottom).toBeCloseTo(m.hdr.bottom - m.hb, 0); // flush to the header rule
    expect(m.s.left).toBeGreaterThanOrEqual(m.hdr.left - 0.5);
    expect(m.s.right).toBeLessThanOrEqual(m.hdr.right + 0.5);
    // The expand cell is a 32px h-8 cell, so a header carrying it stays the one-row h-8 height.
    if (w === 1440) {
      const expandH = await page.evaluate(() => {
        const hdr = document.querySelector('#x [aria-label="Open table in a new window"]')!.closest('.flex-nowrap')!;
        return hdr.getBoundingClientRect().height - parseFloat(getComputedStyle(hdr).borderBottomWidth);
      });
      expect(expandH).toBeCloseTo(32, 0);
    }
    // One row on every width: full height, left rule, after the controls; a phone folds it to its glyph.
    expect(m.s.top).toBeCloseTo(m.hdr.top, 0);
    expect(m.s.height).toBeCloseTo(m.hdr.height - m.hb, 0);
    expect(m.bl).toBe(1);
    expect(m.s.left).toBeGreaterThanOrEqual(m.seg.right - 0.5);
    if (w !== 1440) expect(m.s.width).toBeCloseTo(40, 0);
  });

t('Escape clears; changing the segment resets the query', async () => {
  const page = await open(1440);
  const input = page.getByRole('textbox', { name: 'Search Recent activity' });
  await input.fill('Row 1');
  expect(await page.locator('#t tbody tr').count()).toBe(1);
  await input.press('Escape');
  expect(await input.inputValue()).toBe('');
  await input.fill('Row 1');
  await page.getByRole('tab', { name: 'Swap' }).click();
  await until(page, () => (document.querySelector('#t [role=search] input') as HTMLInputElement).value === '');
});
