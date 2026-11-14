// Real-browser checks of the button / menu / selected-mark rules (Chromium via playwright-core): one-line labels, compact icon cells,
// full-bleed menu rows, one SelectedCheck. SHOT_DIR=<dir> also saves 1440 / 390 renders (dark + light). Needs Chromium (`bunx playwright install chromium`).
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// KIT_ROOT points the same tests at another checkout (e.g. the old markup) to prove they fail there.
const root = process.env.KIT_ROOT ?? join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/rules-browser');

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
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/rules-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser', define: { 'import.meta.url': JSON.stringify(`file://${root}/src/lib/assets.ts`) } });
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
  const stalled = new Promise<void>((done) => { timer = setTimeout(() => { console.error('rules.browser.test.tsx: browser close stalled for 25 s'); done(); }, 25000); });
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


type V = 'group' | 'menu' | 'select' | 'dropdown' | 'confirm' | 'sort' | 'strip' | 'flex';
async function open(v: V, o: { width?: number; light?: boolean; touch?: boolean; q?: string } = {}) {
  const ctx = await browser!.newContext({ viewport: { width: o.width ?? 1440, height: 900 }, ...(o.touch ? { hasTouch: true, isMobile: true } : {}), colorScheme: o.light ? 'light' : 'dark' });
  contexts.push(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000); // a failure on main is an assertion, not the 30 s test timeout
  await page.goto(`file://${join(cache, 'index.html')}?v=${v}${o.q ?? ''}`);
  if (o.light) await page.evaluate(() => document.documentElement.classList.add('light'));
  return page;
}
async function shot(page: Page, name: string) {
  // a sheet slides in: wait until the card has stopped moving
  await page.waitForFunction(() => new Promise<boolean>((ok) => { const c = document.querySelector('.modal-card'); if (!c) return ok(true); const y = c.getBoundingClientRect().top; requestAnimationFrame(() => requestAnimationFrame(() => ok(c.getBoundingClientRect().top === y))); }));
  if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, `${name}.png`) });
}
const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 40000);
const dialogOpen = async (page: Page) => { await page.locator('[role=dialog]').waitFor(); await page.locator('[role=dialog] button').first().waitFor(); };

t('Button: a long label stays one line at 360 px and truncates with the icon visible', async () => {
  const page = await open('group', { width: 360, touch: true });
  const m = await page.evaluate(() => {
    const lone = document.querySelector('#lone button') as HTMLElement;
    const label = lone.querySelector('span') as HTMLElement;
    const short = document.createElement('button');
    short.className = lone.className; short.textContent = 'OK';
    document.body.appendChild(short);
    return { h: lone.getBoundingClientRect().height, short: short.getBoundingClientRect().height, truncates: label.scrollWidth > label.clientWidth, ellipsis: getComputedStyle(label).textOverflow, ws: getComputedStyle(lone).whiteSpace, right: lone.getBoundingClientRect().right, vw: innerWidth };
  });
  expect(m.h).toBe(m.short);
  expect(m.truncates).toBe(true);
  expect(m.ellipsis).toBe('ellipsis');
  expect(m.ws).toBe('nowrap');
  expect(m.right).toBeLessThanOrEqual(m.vw);
});

t('Button: counts, mixed text + elements truncate in a shrinking flex row; title only while cut', async () => {
  const page = await open('flex');
  const m = await page.evaluate(() => {
    const row = document.querySelector('#row') as HTMLElement;
    return ['count', 'mixed', 'fits'].map((id) => {
      const b = document.getElementById(id) as HTMLElement;
      const l = b.querySelector('[data-label]') as HTMLElement | null;
      return { id, h: b.getBoundingClientRect().height, spill: b.scrollWidth > b.clientWidth + 1, cut: l ? l.scrollWidth > l.clientWidth : false, inside: b.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1 };
    });
  });
  for (const x of m) { expect(x.spill).toBe(false); expect(x.inside).toBe(true); expect(x.h).toBe(m[2]!.h); }
  expect(m[0]!.cut || m[1]!.cut).toBe(true);
  await page.locator('#count').hover();
  expect(await page.locator('#count').getAttribute('title')).toBe('12 items selected in the list');
  await page.locator('#fits').hover();
  expect(await page.locator('#fits').getAttribute('title')).toBeNull();
});

t('ButtonGroup: icon-only cells are squares, the primary takes the spare width, nothing wraps its label', async () => {
  for (const width of [360, 1440]) {
    const page = await open('group', { width, touch: width < 1000 });
    const cells = await page.evaluate(() => [...document.querySelectorAll('.btn-group > *')].map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, icon: e.hasAttribute('data-icon-only') }; }));
    const icons = cells.filter((c) => c.icon);
    expect(icons.length).toBe(2);
    for (const c of icons) expect(Math.abs(c.w - c.h)).toBeLessThanOrEqual(1);
    for (const c of cells.filter((c) => !c.icon)) expect(c.h).toBe(icons[0]!.h);
    expect(cells[3]!.w).toBeGreaterThan(cells[2]!.w);
  }
});

