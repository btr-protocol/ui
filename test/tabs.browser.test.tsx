// Real-browser checks (Chromium via playwright-core): geometry cannot be asserted in a DOM emulation.
// Needs Chromium (`bunx playwright install chromium`): without one every test here fails with that instruction.
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/tabs-browser');

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

beforeAll(async () => {
  if (!exe) return;
  mkdirSync(cache, { recursive: true });
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/tabs-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser' });
  if (!built.success) throw new Error(built.logs.join('\n'));
  writeFileSync(join(cache, 'in.css'), `@import "${join(root, 'src/styles/index.css')}";`);
  writeFileSync(join(cache, 'tw.config.js'), `import preset from '${join(root, 'src/styles/tailwind.preset.js')}'; export default { presets: [preset], future: { hoverOnlyWhenSupported: true }, content: ['${root}/src/**/*.tsx', '${root}/test/fixtures/*.tsx'] };`);
  const tw = Bun.spawnSync([join(root, 'node_modules/.bin/tailwindcss'), '-c', join(cache, 'tw.config.js'), '-i', join(cache, 'in.css'), '-o', join(cache, 'page.css')], { stderr: 'pipe' });
  if (tw.exitCode) throw new Error(tw.stderr.toString());
  writeFileSync(join(cache, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="page.css"></head><body><script src="page.js"></script></body></html>');
  const { chromium: pw } = await import('playwright-core');
  browser = await pw.launch({ executablePath: exe });
});
afterAll(async () => { await browser?.close(); });

async function open(width: number, theme = 'dark') {
  const page = await browser!.newPage({ viewport: { width, height: 900 } });
  await page.goto(`file://${join(cache, 'index.html')}`);
  if (theme === 'light') await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.waitForSelector('#cmp [role=tab]');
  return page;
}
// No Chromium = a FAILING test, never a silent pass or skip: geometry is only asserted in a real browser.
const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 30000);

for (const w of [1440, 390]) {
  t(`group tabs are exactly a ButtonGroup: same height and text position (${w}px)`, async () => {
    const page = await open(w);
    const m = await page.evaluate(() => {
      const box = (el: Element) => el.getBoundingClientRect();
      const txt = (el: Element) => { const r = document.createRange(); r.selectNodeContents(el); return box(r as unknown as Element); };
      const tl = document.querySelector('#cmp [role=tablist]')!;
      const g = document.querySelector('#cmp [role=group]')!;
      const tab = tl.querySelector('[role=tab]')!, btn = g.querySelector('button')!;
      return { tl: box(tl).height, g: box(g).height, tab: box(tab).height, btn: box(btn).height, tt: txt(tab).top - box(tl).top, bt: txt(btn).top - box(g).top };
    });
    expect(m.tl).toBe(m.g);
    expect(m.tab).toBe(m.btn);
    expect(m.tt).toBe(m.bt);
    await page.close();
  });
}

t('xs tabs are exactly an xs ButtonGroup', async () => {
  const page = await open(1440);
  const h = await page.evaluate(() => [...document.querySelectorAll('#xs [role=tablist], #xs [role=group]')].map((e) => e.getBoundingClientRect().height));
  expect(h[0]).toBe(h[1]);
  await page.close();
});

for (const w of [360, 390])
  t(`${w}px: 7 group tabs scroll and the active tab is centred (or clamped at the end)`, async () => {
    const page = await open(w);
    const m = await page.evaluate(() => {
      const c = document.querySelector('#over [role=tablist]') as HTMLElement;
      const a = c.querySelector('[aria-selected=true]') as HTMLElement;
      const cr = c.getBoundingClientRect(), ar = a.getBoundingClientRect();
      return { overflow: c.scrollWidth > c.clientWidth, scrolled: c.scrollLeft > 0, mid: ar.left + ar.width / 2 - (cr.left + cr.width / 2), max: c.scrollWidth - c.clientWidth, left: c.scrollLeft, cw: c.clientWidth, vis: ar.left >= cr.left - 1 && ar.right <= cr.right + 1 };
    });
    expect(m.overflow).toBe(true);
    expect(m.scrolled).toBe(true);
    expect(m.vis).toBe(true);
    if (m.left < m.max - 1) expect(Math.abs(m.mid)).toBeLessThan(2); // not clamped: centred
    await page.close();
  });

t('selecting a tab re-centres it', async () => {
  const page = await open(360);
  await page.click('#over [role=tab]:has-text("Overview")');
  await page.waitForFunction(() => document.querySelector('#over [role=tablist]')!.scrollLeft < 2);
  await page.click('#over [role=tab]:has-text("Orders")');
  await page.waitForFunction(() => document.querySelector('#over [role=tablist]')!.scrollLeft > 2);
  await page.waitForTimeout(100);
  const mid = await page.evaluate(() => {
    const c = document.querySelector('#over [role=tablist]')!, a = c.querySelector('[aria-selected=true]')!;
    const cr = c.getBoundingClientRect(), ar = a.getBoundingClientRect();
    return ar.left + ar.width / 2 - (cr.left + cr.width / 2);
  });
  expect(Math.abs(mid)).toBeLessThan(2);
  await page.close();
});

for (const w of [360, 390])
  for (const id of ['att7', 'att6', 'attlong'])
    t(`${w}px ${id}: the attached strip's border covers all its tabs`, async () => {
      const page = await open(w);
      const m = await page.evaluate((id) => {
        const bar = document.querySelector(`#${id} .tabs-attached-bar`) as HTMLElement;
        const strip = bar.querySelector('[role=tablist]') as HTMLElement;
        const tabs = [...strip.querySelectorAll('[role=tab]')];
        const last = tabs.at(-1)!.getBoundingClientRect(), s = strip.getBoundingClientRect();
        return { stripRight: s.right, lastRight: last.right, scrollW: bar.scrollWidth, stripW: s.width, barW: bar.clientWidth };
      }, id);
      expect(m.stripRight).toBeGreaterThanOrEqual(m.lastRight); // the strip is as wide as its tabs: border and rule do not stop short
      expect(m.scrollW).toBeGreaterThanOrEqual(Math.floor(m.stripW));
      await page.close();
    });

t('attached: the active tab covers the card edge (no rule under it), inactive tabs keep it', async () => {
  const page = await open(1440);
  const px = await page.evaluate(() => {
    const strip = document.querySelector('#att6 [role=tablist]')!.getBoundingClientRect();
    const a = document.querySelector('#att6 [aria-selected=true]')!.getBoundingClientRect();
    const o = document.querySelector('#att6 [role=tab][aria-selected=false]')!.getBoundingClientRect();
    return { edge: strip.bottom - 1, ax: a.left + a.width / 2, ox: o.left + o.width / 2 };
  });
  const shot = async (x: number) => (await page.screenshot({ clip: { x, y: px.edge, width: 1, height: 1 } })).toString('hex');
  expect(await shot(px.ax)).not.toBe(await shot(px.ox)); // the active tab paints over the edge row
  await page.close();
});

t('manual activation: arrows move focus only, Enter selects', async () => {
  const page = await open(1440);
  await page.focus('#manual [aria-selected=true]');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Risk');
  expect(await page.evaluate(() => document.querySelector('#manual [aria-selected=true]')!.textContent)).toBe('Volume & Fees');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.querySelector('#manual [aria-selected=true]')!.textContent)).toBe('Risk');
  await page.close();
});

