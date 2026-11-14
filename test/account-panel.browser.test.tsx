// Real-browser checks of the wallet account panel (Chromium via playwright-core): geometry and computed styles cannot be asserted in
// a DOM emulation. Fake wallets only. Needs Chromium (`bunx playwright install chromium`): without one every test here fails.
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/account-browser');
const shots = process.env.ACCOUNT_SHOTS; // optional directory: the screenshots the PR describes

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
type Page = import('playwright-core').Page;
let browser: import('playwright-core').Browser | undefined;
let launching: Promise<import('playwright-core').Browser | undefined> | undefined;
async function setup() {
  if (!exe) return undefined;
  mkdirSync(cache, { recursive: true });
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/account-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser', define: { 'import.meta.url': '"file:///kit/x.js"' } });
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

const pages: { page: Page; ctx: import('playwright-core').BrowserContext }[] = [];
afterEach(async () => { for (const p of pages.splice(0)) await p.ctx.close().catch(() => {}); });

// The modal fades in: measure and shoot only once it is opaque and a frame has painted.
async function settled(page: Page) {
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[role=dialog]')!).opacity === '1' && [...document.querySelectorAll('[role=dialog] *')].every((e) => getComputedStyle(e).opacity !== '0'), undefined, { timeout: 5000 });
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

async function open(scenario: string, width = 1440, theme = 'dark', mismatch = true) {
  const ctx = await browser!.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  pages.push({ page, ctx });
  await page.goto(`file://${join(cache, 'index.html')}#${scenario}`);
  if (theme === 'light') await page.evaluate(() => document.documentElement.classList.add('light'));
  await page.getByRole('button', { name: /open account/ }).click();
  if (mismatch) await page.getByText('Signing now would fail').waitFor({ timeout: 5000 });
  else await page.getByText('Accounts', { exact: true }).waitFor({ timeout: 5000 });
  await settled(page);
  return page;
}
const shot = async (page: Page, name: string) => { if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: join(shots, `${name}.png`) }); } };
const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 30000);
type Store = { address?: string; wallet?: string };
const state = (page: Page) => page.evaluate(() => (window as unknown as { __state: () => Store }).__state());
const walletIs = (page: Page, name: string) => page.waitForFunction((n) => (window as unknown as { __state: () => Store }).__state().wallet === n, name, { timeout: 5000 });
const accountRow = (page: Page) => page.locator('[role=dialog] button.border-b', { hasText: '0xaB7B…0760' });
// The glyph beside the address in the modal's header: the announced mark's src, or 'generic' for the kit's wallet icon.
const headerIcon = (page: Page) => page.evaluate(() => (document.querySelector('[role=dialog] [title^="0x"]')?.previousElementSibling as HTMLElement | null)?.querySelector('img')?.getAttribute('src') ?? 'generic');

t('the warning is a row of the account list: same edges, same divider, no card; text wraps inside it', async () => {
  const page = await open('share', 390);
  const m = await page.evaluate(() => {
    const dlg = document.querySelector('[role=dialog]')!;
    const row = [...dlg.querySelectorAll('div')].find((d) => d.textContent?.startsWith('Your wallet is on') && d.classList.contains('border-b') && d.classList.contains('px-3'))!;
    const acct = [...dlg.querySelectorAll('button')].find((b) => b.textContent?.includes('0xaB7B…0760') && b.classList.contains('border-b'))!;
    const a = row.getBoundingClientRect(), b = acct.getBoundingClientRect();
    const cs = getComputedStyle(row), cb = getComputedStyle(acct);
    return { left: [a.left, b.left], right: [a.right, b.right], radius: cs.borderRadius, bw: [cs.borderTopWidth, cs.borderBottomWidth, cb.borderBottomWidth], overflow: row.scrollWidth > row.clientWidth, px: [cs.paddingLeft, cb.paddingLeft], icon: !!row.querySelector('svg'), nestedSurface: !!row.closest('.surface')?.parentElement?.closest('.surface') };
  });
  expect(m.left[0]).toBe(m.left[1]);
  expect(m.right[0]).toBe(m.right[1]);
  expect(m.radius).toBe('0px');
  expect(m.bw).toEqual(['0px', '1px', '1px']);
  expect(m.px[0]).toBe(m.px[1]);
  expect(m.overflow).toBe(false);
  expect(m.icon).toBe(true);
  expect(m.nestedSurface).toBe(false);
});