t('ConfirmSheet: Cancel and Confirm keep their equal split', async () => {
  const page = await open('confirm', { width: 390, touch: true });
  await page.getByRole('group', { name: 'Actions' }).waitFor();
  const w = await page.evaluate(() => [...document.querySelectorAll('[aria-label=Actions] > *')].map((e) => e.getBoundingClientRect().width));
  expect(w.length).toBe(2);
  expect(Math.abs(w[0]! - w[1]!)).toBeLessThanOrEqual(1);
  expect(w[0]!).toBeGreaterThan(100);
  await shot(page, 'confirm-390');
});

t('Tab strip: a tab wider than the strip scrolls, its label is not ellipsized', async () => {
  const page = await open('strip');
  await page.locator('[role=tab]').nth(1).waitFor();
  const m = await page.evaluate(() => {
    const tab = document.querySelectorAll('[role=tab]')[1] as HTMLElement;
    const sc = [...document.querySelectorAll('#strip *')].find((e) => (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 1) as HTMLElement | undefined;
    const lab = tab.querySelector('[data-label]') as HTMLElement | null;
    return { tabW: tab.getBoundingClientRect().width, scrolls: !!sc, cut: lab ? lab.scrollWidth > lab.clientWidth : tab.scrollWidth > tab.clientWidth };
  });
  expect(m.tabW).toBeGreaterThan(200);
  expect(m.scrolls).toBe(true);
  expect(m.cut).toBe(false);
});

t('ClickMenu: a highlighted row touches both panel edges; the focus ring stays inside the panel', async () => {
  for (const light of [false, true]) {
    const page = await open('menu', { light });
    await page.click('#trg');
    await page.locator('[role^=menuitem]').first().waitFor();
    await page.locator('[role^=menuitem]').nth(1).hover();
    const g = await page.evaluate(() => {
      const panel = document.querySelector('.floating-panel') as HTMLElement;
      const pr = panel.getBoundingClientRect();
      const inL = pr.left + panel.clientLeft, inR = pr.right - panel.clientLeft;
      const rows = [...document.querySelectorAll('[role^=menuitem]')].map((e) => e.getBoundingClientRect());
      return { rows: rows.map((r) => ({ l: r.left - inL, r: inR - r.right })), top: rows[0]!.top - (pr.top + panel.clientTop), bottom: pr.bottom - panel.clientTop - rows.at(-1)!.bottom };
    });
    for (const r of g.rows) { expect(Math.abs(r.l)).toBeLessThan(0.5); expect(Math.abs(r.r)).toBeLessThan(0.5); }
    expect(Math.abs(g.top)).toBeLessThan(0.5);
    expect(Math.abs(g.bottom)).toBeLessThan(0.5);
    // Keyboard focus on the first and the last row: the ring (outline) lies inside the panel, nothing of it is clipped.
    for (const idx of [0, 2]) {
      await page.keyboard.press('Tab').catch(() => {});
      const ring = await page.evaluate((i) => {
        const el = document.querySelectorAll<HTMLElement>('[role^=menuitem]')[i]!;
        el.focus({ focusVisible: true } as FocusOptions);
        const cs = getComputedStyle(el);
        const panel = document.querySelector('.floating-panel') as HTMLElement;
        const r = el.getBoundingClientRect(), pr = panel.getBoundingClientRect();
        const off = parseFloat(cs.outlineOffset), w = parseFloat(cs.outlineWidth);
        return { x: [r.left, r.right, pr.left, pr.right, off, w], visible: cs.outlineStyle !== 'none' && w > 0, off, w, inside: r.left - off - w >= pr.left - 0.5 && r.right + off + w <= pr.right + 0.5 && r.top - off - w >= pr.top - 0.5 && r.bottom + off + w <= pr.bottom + 0.5 };
      }, idx);
      expect(ring.visible).toBe(true);
      expect(ring.off).toBeLessThanOrEqual(-2);
      expect(ring.inside, JSON.stringify(ring)).toBe(true);
    }
    await shot(page, `menu-1440-${light ? 'light' : 'dark'}`);
  }
});

t('SelectedCheck: the same 16 px trailing mark in SelectModal, ClickMenu and Dropdown, exposed to AT', async () => {
  const marks: { w: number; h: number; color: string; trailing: boolean; cls: string }[] = [];
  const read = (page: Page, rowSel: string) => page.locator(rowSel).evaluate((row) => {
    const c = row.querySelector('[data-selected-check]') as SVGElement;
    const r = c.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    return { w: r.width, h: r.height, color: getComputedStyle(c).color, trailing: rr.right - r.right < 40 && r.left > rr.left + rr.width / 2, cls: c.getAttribute('class')!.split(' ').filter((x) => /^(h|w|text|shrink)/.test(x)).sort().join(' ') };
  });
  let page = await open('menu');
  await page.click('#trg');
  marks.push(await read(page, '[role=menuitemradio][aria-checked=true]'));
  page = await open('select');
  await page.getByRole('button', { name: /Simulated/ }).click();
  await dialogOpen(page);
  marks.push(await read(page, '[role=dialog] button[aria-current=true]'));
  page = await open('dropdown');
  await page.getByRole('button').first().click();
  marks.push(await read(page, '[role=option][aria-selected=true] >> xpath=..'));
  expect(marks.length).toBe(3);
  for (const m of marks) { expect(m.w).toBe(16); expect(m.h).toBe(16); expect(m.trailing).toBe(true); expect(m).toEqual(marks[0]!); }
});

t('Dropdown: row heights do not depend on the check (xs / sm / default as on origin/main)', async () => {
  const want = { xs: 24, sm: 28, default: 36 } as const;
  for (const size of ['xs', 'sm', 'default'] as const) {
    const page = await open('dropdown', { q: `&size=${size}` });
    await page.locator('button[aria-haspopup=listbox], [role=button][aria-haspopup=listbox]').first().click();
    await page.locator('[data-dropdown-id] button').first().waitFor();
    const h = await page.evaluate(() => [...document.querySelectorAll('[data-dropdown-id] button')].map((b) => b.parentElement!.getBoundingClientRect().height));
    expect(h.length).toBe(3);
    for (const x of h) expect(x).toBe(want[size]);
  }
});

t('SelectModal with sort columns: a row figure and its header label share the right edge', async () => {
  const page = await open('sort');
  await page.getByRole('button', { name: /Server/ }).click();
  await page.locator('[role=dialog] [role=columnheader]').nth(1).waitFor();
  const m = await page.evaluate(() => {
    const head = [...document.querySelectorAll('[role=dialog] [role=columnheader]')][1]!.getBoundingClientRect();
    const fig = [...document.querySelectorAll('[role=dialog] .tabular-nums')].find((e) => e.textContent === '100.5')!.getBoundingClientRect();
    return { head: head.right, fig: fig.right };
  });
  expect(Math.abs(m.head - m.fig)).toBeLessThanOrEqual(0.5);
  await shot(page, 'sort-1440');
});

t('SelectModal: search shows from 7 options; the prefix trigger is one button reading "Simulated · Server"', async () => {
  const page = await open('select');
  const trg = page.getByRole('button', { name: /Simulated/ });
  expect(await trg.count()).toBe(1);
  expect((await trg.textContent())!.replace(/\s+/g, '')).toBe('Simulated·Server');
  await trg.click();
  await dialogOpen(page);
  expect(await page.locator('[role=dialog] input').count()).toBe(0);
  const page2 = await open('select');
  await page2.getByRole('button', { name: /Many/ }).click();
  await dialogOpen(page2);
  await page2.locator('[role=dialog] input').waitFor();
});

t('SelectModal without search: focus starts on the picked row, arrows move it, Enter picks', async () => {
  const page = await open('select');
  await page.getByRole('button', { name: /Simulated/ }).click();
  await dialogOpen(page);
  const label = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim());
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-sel-row'));
  expect(await label()).toBe('Server'); // the picked row
  await page.keyboard.press('ArrowDown');
  expect(await label()).toBe('Server + browser');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp'); // wraps to the last row
  expect(await label()).toBe('Browser only');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
  expect((await page.getByRole('button', { name: /Simulated/ }).textContent())!.replace(/\s+/g, '')).toBe('Simulated·Server'); // value is controlled by the fixture: still Server
});

t('renders for review (SHOT_DIR)', async () => {
  if (!process.env.SHOT_DIR) { console.log('rules.browser.test.tsx: SHOT_DIR unset, skipping the review renders'); return; }
  for (const [width, touch] of [[1440, false], [390, true]] as const) {
    const tag = `${width}-dark`;
    let p = await open('group', { width, touch });
    await shot(p, `group-${tag}`);
    p = await open('menu', { width, touch });
    await p.click('#trg');
    await p.locator('[role^=menuitem]').first().waitFor();
    await p.locator('[role^=menuitem]').nth(1).hover();
    await shot(p, `menu-${tag}`);
    p = await open('select', { width, touch });
    await p.getByRole('button', { name: /Simulated/ }).click();
    await dialogOpen(p);
    await p.waitForFunction(() => document.activeElement?.hasAttribute('data-sel-row'));
    await shot(p, `select-${tag}`);
    p = await open('select', { width, touch });
    await shot(p, `select-trigger-${tag}`);
  }
});
