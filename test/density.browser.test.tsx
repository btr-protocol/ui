// Phone density scale in a real browser (Chromium via playwright-core): at 390 px with touch emulation every control, list row, menu row and
// tab strip has the proposed size and a 44 px tap target; at 1440 px with a fine pointer NOTHING changed from 0.13.1.
// KIT_ROOT=<other checkout> runs the same file against it. SHOT_DIR=<dir> [SHOT_PREFIX=today|proposed] saves the render sheet (no assertions).
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = process.env.KIT_ROOT ?? join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/density-browser');
const shotDir = process.env.SHOT_DIR;
const prefix = process.env.SHOT_PREFIX ?? 'proposed';

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
const PAGES = { density: 'density-page', wallet: 'wallet-page', account: 'account-page' } as const;
type Which = keyof typeof PAGES;
async function setup() {
  if (!exe) return undefined;
  mkdirSync(cache, { recursive: true });
  for (const [name, file] of Object.entries(PAGES)) {
    const built = await Bun.build({ entrypoints: [join(root, `test/fixtures/${file}.tsx`)], outdir: cache, naming: `${name}.js`, format: 'iife', target: 'browser', define: { 'import.meta.url': JSON.stringify(`file://${root}/src/lib/assets.ts`) } });
    if (!built.success) throw new Error(built.logs.join('\n'));
    writeFileSync(join(cache, `${name}.html`), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="page.css"></head><body><script src="${name}.js"></script></body></html>`);
  }
  writeFileSync(join(cache, 'in.css'), `@import "${join(root, 'src/styles/index.css')}";`);
  writeFileSync(join(cache, 'tw.config.js'), `import preset from '${join(root, 'src/styles/tailwind.preset.js')}'; export default { presets: [preset], future: { hoverOnlyWhenSupported: true }, content: ['${root}/src/**/*.{ts,tsx}', '${root}/test/fixtures/*.tsx'] };`);
  const tw = Bun.spawnSync([join(root, 'node_modules/.bin/tailwindcss'), '-c', join(cache, 'tw.config.js'), '-i', join(cache, 'in.css'), '-o', join(cache, 'page.css')], { stderr: 'pipe' });
  if (tw.exitCode) throw new Error(tw.stderr.toString());
  const { chromium: pw } = await import('playwright-core');
  return pw.launch({ executablePath: exe });
}
let browser: import('playwright-core').Browser | undefined;
beforeAll(async () => {
  launching = setup();
  browser = await launching;
}, 120000);
afterAll(async () => {
  const b = await launching?.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<void>((done) => { timer = setTimeout(() => { console.error('density.browser.test.tsx: browser close stalled for 25 s'); done(); }, 25000); });
  try { await Promise.race([b?.close().catch(() => {}), stalled]); } finally { clearTimeout(timer); }
}, 40000);

const contexts: import('playwright-core').BrowserContext[] = [];
afterEach(async () => {
  for (const c of contexts.splice(0)) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<never>((_, fail) => { timer = setTimeout(() => fail(new Error('context close stalled for 20 s')), 20000); });
    try { await Promise.race([c.close().catch(() => {}), stalled]); } finally { clearTimeout(timer); }
  }
}, 30000);

const PHONE = { width: 390, height: 844, touch: true };
const DESKTOP = { width: 1440, height: 900, touch: false };
type Mode = { width: number; height: number; touch: boolean; light?: boolean };
async function open(which: Which, m: Mode, q = '') {
  const ctx = await browser!.newContext({ viewport: { width: m.width, height: m.height }, ...(m.touch ? { hasTouch: true, isMobile: true } : {}), colorScheme: m.light ? 'light' : 'dark' });
  contexts.push(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(`file://${join(cache, `${which}.html`)}${q}`);
  if (m.light) await page.evaluate(() => document.documentElement.classList.add('light'));
  return page;
}
const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 40000);
const settle = (page: Page) => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))).then(() => page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished')));
const h = (page: Page, sel: string) => page.evaluate((s) => document.querySelector(s)!.getBoundingClientRect().height, sel);
/** The first element in the dialog's list whose text starts with `text`, as the row it is. */
const rows = (page: Page, scope: string, sel: string) => page.evaluate(([sc, s]) => [...document.querySelectorAll(`${sc} ${s}`)].map((e) => e.getBoundingClientRect().height), [scope, sel] as const);
/** Tap target: from the box centre, how far up and down does the control still own the point? (1 px steps, elementFromPoint.) */
async function reach(page: Page, sel: string, nth = 0) {
  return page.evaluate(([s, n]) => {
    const el = document.querySelectorAll(s)[n] as HTMLElement;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const own = (y: number) => { const e = document.elementFromPoint(cx, y); return !!e && el.contains(e); };
    let up = 0, down = 0;
    while (own(cy - up - 1) && up < 40) up++;
    while (own(cy + down) && down < 40) down++;
    return { box: r.height, up, down, total: up + down };
  }, [sel, nth] as const);
}

// ── 390 px, touch ────────────────────────────────────────────────────────────────────────────────
t('phone 390: controls s / m / l are 28 / 36 / 44, an input is 44', async () => {
  const page = await open('density', PHONE);
  expect([await h(page, '#b-s'), await h(page, '#b-m'), await h(page, '#b-l'), await h(page, '#in-l')]).toEqual([28, 36, 44, 44]);
  expect(await page.evaluate(() => ['--ctl-s', '--ctl-m', '--ctl-l', '--tab-touch'].map((v) => { const d = document.createElement('div'); d.style.cssText = `position:absolute;height:var(${v})`; document.body.append(d); const x = d.getBoundingClientRect().height; d.remove(); return x; }))).toEqual([28, 36, 44, 38]);
});

t('phone 390: tab strips are 40 tall (38 tabs + 2 borders) (group, xs, attached)', async () => {
  const page = await open('density', PHONE);
  expect([await h(page, '#tabs-group [role=tablist]'), await h(page, '#tabs-xs [role=tablist]'), await h(page, '#tabs-att [role=tablist]')]).toEqual([40, 40, 40]);
  for (const tab of await rows(page, '#tabs-group', '[role=tab]')) expect(tab).toBe(38);
  // the attached bar's padding is cancelled by its margins: the panel sits exactly where it did
  const gap = await page.evaluate(() => document.querySelector('#tabs-att [role=tablist]')!.getBoundingClientRect().bottom - document.querySelector('#tabs-att [role=tabpanel]')!.getBoundingClientRect().top);
  expect(gap).toBe(1);
  // nothing in a strip scrolls vertically or sideways because of the hit-area
  for (const s of ['#tabs-group [role=tablist]', '#tabs-xs [role=tablist]', '#tabs-att .tabs-attached-bar'])
    expect(await page.evaluate((x) => { const e = document.querySelector(x) as HTMLElement; return [e.scrollWidth - e.clientWidth, e.scrollHeight - e.clientHeight]; }, s)).toEqual([0, 0]);
});

t('phone 390: modal select rows are 44, menu rows are 44', async () => {
  const page = await open('density', PHONE, '?v=select');
  await page.getByRole('button', { name: /WBTC \/ USDC/ }).click();
  await page.locator('[role=dialog]').waitFor();
  await settle(page);
  const r = await rows(page, '[role=dialog]', 'button[class*="min-h"]');
  expect(r.length).toBeGreaterThanOrEqual(8);
  for (const x of r) expect(x).toBe(44);
  const page2 = await open('density', PHONE, '?v=menu');
  await page2.locator('#trg').click();
  await page2.locator('[role=menu]').waitFor();
  const m = await rows(page2, '[role=menu]', '[role^=menuitem]');
  expect(m).toEqual([44, 44, 44, 44]);
});

t('phone 390: wallet and account rows are 44', async () => {
  const wallet = await open('wallet', PHONE);
  await wallet.getByRole('group', { name: 'Installed' }).getByRole('button').first().waitFor();
  await settle(wallet);
  for (const x of await rows(wallet, '.wallet-rows', 'button.border-b')) expect(x).toBe(44);
  const acct = await open('account', PHONE, '#share');
  await acct.getByRole('button', { name: /open account/ }).click();
  await acct.getByText('Accounts', { exact: true }).waitFor();
  await settle(acct);
  const a = await rows(acct, '[role=dialog]', 'button.border-b');
  expect(a.length).toBeGreaterThan(0);
  for (const x of a) expect(x).toBe(44);
});

t('phone 390: tap targets are 44 px: buttons s / m, group tab, attached tab, modal row, wallet row', async () => {
  const page = await open('density', PHONE);
  for (const s of ['#b-s', '#b-m', '#b-l', '#g-plain']) expect((await reach(page, s)).total).toBeGreaterThanOrEqual(44);
  // A `wrap` ButtonGroup clips its cells (overflow: hidden, to share one outer border): its icon cell keeps the 36 px box, not 44.
  expect((await reach(page, '#g-copy')).total).toBe(36);
  // Attached strips extend vertically beyond the 40 px box through the bar's padding. A GROUP strip's scroller is the bordered element:
  // its padding box is the tab, so the target stays the 38 px box (see CHANGELOG).
  expect((await reach(page, '#tabs-att [role=tab]', 1)).total).toBeGreaterThanOrEqual(44);
  expect((await reach(page, '#tabs-group [role=tab]', 1)).total).toBe(38);
  expect((await reach(page, '#tabs-xs [role=tab]', 1)).total).toBe(38);
  const sel = await open('density', PHONE, '?v=select');
  await sel.getByRole('button', { name: /WBTC \/ USDC/ }).click();
  await settle(sel);
  expect((await reach(sel, '[role=dialog] button[class*="min-h"]', 3)).total).toBeGreaterThanOrEqual(44);
  const wallet = await open('wallet', PHONE);
  await wallet.getByRole('group', { name: 'Installed' }).getByRole('button').first().waitFor();
  await settle(wallet);
  expect((await reach(wallet, '.wallet-rows button.border-b', 2)).total).toBeGreaterThanOrEqual(44);
});

// ── 1440 px, fine pointer: nothing moved ───────────────────────────────────────────────────────────
t('desktop 1440: controls 24 / 32 / 40, input 40, tab strips 34 / 26 / 34 (0.13.1 values)', async () => {
  const page = await open('density', DESKTOP);
  expect([await h(page, '#b-s'), await h(page, '#b-m'), await h(page, '#b-l'), await h(page, '#in-l')]).toEqual([24, 32, 40, 40]);
  expect([await h(page, '#tabs-group [role=tablist]'), await h(page, '#tabs-xs [role=tablist]'), await h(page, '#tabs-att [role=tablist]')]).toEqual([34, 26, 34]);
});

t('desktop 1440: modal select rows, menu rows and wallet rows keep their 0.13.1 heights', async () => {
  const page = await open('density', DESKTOP, '?v=select');
  await page.getByRole('button', { name: /WBTC \/ USDC/ }).click();
  await page.locator('[role=dialog]').waitFor();
  await settle(page);
  const r = await rows(page, '[role=dialog]', 'button[class*="min-h"]');
  expect(r.length).toBeGreaterThanOrEqual(8);
  expect(r).toEqual([38, ...Array(r.length - 1).fill(39)]); // the first row has no divider above it
  const page2 = await open('density', DESKTOP, '?v=menu');
  await page2.locator('#trg').click();
  await page2.locator('[role=menu]').waitFor();
  expect(await rows(page2, '[role=menu]', '[role^=menuitem]')).toEqual([40, 40, 40, 40]);
  const wallet = await open('wallet', DESKTOP);
  await wallet.getByRole('group', { name: 'Installed' }).getByRole('button').first().waitFor();
  await settle(wallet);
  for (const x of await rows(wallet, '.wallet-rows', 'button.border-b')) expect(x).toBe(48);
});

t('desktop 1440: no hit-area extension (pointer: fine): the target is the box', async () => {
  const page = await open('density', DESKTOP);
  for (const [s, box] of [['#b-s', 24], ['#b-m', 32], ['#b-l', 40]] as const) expect((await reach(page, s)).total).toBe(box);
});

// ── render sheet (SHOT_DIR only) ────────────────────────────────────────────────────────────────────
const views: { name: string; run: (m: Mode) => Promise<Page> }[] = [
  { name: 'form', run: (m) => open('density', m) },
  { name: 'select', run: async (m) => { const p = await open('density', m, '?v=select'); await p.getByRole('button', { name: /WBTC \/ USDC/ }).click(); await p.locator('[role=dialog]').waitFor(); await settle(p); return p; } },
  { name: 'menu', run: async (m) => { const p = await open('density', m, '?v=menu'); await p.locator('#trg').click(); await p.locator('[role=menu]').waitFor(); await settle(p); return p; } },
  { name: 'wallet', run: async (m) => { const p = await open('wallet', m); await p.getByRole('group', { name: 'Installed' }).getByRole('button').first().waitFor(); await p.waitForFunction(() => [...document.images].every((i) => i.complete)); await settle(p); return p; } },
  { name: 'account', run: async (m) => { const p = await open('account', m, '#share'); await p.getByRole('button', { name: /open account/ }).click(); await p.getByText('Accounts', { exact: true }).waitFor(); await settle(p); return p; } },
];
if (shotDir)
  for (const [tag, m] of [['390-dark', PHONE], ['390-light', { ...PHONE, light: true }], ['1440-dark', DESKTOP]] as const)
    for (const v of views)
      t(`sheet ${prefix}-${v.name}-${tag}`, async () => {
        mkdirSync(shotDir, { recursive: true });
        const p = await v.run(m);
        await p.screenshot({ path: join(shotDir, `${prefix}-${v.name}-${tag}.png`), fullPage: v.name === 'form' });
      });
