// Real-browser checks (Chromium via playwright-core): geometry cannot be asserted in a DOM emulation.
// Needs Chromium (`bunx playwright install chromium`): without one every test here fails with that instruction.
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
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

// The launch PROMISE is kept: afterAll awaits it, so a hook that timed out mid-launch still gets its browser closed.
let launching: Promise<import('playwright-core').Browser | undefined> | undefined;
async function setup() {
  if (!exe) return undefined;
  mkdirSync(cache, { recursive: true });
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/tabs-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser' });
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
afterAll(async () => { await (await launching?.catch(() => undefined))?.close(); }, 30000);

// Every page `open()` hands out is closed here, also when its test throws.
const pages: import('playwright-core').Page[] = [];
afterEach(async () => { for (const p of pages.splice(0)) await p.close().catch(() => {}); });

// The edge effect and its ResizeObserver run after mount: wait until they have measured. A one-shot observer on every
// fade scroller is delivered after the component's own (created first, same frame), then two frames of slack.
// Every wait fails as an assertion after 5 s, never as the 30 s test timeout.
const until = <A,>(page: import('playwright-core').Page, fn: (a: A) => unknown, arg?: A) => page.waitForFunction(fn, arg as A, { timeout: 5000 });

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
  await page.waitForSelector('#cmp [role=tab]');
  await settled(page);
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
    await until(page, () => document.querySelector('#over [role=tablist]')!.hasAttribute('data-l')); // the effect centred the active tab: content is hidden on the left
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
  await until(page, () => document.querySelector('#over [role=tablist]')!.scrollLeft < 2);
  await page.click('#over [role=tab]:has-text("Orders")');
  await until(page, () => document.querySelector('#over [role=tablist]')!.scrollLeft > 2);
  await until(page, () => {
    const c = document.querySelector('#over [role=tablist]')!, a = c.querySelector('[aria-selected=true]')!;
    const cr = c.getBoundingClientRect(), ar = a.getBoundingClientRect();
    return a.textContent === 'Orders' && Math.abs(ar.left + ar.width / 2 - (cr.left + cr.width / 2)) < 2;
  });
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
    document.querySelector('#att6')!.scrollIntoView(); // the fixture is taller than the viewport: the screenshot clip must be on screen
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
async function withMode<R>(w: number, touch: boolean, fn: (page: import('playwright-core').Page) => Promise<R>): Promise<R> {
  const ctx = await browser!.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch });
  try {
    const page = await ctx.newPage();
    await page.goto(`file://${join(cache, 'index.html')}`);
    await page.waitForSelector('#fit [role=tab]');
    await settled(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(touch);
    return await fn(page);
  } finally {
    await ctx.close();
  }
}
for (const mode of fitModes)
  for (const z of ['xs', 'sm', 'md'])
    t(`fit: 2 short ${z} tabs do not overflow their scroller (${mode.name})`, () =>
      withMode(mode.w, mode.touch, async (page) => {
        const m = await page.evaluate((z) =>
          [...document.querySelectorAll(`#fit-${z} [role=tablist]`)].map((tl) => {
            const sc = (tl.parentElement!.classList.contains('tabs-attached-bar') ? tl.parentElement! : tl) as HTMLElement;
            return { sw: sc.scrollWidth, cw: sc.clientWidth, sh: sc.scrollHeight, ch: sc.clientHeight, l: sc.hasAttribute('data-l'), r: sc.hasAttribute('data-r') };
          }), z);
        expect(m.length).toBe(2);
        for (const x of m) {
          expect(x.sw).toBeLessThanOrEqual(x.cw);
          expect(x.sh).toBeLessThanOrEqual(x.ch);
          expect(x.l).toBe(false);
          expect(x.r).toBe(false);
        }
      }));

