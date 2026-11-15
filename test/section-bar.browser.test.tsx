// Real-browser checks (Chromium via playwright-core): geometry cannot be asserted in a DOM emulation.
// Needs Chromium (`bunx playwright install chromium`): without one every test here fails with that instruction.
import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/section-bar-browser');

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
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/section-bar-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser' });
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
  await page.waitForSelector('#after-table .section-bar');
  await settled(page);
  return page;
}
// No Chromium = a FAILING test, never a silent pass or skip: geometry is only asserted in a real browser.
const t = (name: string, fn: () => Promise<void>) =>
  test(name, async () => {
    if (!browser) throw new Error('Chromium not found: run `bunx playwright install chromium` (or set CHROMIUM_PATH to a chrome-headless-shell binary)');
    await fn();
  }, 30000);

// Every bar of the proposal (after-table + after-card): 5 variants x 2 bodies.
const BARS = '#after-table .section-bar, #after-card .section-bar';

for (const w of [1440, 390]) {
  t(`all variants share one bar height, with or without search / title (${w}px)`, async () => {
    const page = await open(w);
    const h = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().height), BARS);
    expect(h.length).toBe(10);
    expect(new Set(h).size).toBe(1);
    const ctl = await page.evaluate(() => { const d = document.createElement('div'); d.style.height = 'var(--ctl-m)'; document.body.append(d); const v = d.getBoundingClientRect().height; d.remove(); return v; });
    expect(h[0]).toBe(ctl);
    await page.close();
  });

  t(`no horizontal page scroll (${w}px)`, async () => {
    const page = await open(w);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(o).toBeLessThanOrEqual(0);
    await page.close();
  });
}

t('search side decides which top corner is rounded', async () => {
  const page = await open(1440);
  const r = await page.evaluate(() => [...document.querySelectorAll('#after-card .section-bar')].map((bar) => {
    const s = bar.querySelector('.sb-search');
    if (!s) return null;
    const c = getComputedStyle(s);
    return { side: s.getAttribute('data-side'), tl: parseFloat(c.borderTopLeftRadius), tr: parseFloat(c.borderTopRightRadius), bl: parseFloat(c.borderBottomLeftRadius), br: parseFloat(c.borderBottomRightRadius), border: c.borderTopWidth + c.borderRightWidth + c.borderBottomWidth };
  }).filter(Boolean));
  expect(r.length).toBe(3);
  for (const x of r as { side: string; tl: number; tr: number; bl: number; br: number; border: string }[]) {
    if (x.side === 'right') { expect(x.tr).toBeGreaterThan(0); expect(x.tl).toBe(0); }
    else { expect(x.tl).toBeGreaterThan(0); expect(x.tr).toBe(0); }
    expect(x.bl + x.br).toBe(0);
    expect(x.border).toBe('0px0px0px'); // the search owns no box edge of its own
  }
  await page.close();
});

t('dividers: one per cell except the first', async () => {
  const page = await open(1440);
  const r = await page.evaluate(() => [...document.querySelectorAll('#after-card .section-bar')].map((bar) => {
    const cells = [...bar.querySelectorAll('.sb-cell')].filter((c) => !c.closest('.btn-group') && getComputedStyle(c).display !== 'none');
    const withDivider = cells.filter((c) => parseFloat(getComputedStyle(c).borderInlineStartWidth) > 0).length;
    return { cells: cells.length, withDivider };
  }));
  for (const x of r) expect(x.withDivider).toBe(x.cells - 1);
  await page.close();
});

t('phone: the search collapses to an icon cell and expands over the bar at the same height', async () => {
  const page = await open(390);
  const h0 = await page.evaluate(() => document.querySelector('#after-card .section-bar')!.getBoundingClientRect().height);
  const w0 = await page.evaluate(() => document.querySelector('#after-card .sb-search')!.getBoundingClientRect().width);
  await page.click('#after-card .sb-search-btn');
  await until(page, () => document.activeElement?.tagName === 'INPUT');
  const m = await page.evaluate(() => {
    const bar = document.querySelector('#after-card .section-bar')!, s = bar.querySelector('.sb-search')!;
    return { h: bar.getBoundingClientRect().height, sw: s.getBoundingClientRect().width, bw: bar.getBoundingClientRect().width };
  });
  expect(m.h).toBe(h0);
  expect(w0).toBeLessThan(60);
  expect(m.sw).toBe(m.bw);
  await page.close();
});

t('a11y: toolbar is named, search has a name, title is a heading', async () => {
  const page = await open(1440);
  const a = await page.evaluate(() => ({
    tb: [...document.querySelectorAll('#after-card [role=toolbar]')].every((e) => !!e.getAttribute('aria-label')),
    nTb: document.querySelectorAll('#after-card [role=toolbar]').length,
    search: [...document.querySelectorAll('#after-card [role=search]')].every((e) => !!e.getAttribute('aria-label') && !!e.querySelector('input')?.getAttribute('aria-label')),
    h2: document.querySelectorAll('#after-card .section-bar h2').length,
  }));
  expect(a.tb).toBe(true);
  expect(a.nTb).toBe(3);
  expect(a.search).toBe(true);
  expect(a.h2).toBe(3);
  await page.close();
});