for (const w of [1440, 390, 360])
  t(`both actions are kit Buttons: same radius, height and look as a reference Button (${w}px)`, async () => {
    const page = await open('share', w);
    // The refs sit in one `.surface`, as the modal's rows do: the kit nests control radii by surface depth.
    const get = (sel: string) => page.evaluate((s) => { const el = (document.querySelector(s) ?? [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent?.startsWith(s)))!; const c = getComputedStyle(el); return { r: c.borderRadius, h: el.getBoundingClientRect().height, f: `${c.fontSize} ${c.fontFamily} ${c.fontWeight}`, bg: c.backgroundColor, bd: c.borderColor }; }, sel);
    const refP = await get('#ref-primary'), refS = await get('#ref-secondary');
    const sw = await get('Switch wallet to'), use = await get('Use ');
    expect(sw).toEqual(refP);
    expect(use).toEqual(refS);
  });

t('clicking the account row activates the wallet that holds it: no mismatch row, header mark is that wallet\'s', async () => {
  const page = await open('share');
  expect(await headerIcon(page)).toBe('generic'); // Ambire is connected but does not hold the account shown: never Ambire's mark
  await accountRow(page).click();
  await walletIs(page, 'Rabby');
  expect(await state(page)).toEqual({ address: '0xaB7B000000000000000000000000000000000760', wallet: 'Rabby' });
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 }); // the modal closes after a switch
  await page.getByRole('button', { name: /open account/ }).click();
  await page.getByText('Accounts', { exact: true }).waitFor({ timeout: 5000 });
  expect(await page.getByText('Signing now would fail').count()).toBe(0);
  expect(decodeURIComponent(await headerIcon(page))).toContain('#00ffff'); // Rabby's announced mark
});

t('rejected in the other wallet: a list row names it; nothing is switched', async () => {
  const page = await open('reject');
  await page.getByRole('button', { name: /Switch wallet to/ }).click();
  await page.getByText(/Request cancelled in Rabby/).waitFor({ timeout: 5000 });
  const m = await page.evaluate(() => {
    const dlg = document.querySelector('[role=dialog]')!;
    const row = [...dlg.querySelectorAll('div')].find((d) => d.textContent?.startsWith('Request cancelled') && d.classList.contains('border-b'))!;
    return { radius: getComputedStyle(row).borderRadius, alert: row.querySelector('[role=alert]') !== null };
  });
  expect(m).toEqual({ radius: '0px', alert: true });
  expect((await state(page)).wallet).toBe('Ambire');
});

t('the current row has no pointer and no focus stop; an actionable row is a focusable button', async () => {
  const page = await open('match', 1440, 'dark', false);
  const m = await page.evaluate(() => {
    const cur = document.querySelector('[role=dialog] [aria-current=true]') as HTMLElement;
    const act = [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent?.includes('0xaB7B…0760') && b.classList.contains('border-b')) as HTMLElement;
    return { cursor: getComputedStyle(cur).cursor, tag: cur.tagName, tab: cur.tabIndex, aTag: act.tagName };
  });
  expect(m).toEqual({ cursor: 'default', tag: 'DIV', tab: -1, aTag: 'BUTTON' });
});

t('keyboard: the account row takes focus and Enter activates it', async () => {
  const page = await open('share');
  await accountRow(page).focus();
  await page.keyboard.press('Enter');
  await walletIs(page, 'Rabby');
});

if (shots)
  for (const [w, theme] of [[1440, 'dark'], [1440, 'light'], [390, 'dark']] as const)
    t(`screenshots ${w} ${theme}`, async () => {
      let page = await open('share', w, theme);
      await shot(page, `mismatch-${w}-${theme}`);
      console.log('HEIGHTS', w, theme, JSON.stringify(await page.evaluate(() => {
        const h = (el?: Element | null) => Math.round((el?.getBoundingClientRect().height ?? 0) * 10) / 10;
        const dlg = document.querySelector('[role=dialog]')!;
        const btn = [...dlg.querySelectorAll('button')];
        return { accountRow: h(btn.find((b) => b.classList.contains('border-b') && b.textContent?.includes('0xaB7B'))), switchBtn: h(btn.find((b) => b.textContent?.startsWith('Switch wallet to'))), useBtn: h(btn.find((b) => b.textContent?.startsWith('Use '))), warnRow: h([...dlg.querySelectorAll('div')].find((d) => d.textContent?.startsWith('Your wallet is on') && d.classList.contains('border-b'))), addRow: h(btn.find((b) => b.textContent?.includes('Add or switch'))), refBtn: h(document.querySelector('#ref-primary')) };
      })));
      await accountRow(page).click();
      await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });
      await page.getByRole('button', { name: /open account/ }).click();
      await page.getByText('Accounts', { exact: true }).waitFor({ timeout: 5000 });
      await settled(page);
      await shot(page, `after-${w}-${theme}`);
      page = await open('reject', w, theme);
      await page.getByRole('button', { name: /Switch wallet to/ }).click();
      await page.getByText(/Request cancelled in Rabby/).waitFor({ timeout: 5000 });
      await shot(page, `rejected-${w}-${theme}`);
    });
