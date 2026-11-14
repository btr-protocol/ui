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
  if (mismatch) await page.locator('[role=dialog] li button[aria-label^="Switch"], [role=dialog] li button[aria-label^="Passer"]').first().waitFor({ timeout: 5000 });
  else await page.getByText('Accounts', { exact: true }).waitFor({ timeout: 5000 });
  await settled(page);
  return page;
}
const shot = async (page: Page, name: string) => { if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: join(shots, `${name}.png`) }); } };
const t = (name: string, fn: () => Promise<void>, ms = 30000) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, ms);
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
    const row = [...dlg.querySelectorAll('li')].find((d) => d.textContent?.startsWith('Your wallet is on') && d.classList.contains('border-b') && d.classList.contains('px-3'))!;
    const acct = [...dlg.querySelectorAll('button')].find((b) => b.textContent?.includes('0xaB7B…0760') && b.classList.contains('border-b'))!;
    const a = row.getBoundingClientRect(), b = acct.getBoundingClientRect();
    const cs = getComputedStyle(row), cb = getComputedStyle(acct);
    return { left: [a.left, b.left], right: [a.right, b.right], radius: cs.borderRadius, bw: [cs.borderTopWidth, cs.borderBottomWidth, cb.borderBottomWidth], overflow: row.scrollWidth > row.clientWidth, px: [cs.paddingLeft, cb.paddingLeft], icon: !!row.querySelector('svg'), tag: row.tagName, inList: row.parentElement?.tagName, nestedSurface: !!row.closest('.surface')?.parentElement?.closest('.surface') };
  });
  expect(m.left[0]).toBe(m.left[1]);
  expect(m.right[0]).toBe(m.right[1]);
  expect(m.radius).toBe('0px');
  expect(m.bw).toEqual(['0px', '1px', '1px']);
  expect(m.px[0]).toBe(m.px[1]);
  expect(m.overflow).toBe(false);
  expect(m.icon).toBe(true);
  expect(m.nestedSurface).toBe(false);
  expect([m.tag, m.inList]).toEqual(['LI', 'UL']);
});

// The row's actions are the plain kit Buttons ("our usual"): primary + secondary, same height / radius as their reference twins, ONE line.
for (const [w, sc] of [[1440, 'share'], [390, 'share'], [360, 'share'], [360, 'share-fr']] as const)
  t(`both actions: kit Buttons (primary + secondary), one line, inside the row (${w}px, ${sc})`, async () => {
    const page = await open(sc, w);
    const m = await page.evaluate(() => {
      const geo = (el: Element) => { const c = getComputedStyle(el), r = el.getBoundingClientRect(); return { r: c.borderRadius, h: r.height, right: r.right, ws: c.whiteSpace, bg: c.backgroundColor }; };
      const refs = [geo(document.querySelector('#ref-primary')!), geo(document.querySelector('#ref-secondary')!)];
      const dlg = document.querySelector('[role=dialog]')!;
      const row = [...dlg.querySelectorAll('li')].find((d) => d.classList.contains('border-b') && d.querySelector('button'))!;
      return { refs, row: row.getBoundingClientRect().right, acts: [...row.querySelectorAll('button')].map((b) => ({ ...geo(b), overflowing: b.scrollWidth > b.clientWidth, label: b.textContent, aria: b.getAttribute('aria-label') })) };
    });
    expect(m.acts).toHaveLength(2);
    m.acts.forEach((a, i) => {
      expect(a.h).toBe(m.refs[i].h);
      expect(a.r).toBe(m.refs[i].r);
      expect(a.bg).toBe(m.refs[i].bg); // primary is filled, secondary is not: the kit's own distinction
      expect(a.overflowing).toBe(false);
      expect(a.right).toBeLessThanOrEqual(m.row);
      expect(a.aria?.startsWith(a.label ?? '?')).toBe(true); // the visible label leads the accessible name
    });
  });

// Addresses in the notice text and the row caption are never split or cut.
for (const [w, sc] of [[360, 'share'], [360, 'share-fr'], [390, 'reject']] as const)
  t(`no address is split across lines and no row caption is truncated (${w}px, ${sc})`, async () => {
    const page = await open(sc, w);
    if (sc === 'reject') { await page.getByRole('button', { name: /^Switch wallet to/ }).click(); await page.getByText(/Request cancelled/).waitFor({ timeout: 5000 }); }
    const m = await page.evaluate(() => {
      const dlg = document.querySelector('[role=dialog]')!;
      const spans = [...dlg.querySelectorAll('li span.whitespace-nowrap')].map((e) => ({ t: e.textContent, lines: e.getClientRects().length }));
      const caps = [...dlg.querySelectorAll('span.text-2xs')].map((e) => ({ t: e.textContent, cut: e.scrollWidth > e.clientWidth }));
      return { spans, caps };
    });
    expect(m.spans.length).toBeGreaterThan(0);
    for (const s of m.spans) expect([s.t, s.lines]).toEqual([s.t, 1]);
    for (const c of m.caps) expect([c.t, c.cut]).toEqual([c.t, false]);
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
    const row = [...dlg.querySelectorAll('li')].find((d) => d.textContent?.startsWith('Request cancelled') && d.classList.contains('border-b'))!;
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
  for (const [w, theme] of [[1440, 'dark'], [1440, 'light'], [390, 'dark'], [390, 'light'], [360, 'dark'], [360, 'light']] as const)
    t(`screenshots ${w} ${theme}`, async () => {
      let page = await open('share', w, theme);
      await shot(page, `r3-mismatch-${w}-${theme}`);
      await accountRow(page).click();
      await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });
      await page.getByRole('button', { name: /open account/ }).click();
      await page.getByText('Accounts', { exact: true }).waitFor({ timeout: 5000 });
      await settled(page);
      await shot(page, `r3-after-${w}-${theme}`);
      page = await open('reject', w, theme);
      await page.getByRole('button', { name: /Switch wallet to/ }).click();
      await page.getByText(/Request cancelled in Rabby/).waitFor({ timeout: 5000 });
      await shot(page, `r3-rejected-${w}-${theme}`);
    }, 90000);
  t('screenshots 360 dark FR', async () => {
    let page = await open('share-fr', 360, 'dark');
    await shot(page, 'r3-mismatch-fr-360-dark');
    page = await open('reject-fr', 360, 'dark');
    await page.getByRole('button', { name: /Passer sur/ }).click();
    await page.getByText(/Request cancelled in Rabby/).waitFor({ timeout: 5000 });
    await shot(page, 'r3-rejected-fr-360-dark');
  }, 90000);
