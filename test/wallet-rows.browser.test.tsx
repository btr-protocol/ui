// Real-browser checks of the connect modal rows (Chromium via playwright-core): one-surface rows, the hover-only remove
// button, and the wallet mark's fallback. Needs Chromium (`bunx playwright install chromium`).
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// KIT_ROOT points the same tests at another checkout (e.g. the old markup) to prove they fail there.
const root = process.env.KIT_ROOT ?? join(import.meta.dir, '..');
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
// The browser close is bounded and reported (console.error with the file name) when it stalls: every test has already run by then.
afterAll(async () => {
  const b = await launching?.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<void>((done) => { timer = setTimeout(() => { console.error('wallet-rows.browser.test.tsx: browser close stalled for 25 s'); done(); }, 25000); });
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

async function open(o: { touch?: boolean; light?: boolean; width?: number; icon?: 'ok' | 'broken'; pending?: boolean; reducedMotion?: boolean } = {}) {
  const ctx = await browser!.newContext({ viewport: { width: o.width ?? 1440, height: 900 }, ...(o.touch ? { hasTouch: true, isMobile: true } : {}), colorScheme: o.light ? 'light' : 'dark', ...(o.reducedMotion ? { reducedMotion: 'reduce' as const } : {}) });
  contexts.push(ctx);
  const page = await ctx.newPage();
  await page.goto(`file://${join(cache, 'index.html')}${o.icon ? `?icon=${o.icon}` : o.pending ? '?pending=1' : ''}`);
  if (o.light) await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.getByRole('group', { name: 'Installed' }).getByRole('button').first().waitFor();
  await page.getByRole('group', { name: 'Recent' }).getByRole('button').first().waitFor();
  await page.waitForFunction(() => [...document.images].every((i) => i.complete)); // icons settled
  return page;
}
// Computed colors serialize as rgb(), color(srgb ...) or oklab(...); a translucent one carries an alpha (`rgba(` or ` / a`).
const opaque = (c: string) => !c.includes('/') && !c.startsWith('rgba') && c !== 'transparent';

const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 30000);


type Loc = import('playwright-core').Locator;
const settle = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'));
const list = (page: Page, name: string) => page.getByRole('group', { name });
const row = (page: Page, group: string, wallet: string) => list(page, group).getByRole('button', { name: new RegExp(`^${wallet}`) });
const remove = (page: Page, wallet: string) => page.getByRole('button', { name: new RegExp(`^Remove ${wallet}\\b`) });
const box = async (l: Loc) => (await l.boundingBox())!;
/** Right edge of the "Detected" tag inside a row. */
const tagRight = async (r: Loc) => { const b = await box(r.getByText('Detected', { exact: true })); return b.x + b.width; };
/** Background of the first element under (x, y) that paints one, and that element's box: what the user sees there. */
const surfaceAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => {
    const el = document.elementsFromPoint(px, py).find((e) => { const c = getComputedStyle(e).backgroundColor; return c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent'; })!;
    const r = el.getBoundingClientRect();
    return { bg: getComputedStyle(el).backgroundColor, tag: el.tagName, left: r.left, right: r.right, label: el.getAttribute('aria-label') };
  }, [x, y] as const);

t('hovered Recent row: the area under the x is the row surface, background and accent border full width', async () => {
  const page = await open();
  const r = row(page, 'Recent', 'Ambire');
  const rest = await r.evaluate((e) => getComputedStyle(e).backgroundColor);
  await r.hover();
  await page.waitForFunction((c) => document.getAnimations().every((a) => a.playState === 'finished') && c !== getComputedStyle(document.activeElement ?? document.body).color, rest);
  await settle(page);
  const rb = await box(list(page, 'Recent')), xb = await box(remove(page, 'Ambire')); // rb: the full list width = the row's full extent
  const under = await surfaceAt(page, rb.x + rb.width - 3, xb.y + xb.height / 2); // trailing padding right of the x
  expect(under.bg).not.toBe(rest); // hover colour, not the resting one
  expect(under.right - under.left).toBeGreaterThanOrEqual(rb.width - 1); // one surface across the whole row
  expect(under.bg).toBe(await r.evaluate((e) => getComputedStyle(e).backgroundColor));
  // The accent border is the row's own, across the x area: no other element in the row paints a border-bottom, and the row spans its wrapper.
  const own = await r.evaluate((e) => {
    // The row's container: the nearest ancestor spanning the whole list width.
    const full = e.closest('[role=group]')!.getBoundingClientRect().width;
    let wrap = e.parentElement!;
    while (wrap.getBoundingClientRect().width < full - 1) wrap = wrap.parentElement!;
    const bordered = [wrap, ...wrap.children].filter((n) => parseFloat(getComputedStyle(n).borderBottomWidth) > 0);
    return { onlyRow: bordered.length === 1 && bordered[0] === e, spans: e.getBoundingClientRect().width >= wrap.getBoundingClientRect().width - 0.5 };
  });
  expect(own).toEqual({ onlyRow: true, spans: true });
  expect(await r.evaluate((e) => getComputedStyle(e).borderBottomColor)).not.toBe(await row(page, 'Installed', 'Brave').evaluate((e) => getComputedStyle(e).borderBottomColor));
});

t('keyboard-highlighted Recent row is one surface across the x area', async () => {
  const page = await open();
  const first = row(page, 'Recent', 'Ambire'), other = row(page, 'Recent', 'Rabby');
  await page.mouse.move(0, 0);
  const hl = await first.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(hl).not.toBe(await other.evaluate((e) => getComputedStyle(e).backgroundColor)); // open: first row is highlighted
  const xb = await box(remove(page, 'Ambire')), rb = await box(list(page, 'Recent'));
  const under = await surfaceAt(page, rb.x + rb.width - 3, xb.y + xb.height / 2);
  expect(under.bg).toBe(hl);
  expect(under.right - under.left).toBeGreaterThanOrEqual(rb.width - 1);
  await page.getByRole('textbox').first().focus();
  await page.keyboard.press('ArrowDown'); // the highlight moves to the next row and takes its surface the same way
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'));
  const b2 = await box(remove(page, 'Rabby'));
  expect((await surfaceAt(page, rb.x + rb.width - 3, b2.y + b2.height / 2)).bg).toBe(hl);
});

t('at rest the Detected tag aligns in Recent and Installed rows; the invisible x takes no clicks, a click on the tag connects', async () => {
  const page = await open();
  await page.mouse.move(0, 0);
  const a = await tagRight(row(page, 'Recent', 'Ambire')), b = await tagRight(row(page, 'Installed', 'Brave'));
  expect(Math.abs(a - b)).toBeLessThanOrEqual(0.5);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[aria-label^="Remove Ambire"]')!).opacity)).toBe('0');
  const heights = await Promise.all([row(page, 'Recent', 'Ambire'), row(page, 'Recent', 'Rabby'), row(page, 'Installed', 'Brave'), row(page, 'Installed', 'Phantom')].map(async (l) => (await box(l)).height));
  expect(new Set(heights).size).toBe(1);
  // The tag's trailing edge is where the x's hit box would be: the element there is the row, a click connects and removes nothing.
  const tb = await box(row(page, 'Recent', 'Ambire').getByText('Detected', { exact: true }));
  const at = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('button')?.getAttribute('aria-label') ?? 'row', [tb.x + tb.width - 2, tb.y + tb.height / 2] as const);
  expect(at).not.toMatch(/^Remove/);
  await page.mouse.click(tb.x + tb.width - 2, tb.y + tb.height / 2);
  await page.waitForFunction(() => (window as unknown as { __connected: string[] }).__connected.length > 0);
  expect(await page.evaluate(() => (window as unknown as { __connected: string[] }).__connected)).toEqual(['com.ambire.wallet']);
  expect(await remove(page, 'Ambire').count()).toBe(1);
  expect(await remove(page, 'Rabby').count()).toBe(1);
});

t('Installed tags do not move when an Installed row is hovered', async () => {
  const page = await open();
  await page.mouse.move(0, 0);
  const before = await tagRight(row(page, 'Installed', 'Brave'));
  await row(page, 'Installed', 'Brave').hover();
  await settle(page);
  expect(await tagRight(row(page, 'Installed', 'Brave'))).toBe(before);
});

t('x appears on hover and on keyboard focus, is clickable, reachable by Tab, named; the focused row takes the hover surface', async () => {
  const page = await open();
  const x = remove(page, 'Ambire');
  expect(await x.count()).toBe(1);
  await row(page, 'Recent', 'Rabby').hover();
  await settle(page);
  const hover = await row(page, 'Recent', 'Rabby').evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.mouse.move(0, 0);
  await settle(page);
  await row(page, 'Recent', 'Ambire').focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toMatch(/^Remove Ambire from recent/);
  await settle(page);
  expect(await x.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  expect(await row(page, 'Recent', 'Ambire').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(hover); // same surface as hover
  const xb = await box(x), at = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('button')?.getAttribute('aria-label'), [xb.x + xb.width / 2, xb.y + xb.height / 2] as const);
  expect(at).toMatch(/^Remove Ambire/);
  await x.click();
  await page.waitForFunction(() => document.querySelectorAll('[aria-label^="Remove"]').length === 1);
});

t('a mouse click on a row does not leave the x or the surface stuck', async () => {
  const page = await open();
  await row(page, 'Recent', 'Rabby').click();
  await page.mouse.move(0, 0);
  await settle(page);
  expect(await remove(page, 'Rabby').evaluate((e) => getComputedStyle(e).opacity)).toBe('0');
});

t('removing a recent moves focus to the next row x, else the previous, else the search box', async () => {
  const page = await open();
  await remove(page, 'Ambire').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Remove Rabby'));
  expect(await remove(page, 'Ambire').count()).toBe(0);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
  const p2 = await open();
  await remove(p2, 'Rabby').focus(); // last row: focus goes to the previous one
  await p2.keyboard.press('Enter');
  await p2.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Remove Ambire'));
});

t('touch 390: every row shares one trailing edge, the x is 44 px and available', async () => {
  const page = await open({ touch: true, width: 390 });
  expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
  const a = await tagRight(row(page, 'Recent', 'Ambire')), b = await tagRight(row(page, 'Recent', 'Rabby')), c = await tagRight(row(page, 'Installed', 'Brave')), d = await tagRight(row(page, 'Installed', 'Phantom'));
  for (const v of [b, c, d]) expect(Math.abs(v - a)).toBeLessThanOrEqual(0.5);
  const link = await box(list(page, 'Other').getByRole('link').first().locator('svg').last());
  expect(Math.abs(link.x + link.width - a)).toBeLessThanOrEqual(0.5); // measured: both right edges are exactly the content edge (390 - 44 gutter = 346): the badge and the 16 px link glyph have no inner padding
  const xb = await box(remove(page, 'Ambire'));
  expect(xb.width).toBeGreaterThanOrEqual(44);
  expect(xb.height).toBeGreaterThanOrEqual(44);
  expect(await remove(page, 'Ambire').evaluate((e) => getComputedStyle(e).opacity)).toBe('1'); // full strength, not CloseButton's 70%
  await remove(page, 'Ambire').tap();
  await page.waitForFunction(() => document.querySelectorAll('[aria-label^="Remove"]').length === 1);
});

/** The tile of the first wallet row's image mark. */
const tileOf = (page: Page, wallet: string) => row(page, 'Recent', wallet).locator('span[aria-hidden=true]').first();

for (const light of [false, true])
  t(`an announced icon with transparent areas: fixed light opaque tile, no generic glyph under it (${light ? 'light' : 'dark'})`, async () => {
    const page = await open({ light });
    const tile = tileOf(page, 'Ambire');
    await tile.locator('img').evaluate((i: HTMLImageElement) => new Promise<void>((done) => (i.complete ? done() : i.addEventListener('load', () => done())))); // Ambire's own image has loaded (an SVG may report naturalWidth 0)
    expect(await tile.locator('svg').count()).toBe(0); // the generic glyph is not under the loaded image
    expect(await tile.locator('img').count()).toBe(1);
    const bg = await tile.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(opaque(bg)).toBe(true);
    // Same light tile as the brand rows, in both themes: a canvas read of the computed colour gives its lightness.
    const lum = await page.evaluate((c) => { const k = document.createElement('canvas').getContext('2d')!; k.fillStyle = c; k.fillRect(0, 0, 1, 1); const [r, g, b] = k.getImageData(0, 0, 1, 1).data; return (r + g + b) / 3; }, bg);
    expect(lum).toBeGreaterThan(220);
    if (light) expect(bg).toBe(await open().then((d) => tileOf(d, 'Ambire').evaluate((el) => getComputedStyle(el).backgroundColor)));
  });

t('an icon that fails to load: no image left, the generic glyph on the neutral tile', async () => {
  const page = await open({ icon: 'broken' });
  const tile = tileOf(page, 'Ambire');
  await tile.locator('img').waitFor({ state: 'detached' });
  await tile.locator('svg').waitFor();
  const bg = await tile.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(opaque(bg)).toBe(true);
  const lum = await page.evaluate((c) => { const k = document.createElement('canvas').getContext('2d')!; k.fillStyle = c; k.fillRect(0, 0, 1, 1); const [r, g, b] = k.getImageData(0, 0, 1, 1).data; return (r + g + b) / 3; }, bg);
  expect(lum).toBeLessThan(120); // the dark generic tile, not the light image tile
});

t('a pending connection disables and hides the x: a click in the gutter removes nothing', async () => {
  const page = await open({ pending: true });
  await row(page, 'Installed', 'Brave').click(); // the wallet popup never answers: connecting
  await page.waitForFunction(() => (document.querySelector('[aria-label^="Remove Ambire"]') as HTMLButtonElement).disabled);
  expect(await remove(page, 'Rabby').isDisabled()).toBe(true);
  const rb = await box(row(page, 'Recent', 'Ambire'));
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
  expect(await remove(page, 'Ambire').evaluate((e) => getComputedStyle(e).opacity)).toBe('0'); // hovered row, still hidden
  await page.mouse.click(rb.x + rb.width - 10, rb.y + rb.height / 2); // the gutter
  expect(await remove(page, 'Ambire').count()).toBe(1);
  expect(await remove(page, 'Rabby').count()).toBe(1);
});

t('reduced motion: the x is armed the moment it is shown (no inert delay)', async () => {
  const page = await open({ reducedMotion: true });
  await row(page, 'Recent', 'Rabby').hover();
  const m = await remove(page, 'Rabby').evaluate((e) => ({ pe: getComputedStyle(e).pointerEvents, anim: getComputedStyle(e).animationName }));
  expect(m.pe).toBe('auto'); // read straight after the hover: no 180 ms of visible-but-inert
  await settle(page);
  expect(await remove(page, 'Rabby').evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  await remove(page, 'Rabby').click();
  await page.waitForFunction(() => document.querySelectorAll('[aria-label^="Remove"]').length === 1);
});