// ── ONE search core: every presentation renders the same input contract ──────────────────────────
const FIELDS = ['#sv-bar [data-search-field]', '#sv-modal [data-search-field]', '#sv-boxed [data-search-field]'];

t('search variants share one input contract (type, name, magnifier, placeholder style, no ring)', async () => {
  const page = await open(1440);
  const r = await page.evaluate((sels) => sels.map((s) => {
    const f = document.querySelector(s)!, i = f.querySelector('input')!; i.focus(); const cs = getComputedStyle(i);
    return { type: i.type, label: i.getAttribute('aria-label'), icon: !!f.querySelector('svg'), ph: getComputedStyle(i, '::placeholder').color, font: cs.fontSize, outline: cs.outlineColor, bg: cs.backgroundColor, bw: cs.borderTopWidth };
  }), FIELDS);
  for (const x of r) {
    expect(x.type).toBe('text');
    expect(x.label).toBe('Search pools');
    expect(x.icon).toBe(true);
    expect(x.outline).toBe('rgba(0, 0, 0, 0)'); // focused: no visible ring
    expect(x.bw).toBe('0px'); // the input is never boxed itself: the shell is
  }
  expect(new Set(r.map((x) => x.ph)).size).toBe(1);
  expect(new Set(r.map((x) => x.font)).size).toBe(1);
  await page.close();
});

for (const sel of FIELDS) {
  t(`clear button empties and refocuses (${sel.split(' ')[0]})`, async () => {
    const page = await open(1440);
    await page.fill(`${sel} input`, 'abc');
    await page.click(`${sel} [data-search-clear]`);
    expect(await page.inputValue(`${sel} input`)).toBe('');
    expect(await page.evaluate((s) => document.activeElement === document.querySelector(`${s} input`), sel)).toBe(true);
    expect(await page.locator(`${sel} [data-search-clear]`).count()).toBe(0);
    await page.close();
  });
}

for (const sel of [FIELDS[0], FIELDS[2]]) {
  t(`Escape clears a query, then blurs the empty field (${sel.split(' ')[0]})`, async () => {
    const page = await open(1440);
    await page.fill(`${sel} input`, 'abc');
    await page.keyboard.press('Escape');
    expect(await page.inputValue(`${sel} input`)).toBe('');
    expect(await page.evaluate((s) => document.activeElement === document.querySelector(`${s} input`), sel)).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate((s) => document.activeElement === document.querySelector(`${s} input`), sel)).toBe(false);
    await page.close();
  });
}

t('modal variant leaves Escape to the modal (query kept, the modal closes it)', async () => {
  const page = await open(1440);
  await page.fill(`${FIELDS[1]} input`, 'abc');
  await page.keyboard.press('Escape');
  expect(await page.inputValue(`${FIELDS[1]} input`)).toBe('abc');
  await page.close();
});

t('debounce: onChange fires after the delay, clear is immediate; SearchInput stays the boxed variant', async () => {
  const page = await open(1440);
  await page.fill('.sv-deb input', 'xy');
  expect(await page.evaluate(() => (window as unknown as { __deb?: string[] }).__deb ?? [])).toEqual([]);
  await until(page, () => ((window as unknown as { __deb?: string[] }).__deb ?? []).includes('xy'));
  await page.click('.sv-deb [data-search-clear]');
  expect((await page.evaluate(() => (window as unknown as { __deb: string[] }).__deb)).at(-1)).toBe('');
  expect(await page.locator('.sv-legacy').getAttribute('data-search-field')).toBe('boxed');
  await page.close();
});

t('focus: no ring, the search cell takes the hover tone', async () => {
  const page = await open(1440);
  const m = await page.evaluate(() => {
    const cell = document.querySelector('#after-card .sb-search') as HTMLElement;
    const before = getComputedStyle(cell).backgroundColor;
    cell.querySelector('input')!.focus();
    const cs = getComputedStyle(cell);
    return { before, after: cs.backgroundColor, shadow: cs.boxShadow, out: getComputedStyle(cell.querySelector('input')!).outlineColor };
  });
  expect(m.shadow).toBe('none');
  expect(m.out).toBe('rgba(0, 0, 0, 0)');
  expect(m.after).not.toBe(m.before);
  await page.close();
});

t('busy search shows the kit Spinner and aria-busy', async () => {
  const page = await open(1440);
  await page.fill('#sv-boxed input', 'busy');
  expect(await page.locator('#sv-boxed .spinner').count()).toBe(1);
  expect(await page.getAttribute('#sv-boxed input', 'aria-busy')).toBe('true');
  await page.close();
});