// A plain ButtonGroup (same labels, same size) is the reference on the SAME page, so font metrics cancel out:
// the strip is as wide as it (0.5 px) and its height is the token height, 26 (xs) / 34 (sm, md) px.
const HEIGHT: Record<string, number> = { xs: 26, sm: 34, md: 34 };
for (const z of ['xs', 'sm', 'md'])
  t(`ButtonGroup ${z}: token height, and the tab strip matches it`, async () => {
    const page = await open(1440);
    const m = await page.evaluate((z) => {
      const g = document.querySelector(`#fit-${z} [role=group]`)!.getBoundingClientRect();
      const s = document.querySelector(`#fit-${z} [role=tablist]`)!.getBoundingClientRect();
      return { gw: g.width, gh: g.height, sw: s.width, sh: s.height };
    }, z);
    expect(m.gh).toBe(HEIGHT[z]);
    expect(m.sh).toBe(HEIGHT[z]);
    expect(Math.abs(m.sw - m.gw)).toBeLessThan(0.5);
  });

// Touch hit-area: a tab in the strip takes its own box; every other button keeps the 44 px floor, also a
// plain ButtonGroup inside an attached panel and one at top level. The panel group also keeps the plain group's flex and white space.
t('touch: only strip tabs drop the 44 px hit-area; panel and top-level ButtonGroups keep it', () =>
  withMode(390, true, async (page) => {
    const after = (sel: string) => page.evaluate((s) => { const c = getComputedStyle(document.querySelector(s)!, '::after'); return [c.minWidth, c.minHeight]; }, sel);
    expect(await after('#fit-xs [role=group] button')).toEqual(['44px', '44px']);
    expect(await after('#panelgrp [role=tabpanel] [role=group] button')).toEqual(['44px', '44px']);
    expect(await after('#panelgrp [role=tablist] [role=tab]')).toEqual(['0px', '0px']);
    expect(await after('#fit-xs [role=tablist] [role=tab]')).toEqual(['0px', '0px']);
        const s = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('#panelgrp [role=tabpanel] [role=group] button:last-child')!); return { grow: c.flexGrow, shrink: c.flexShrink, ws: c.whiteSpace }; });
    // Computed styles (not a rendered wrap): flex 0 1 auto and normal white space, as in any plain ButtonGroup.
    expect(s).toEqual({ grow: '0', shrink: '1', ws: 'normal' });
  }));

// True overflow keeps its fade: data-r while content is hidden to the right, data-l once scrolled.
for (const id of ['over', 'att7'])
  t(`${id}: real overflow still sets data-r, then data-l after scrolling`, async () => {
    const page = await open(360);
    const sc = `#${id} ${id === 'over' ? '[role=tablist]' : '.tabs-attached-bar'}`;
    const has = (a: string, v: boolean) => until(page, ([s, a, v]) => document.querySelector(s as string)!.hasAttribute(a as string) === v, [sc, a, v] as const);
    await page.evaluate((s) => { (document.querySelector(s) as HTMLElement).scrollLeft = 0; }, sc); // the scroll event is the component's own trigger
    await has('data-r', true);
    await has('data-l', false);
    await page.evaluate((s) => { (document.querySelector(s) as HTMLElement).scrollLeft = 40; }, sc);
    await has('data-l', true);
  });

