// Real-browser geometry of the ONE Button (Chromium via playwright-core): icon-only squares, prefix / postfix symmetry, cell
// context (group, bar), collapse, loading width, touch targets. Needs Chromium (`bunx playwright install chromium-headless-shell`)
// or CHROMIUM_PATH; without one every test here FAILS with that instruction.
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/buttons-browser');

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
let launching: Promise<import('playwright-core').Browser | undefined> | undefined;
async function setup() {
  if (!exe) return undefined;
  mkdirSync(cache, { recursive: true });
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/buttons-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser' });
  if (!built.success) throw new Error(built.logs.join('\n'));
  writeFileSync(join(cache, 'in.css'), `@import "${join(root, 'src/styles/index.css')}";`);
  writeFileSync(join(cache, 'tw.config.js'), `import preset from '${join(root, 'src/styles/tailwind.preset.js')}'; export default { presets: [preset], future: { hoverOnlyWhenSupported: true }, content: ['${root}/src/**/*.tsx', '${root}/test/fixtures/*.tsx'] };`);
  const tw = Bun.spawnSync([join(root, 'node_modules/.bin/tailwindcss'), '-c', join(cache, 'tw.config.js'), '-i', join(cache, 'in.css'), '-o', join(cache, 'page.css')], { stderr: 'pipe' });
  if (tw.exitCode) throw new Error(tw.stderr.toString());
  writeFileSync(join(cache, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="page.css"></head><body><script src="page.js"></script></body></html>');
  const { chromium: pw } = await import('playwright-core');
  return pw.launch({ executablePath: exe });
}
beforeAll(async () => {
  launching = setup();
  browser = await launching;
}, 120000);
afterAll(async () => { await (await launching?.catch(() => undefined))?.close(); }, 120000);

const pages: import('playwright-core').Page[] = [];
afterEach(async () => { for (const p of pages.splice(0)) await p.close().catch(() => {}); });

async function open(o: { width?: number; touch?: boolean; theme?: 'dark' | 'light' } = {}) {
  const ctx = await browser!.newContext({ viewport: { width: o.width ?? 1440, height: 900 }, ...(o.touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await ctx.newPage();
  pages.push(page);
  await page.goto(`file://${join(cache, 'index.html')}`);
  if (o.theme === 'light') await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.waitForSelector('#matrix button');
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  return page;
}
const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium-headless-shell` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 30000);

/** Pixel value of a ctl token (--ctl-s / m / l) in the page's current pointer mode. */
const ctl = (page: import('playwright-core').Page) => page.evaluate(() => {
  const px = (v: string) => { const d = document.createElement('div'); d.style.height = `var(${v})`; document.body.append(d); const h = d.getBoundingClientRect().height; d.remove(); return h; };
  return { xs: px('--ctl-s'), sm: px('--ctl-m'), md: px('--ctl-l') };
});

for (const touch of [false, true]) {
  t(`icon-only is a square, height x height, at every size (${touch ? 'touch' : 'desktop'})`, async () => {
    const page = await open({ touch, width: touch ? 390 : 1440 });
    const h = await ctl(page);
    const r = await page.evaluate(() => [...document.querySelectorAll('[data-form=icon][data-state=rest] button')].map((b) => {
      const x = b.getBoundingClientRect();
      return { size: b.getAttribute('data-size')!, w: x.width, h: x.height };
    }));
    expect(r.length).toBe(12);
    for (const x of r) {
      expect(x.w).toBe(x.h);
      expect(x.h).toBe(h[x.size as 'xs' | 'sm' | 'md']);
    }
    await page.close();
  });
}

t('touch: sm icon-only is a 44 px target, xs gets a 44 px hit area', async () => {
  const page = await open({ touch: true, width: 390 });
  const m = await page.evaluate(() => {
    const get = (s: string) => document.querySelector(`[data-cell="${s}-icon-primary-rest"] button, [data-cell="${s}-icon-secondary-rest"] button`)!;
    const sm = get('sm'), xs = document.querySelector('[data-cell="xs-icon-secondary-rest"] button')!;
    return { sm: sm.getBoundingClientRect().width, smH: sm.getBoundingClientRect().height, xsH: xs.getBoundingClientRect().height, xsHit: [getComputedStyle(xs, '::after').minWidth, getComputedStyle(xs, '::after').minHeight] };
  });
  expect(m.sm).toBe(44);
  expect(m.smH).toBe(44);
  expect(m.xsH).toBe(32);
  expect(m.xsHit).toEqual(['44px', '44px']);
  await page.close();
});

t('prefix and postfix trim the same: icon-side inset equals the icon-only inset, label side keeps the text padding', async () => {
  const page = await open();
  const r = await page.evaluate(() => (['xs', 'sm', 'md'] as const).map((size) => {
    const q = (form: string) => document.querySelector(`[data-cell="${size}-${form}-secondary-rest"] button`)!;
    const inset = (b: Element, side: 'l' | 'r') => {
      const ic = b.querySelector('[data-btn-icon]')!.getBoundingClientRect(), bb = b.getBoundingClientRect();
      return side === 'l' ? ic.left - bb.left : bb.right - ic.right;
    };
    const only = q('icon'), pre = q('prefix'), post = q('postfix');
    const oi = only.querySelector('[data-btn-icon]')!.getBoundingClientRect(), ob = only.getBoundingClientRect();
    return { size, pre: inset(pre, 'l'), post: inset(post, 'r'), only: oi.left - ob.left, onlyR: ob.right - oi.right, icon: oi.width };
  }));
  for (const x of r) {
    expect(x.pre).toBe(x.post);
    expect(x.pre).toBe(x.only);
    expect(x.only).toBe(x.onlyR);
  }
  expect(r.map((x) => x.icon)).toEqual([12, 16, 16]); // the Button owns the glyph size
  await page.close();
});

t('in a ButtonGroup squeezed to 150 px: icon-only cells stay squares, text cells truncate', async () => {
  const page = await open();
  const r = await page.evaluate(() => [420, 150].map((w) => {
    const g = document.querySelector(`#group-${w} [role=group]`)!;
    const icons = [...g.querySelectorAll('[data-icon-only]')].map((b) => { const x = b.getBoundingClientRect(); return { w: x.width, h: x.height }; });
    return { w, icons, gw: g.getBoundingClientRect().width };
  }));
  for (const x of r) for (const i of x.icons) { expect(i.w).toBe(i.h); expect(i.w).toBe(32); }
  for (const x of r) expect(x.gw).toBeLessThanOrEqual(x.w + 0.5); // the group fits its container: text cells give way, icon cells do not
  await page.close();
});