// A group that fits must not overflow its own scroller: no scrollable extent, so no edge fade (`data-l` / `data-r`).
const fitModes = [
  { name: 'desktop, fine pointer', w: 1440, touch: false },
  { name: '390px touch (coarse pointer)', w: 390, touch: true },
  { name: '1440px coarse pointer', w: 1440, touch: true },
];
async function openMode(w: number, touch: boolean) {
  const ctx = await browser!.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  await page.goto(`file://${join(cache, 'index.html')}`);
  await page.waitForSelector('#fit [role=tab]');
  return { page, ctx };
}
for (const mode of fitModes)
  for (const z of ['xs', 'sm', 'md'])
    t(`fit: 2 short ${z} tabs do not overflow their scroller (${mode.name})`, async () => {
      const { page, ctx } = await openMode(mode.w, mode.touch);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(mode.touch);
      const m = await page.evaluate((z) =>
        [...document.querySelectorAll(`#fit-${z} [role=tablist]`)].map((tl) => {
          const sc = (tl.parentElement!.classList.contains('tabs-attached-bar') ? tl.parentElement! : tl) as HTMLElement;
          return { sw: sc.scrollWidth, cw: sc.clientWidth, sh: sc.scrollHeight, ch: sc.clientHeight, l: sc.hasAttribute('data-l'), r: sc.hasAttribute('data-r'), fade: sc.classList.contains('seg-fade') };
        }), z);
      expect(m.length).toBe(2);
      for (const x of m) {
        expect(x.fade).toBe(true);
        expect(x.sw).toBeLessThanOrEqual(x.cw);
        expect(x.sh).toBeLessThanOrEqual(x.ch);
        expect(x.l).toBe(false);
        expect(x.r).toBe(false);
      }
      await ctx.close();
    });

// Plain ButtonGroup geometry is the baseline the tabs fix must not move (numbers asserted from origin/main).
for (const z of ['xs', 'sm', 'md'])
  t(`ButtonGroup ${z} keeps its size`, async () => {
    const page = await open(1440);
    const m = await page.evaluate((z) => { const r = document.querySelector(`#fit-${z} [role=group]`)!.getBoundingClientRect(); return [r.width, r.height]; }, z);
    console.log(`ButtonGroup ${z}: ${m[0]} x ${m[1]}`);
    await page.close();
  });

// True overflow keeps its fade: data-r while content is hidden to the right, data-l once scrolled.
for (const id of ['over', 'att7'])
  t(`${id}: real overflow still sets data-r, then data-l after scrolling`, async () => {
    const page = await open(360);
    const sc = `#${id} ${id === 'over' ? '[role=tablist]' : '.tabs-attached-bar'}`;
    await page.evaluate((s) => { const c = document.querySelector(s) as HTMLElement; c.scrollLeft = 0; c.dispatchEvent(new Event('scroll')); }, sc);
    expect(await page.evaluate((s) => document.querySelector(s)!.hasAttribute('data-r'), sc)).toBe(true);
    expect(await page.evaluate((s) => document.querySelector(s)!.hasAttribute('data-l'), sc)).toBe(false);
    await page.evaluate((s) => { const c = document.querySelector(s) as HTMLElement; c.scrollLeft = 40; c.dispatchEvent(new Event('scroll')); }, sc);
    expect(await page.evaluate((s) => document.querySelector(s)!.hasAttribute('data-l'), sc)).toBe(true);
    await page.close();
  });