// ── 0.12.2 ─────────────────────────────────────────────────────────────────────────────────────
// Touch: every tab in a strip is as tall as the kit's touch control token (--ctl-m), also at xs; desktop xs stays compact.
const tokenPx = (page: import('playwright-core').Page, v: string) =>
  page.evaluate((v) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;height:var(${v})`; document.body.append(d); const h = d.getBoundingClientRect().height; d.remove(); return h; }, v);
const tabBoxes = (page: import('playwright-core').Page, z: string) =>
  page.evaluate((z) => [...document.querySelectorAll(`#fit-${z} [role=tab]`)].map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }), z);
for (const z of ['xs', 'sm', 'md'])
  t(`touch: ${z} tabs (group and attached) are at least the touch floor tall and wide`, () =>
    withMode(390, true, async (page) => {
      const floor = await tokenPx(page, '--ctl-m');
      expect(floor).toBeGreaterThanOrEqual(44);
      const boxes = await tabBoxes(page, z);
      expect(boxes.length).toBe(4);
      for (const b of boxes) {
        expect(b.h).toBeGreaterThanOrEqual(floor);
        expect(b.w).toBeGreaterThanOrEqual(floor); // "$" included
      }
      const strip = await page.evaluate((z) => [...document.querySelectorAll(`#fit-${z} [role=tablist]`)].map((e) => e.getBoundingClientRect().height), z);
      for (const h of strip) expect(h).toBe(floor + 2); // floor + the group's two 1px borders
    }));
t('desktop: xs tabs stay compact, below the touch floor', () =>
  withMode(1440, false, async (page) => {
    const floor = await tokenPx(page, '--ctl-m');
    const boxes = await tabBoxes(page, 'xs');
    for (const b of boxes) expect(b.h).toBeLessThan(floor);
    expect(await page.evaluate(() => document.querySelector('#fit-xs [role=tablist]')!.getBoundingClientRect().height)).toBe(26);
  }));
t('touch: plain xs ButtonGroup is unchanged (token height, not the touch floor)', () =>
  withMode(390, true, async (page) => {
    const s = await tokenPx(page, '--ctl-s');
    expect(await page.evaluate(() => document.querySelector('#fit-xs [role=group]')!.getBoundingClientRect().height)).toBe(s + 2);
  }));

// Hover on an unselected tab is the --bg-3 token (never the selected fill), in both themes; a hovered selected tab stays
// selected; a hovered disabled tab does not change at all. Each wait polls the computed value, so a lagging transition cannot flake.
const SEL = { group: '#fit-sm [role=tablist]:not(.btn-group-attached)', attached: '#fit-sm .btn-group-attached' };
const DIS = { group: '#dis [role=tablist]:not(.btn-group-attached)', attached: '#dis .btn-group-attached' };
for (const theme of ['dark', 'light'])
  for (const kind of ['group', 'attached'] as const) {
    const bgOf = (page: import('playwright-core').Page, el: string) => page.evaluate((s) => getComputedStyle(document.querySelector(s)!).backgroundColor, el);
    const reaches = (page: import('playwright-core').Page, el: string, want: string) => until(page, ([s, w]) => getComputedStyle(document.querySelector(s)!).backgroundColor === w, [el, want] as [string, string]);
    t(`hover: unselected tab is --bg-3, selected stays selected (${theme}, ${kind})`, async () => {
      const page = await open(1440, theme);
      await until(page, () => document.getAnimations().length === 0); // the theme switch itself transitions colours
      const token = await page.evaluate(() => { const d = document.createElement('div'); d.style.background = 'var(--bg-3)'; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
      const idle = `${SEL[kind]} [role=tab][aria-selected=false]`, on = `${SEL[kind]} [role=tab][aria-selected=true]`;
      const selected = await bgOf(page, on);
      expect(token).not.toBe(selected);
      await page.hover(idle);
      await reaches(page, idle, token);
      await page.hover(on);
      await reaches(page, on, selected);
    });
    t(`hover: a disabled tab does not change (${theme}, ${kind})`, async () => {
      const page = await open(1440, theme);
      await until(page, () => document.getAnimations().length === 0);
      const off = `${DIS[kind]} [role=tab][aria-disabled=true]`;
      const idle = await bgOf(page, off);
      await page.hover(off);
      await reaches(page, off, idle);
      expect(await bgOf(page, off)).toBe(idle);
    });
  }

// Touch: equal strips keep equal tabs (each at the floor), links and disabled tabs meet the floor too, a ButtonGroup in a panel is untouched.
t('touch: equal xs strip has equal tabs of at least the floor and still fits', () =>
  withMode(390, true, async (page) => {
    const floor = await tokenPx(page, '--ctl-m');
    const m = await page.evaluate(() => { const tl = document.querySelector('#eq [role=tablist]') as HTMLElement; return { w: [...tl.children].map((k) => k.getBoundingClientRect().width), sw: tl.scrollWidth, cw: tl.clientWidth, l: tl.hasAttribute('data-l'), r: tl.hasAttribute('data-r') }; });
    expect(m.w.length).toBe(2);
    expect(Math.abs(m.w[0] - m.w[1])).toBeLessThan(0.5);
    for (const w of m.w) expect(w).toBeGreaterThanOrEqual(floor);
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    expect(m.l || m.r).toBe(false);
  }));
t('touch: link and disabled tabs meet the floor, group and attached', () =>
  withMode(390, true, async (page) => {
    const floor = await tokenPx(page, '--ctl-m');
    const m = await page.evaluate(() => [...document.querySelectorAll('#dis [role=tab]')].map((e) => { const r = e.getBoundingClientRect(); return { tag: e.tagName, dis: e.hasAttribute('aria-disabled'), w: r.width, h: r.height }; }));
    expect(m.length).toBe(6);
    expect(m.some((x) => x.tag === 'A')).toBe(true);
    expect(m.some((x) => x.dis)).toBe(true);
    for (const x of m) { expect(x.h).toBeGreaterThanOrEqual(floor); expect(x.w).toBeGreaterThanOrEqual(floor); }
  }));
t('touch: a ButtonGroup inside an attached panel keeps the plain xs height', () =>
  withMode(390, true, async (page) => {
    const s = await tokenPx(page, '--ctl-s');
    expect(await page.evaluate(() => document.querySelector('#panelgrp [role=tabpanel] [role=group]')!.getBoundingClientRect().height)).toBe(s + 2);
  }));

// A fitting strip is not scrolled by the centring step: no fade, scrollLeft 0 (4 short tabs, last one active).
for (const att of [false, true])
  t(`range: 4 short sm tabs, last active, fit at 390 touch (${att ? 'attached' : 'group'})`, () =>
    withMode(390, true, async (page) => {
      const id = att ? '#rangeatt' : '#range';
      const sc = `${id} ${att ? '.tabs-attached-bar' : '[role=tablist]'}`;
      const read = () => page.evaluate((s) => { const c = document.querySelector(s) as HTMLElement; return { sl: c.scrollLeft, l: c.hasAttribute('data-l'), r: c.hasAttribute('data-r') }; }, sc);
      expect(await read()).toEqual({ sl: 0, l: false, r: false });
      // The same strip in a container 1 and 2 px short of it (a flex row, a rounded parent): still fitted, never centred or faded.
      for (const short of [1, 2]) {
        await page.evaluate(([id, short]) => { const h = document.querySelector(id as string) as HTMLElement, w = h.querySelector('[role=tablist]')!.getBoundingClientRect().width; h.style.display = 'flex'; h.style.width = `${w - (short as number)}px`; }, [id, short] as const);
        // el.click(), not page.click: Playwright scrolls a partly hidden target into view, which is not the component's doing.
        for (const n of ['first', 'last']) await page.evaluate(([id, n]) => (document.querySelector(`${id} [role=tab]:${n}-child`) as HTMLElement).click(), [id, n]);
        await settled(page);
        expect(await read()).toEqual({ sl: 0, l: false, r: false });
        await page.evaluate((id) => { const h = document.querySelector(id) as HTMLElement; h.style.width = ''; h.style.display = ''; }, id);
      }
    }));

// RTL: the start edge is the right one; scrollLeft is negative there.
t('rtl: real overflow fades the end edge first, then the start edge once scrolled; the mask mirrors', async () => {
  const page = await open(360);
  const sc = '#over [role=tablist]';
  const ltrMask = await page.evaluate((s) => getComputedStyle(document.querySelector(s)!).maskImage, sc);
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const click = (n: string) => page.evaluate((n) => (document.querySelector(`#over [role=tab]:${n}-child`) as HTMLElement).click(), n); // el.click(): Playwright would scroll
  await click('first'); // first tab = start edge (right in RTL): re-centres, clamped at the start
  const has = (a: string, v: boolean) => until(page, ([s, a, v]) => document.querySelector(s as string)!.hasAttribute(a as string) === v, [sc, a, v] as const);
  await has('data-r', true);
  await has('data-l', false);
  expect(await page.evaluate((s) => document.querySelector(s)!.scrollLeft, sc)).toBeGreaterThanOrEqual(-1);
  await click('last');
  await has('data-l', true);
  await has('data-r', false);
  expect(await page.evaluate((s) => document.querySelector(s)!.scrollLeft, sc)).toBeLessThan(-2);
  const rtlMask = await page.evaluate((s) => getComputedStyle(document.querySelector(s)!).maskImage, sc);
  expect(ltrMask).toMatch(/90deg|to right/);
  expect(rtlMask).toMatch(/270deg|to left/);
});