t('in a SectionBar: an icon-only cell is a square at bar height; no radius, no border of its own', async () => {
  const page = await open();
  const r = await page.evaluate(() => {
    const bar = document.querySelector('#bar-800 .section-bar')!;
    const b = bar.querySelector('[aria-label=Refresh]')!, cs = getComputedStyle(b), x = b.getBoundingClientRect();
    return { barH: bar.getBoundingClientRect().height, w: x.width, h: x.height, radius: cs.borderTopLeftRadius, bw: cs.borderTopWidth };
  });
  expect(r.w).toBe(r.barH);
  expect(r.h).toBe(r.barH - 1); // the bar's own bottom rule
  expect(r.radius).toBe('0px');
  expect(r.bw).toBe('0px');
  await page.close();
});

t('collapse: labels drop by priority as the bar narrows; the primary never collapses; names stay', async () => {
  const page = await open();
  const r = await page.evaluate(() => Object.fromEntries([800, 600, 480, 380].map((w) => {
    const bar = document.querySelector(`#bar-${w} .section-bar`)!;
    const lab = (n: string) => { const b = bar.querySelector(`[aria-label="${n}"]`)!; const l = b.querySelector('.btn-label'); return { visible: !!l && getComputedStyle(l).display !== 'none', w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }; };
    const primary = [...bar.querySelectorAll('button')].find((b) => b.textContent === 'New pool')!;
    return [w, { export: lab('Export'), filters: lab('Filters'), columns: lab('Columns'), primary: !!primary.querySelector('.btn-label') && getComputedStyle(primary.querySelector('.btn-label')!).display !== 'none', named: [...bar.querySelectorAll('[data-collapse]')].every((b) => !!b.getAttribute('aria-label')) }];
  })));
  expect(r[800].export.visible && r[800].filters.visible && r[800].columns.visible).toBe(true);
  expect([r[600].export.visible, r[600].filters.visible, r[600].columns.visible]).toEqual([false, true, true]);
  expect([r[480].export.visible, r[480].filters.visible, r[480].columns.visible]).toEqual([false, false, true]);
  expect([r[380].export.visible, r[380].filters.visible, r[380].columns.visible]).toEqual([false, false, false]);
  for (const w of [800, 600, 480, 380]) { expect(r[w].primary).toBe(true); expect(r[w].named).toBe(true); }
  const bh = await page.evaluate(() => document.querySelector('#bar-380 .section-bar')!.getBoundingClientRect().height);
  expect(r[380].export.w).toBe(bh); // a collapsed cell is a square at bar height
  await page.close();
});

t('a collapsed button shows its name as the tooltip', async () => {
  const page = await open();
  await page.hover('#bar-380 [aria-label=Export]');
  expect(await page.getAttribute('#bar-380 [aria-label=Export]', 'title')).toBe('Export');
  await page.hover('#bar-380 [aria-label=Refresh]');
  expect(await page.getAttribute('#bar-380 [aria-label=Refresh]', 'title')).toBe('Refresh');
  await page.close();
});

t('loading keeps the width, never disables, and sets aria-busy', async () => {
  const page = await open();
  const r = await page.evaluate(() => ['text', 'prefix', 'postfix', 'icon'].flatMap((form) => ['xs', 'sm', 'md'].map((size) => {
    const a = document.querySelector(`[data-cell="${size}-${form}-secondary-rest"] button`)!, b = document.querySelector(`[data-cell="${size}-${form}-secondary-loading"] button`)!;
    return { form, size, rest: a.getBoundingClientRect().width, loading: b.getBoundingClientRect().width, disabled: (b as HTMLButtonElement).disabled, busy: b.getAttribute('aria-busy'), spinner: !!b.querySelector('.spinner') };
  })));
  for (const x of r) {
    expect(x.loading).toBe(x.rest);
    expect(x.disabled).toBe(false);
    expect(x.busy).toBe('true');
    expect(x.spinner).toBe(true);
  }
  await page.close();
});

t('a labelled button keeps one line at every size', async () => {
  const page = await open();
  const r = await page.evaluate(() => [...document.querySelectorAll('[data-form=text] button, [data-form=prefix] button, [data-form=postfix] button')].map((b) => ({ h: b.getBoundingClientRect().height, ctl: b.getAttribute('data-size') })));
  const h = await ctl(page);
  for (const x of r) expect(x.h).toBe(h[x.ctl as 'xs' | 'sm' | 'md']);
  await page.close();
});
