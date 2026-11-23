// InfoBox / FloatingPanel keyboard spec in real Chromium (playwright-core): focus, key-up clicks and
// capture-phase ordering are the browser's, not a shim's. Needs Chromium (`bunx playwright install chromium`).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const cache = join(root, 'node_modules/.cache/infobox-browser');

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
let browser: import('playwright-core').Browser;
let launching: Promise<import('playwright-core').Browser> | undefined;
async function setup() {
  const exe = chromium();
  if (!exe) throw new Error('no Chromium: bunx playwright install chromium (or set CHROMIUM_PATH)');
  mkdirSync(cache, { recursive: true });
  const built = await Bun.build({ entrypoints: [join(root, 'test/fixtures/infobox-page.tsx')], outdir: cache, naming: 'page.js', format: 'iife', target: 'browser', define: { 'import.meta.url': JSON.stringify(`file://${root}/src/lib/assets.ts`) } });
  if (!built.success) throw new Error(built.logs.join('\n'));
  writeFileSync(join(cache, 'in.css'), `@import "${join(root, 'src/styles/index.css')}";`);
  writeFileSync(join(cache, 'tw.config.js'), `import preset from '${join(root, 'src/styles/tailwind.preset.js')}'; export default { presets: [preset], content: ['${root}/src/**/*.{ts,tsx}', '${root}/test/fixtures/infobox-page.tsx'] };`);
  const tw = Bun.spawnSync([join(root, 'node_modules/.bin/tailwindcss'), '-c', join(cache, 'tw.config.js'), '-i', join(cache, 'in.css'), '-o', join(cache, 'page.css')], { stderr: 'pipe' });
  if (tw.exitCode) throw new Error(tw.stderr.toString());
  writeFileSync(join(cache, 'index.html'), '<!doctype html><html class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="page.css"></head><body><script src="page.js"></script></body></html>');
  const { chromium: pw } = await import('playwright-core');
  return pw.launch({ executablePath: exe });
}
beforeAll(async () => {
  launching = setup();
  browser = await launching;
}, 120000);
afterAll(async () => {
  await (await launching?.catch(() => undefined))?.close().catch(() => {});
}, 40000);

async function open(): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.goto(`file://${join(cache, 'index.html')}`);
  await page.waitForSelector('#modal');
  return page;
}

const on = (page: Page, sel: string) =>
  page.evaluate((s) => document.activeElement?.matches(s), sel);
const panels = (page: Page) => page.locator('.floating-panel').count();
const state = (page: Page) => page.locator('#state').innerText();

async function tabTo(page: Page, sel: string) {
  for (let i = 0; i < 8 && !(await on(page, sel)); i++) await page.keyboard.press('Tab');
  expect(await on(page, sel)).toBe(true);
}

describe('InfoBox with focusable content', () => {
  for (const key of ['Enter', 'Space']) {
    test(`${key} on the trigger moves focus in and fires no stray click`, async () => {
      const page = await open();
      await tabTo(page, 'button[aria-label="Linked"]');
      await page.waitForSelector('.floating-panel');
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
      expect(await on(page, '#inner')).toBe(true);
      // The key-up must not activate what focus landed on, nor toggle the box shut.
      expect(await page.locator('#clicks').innerText()).toBe('0');
      expect(await panels(page)).toBe(1);
      await page.close();
    });
  }

  test('Escape in the box closes only the box, returns focus; the next Escape closes the modal', async () => {
    const page = await open();
    await tabTo(page, 'button[aria-label="Linked"]');
    await page.waitForSelector('.floating-panel');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.floating-panel', { state: 'detached' });
    expect(await state(page)).toBe('open');
    expect(await on(page, 'button[aria-label="Linked"]')).toBe(true);
    await page.waitForTimeout(150);
    expect(await panels(page)).toBe(0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await state(page)).toBe('closed');
    await page.close();
  });

  test('with no box open Escape still closes the modal at once', async () => {
    const page = await open();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    expect(await state(page)).toBe('closed');
    await page.close();
  });

  test('Escape with focus already on the trigger does not leave the box unable to reopen', async () => {
    const page = await open();
    await tabTo(page, 'button[aria-label="Linked"]');
    await page.waitForSelector('.floating-panel');
    await page.keyboard.press('Escape'); // focus never left the trigger: nothing to hand back
    await page.waitForSelector('.floating-panel', { state: 'detached' });
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await page.waitForSelector('.floating-panel');
    expect(await on(page, 'button[aria-label="Linked"]')).toBe(true);
    await page.close();
  });

  test('a hover-opened, unfocused box lets Escape through: one press closes the modal', async () => {
    const page = await open();
    await page.hover('button[aria-label="Linked"]');
    await page.waitForSelector('.floating-panel');
    expect(await on(page, 'button[aria-label="Linked"]')).toBe(false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    expect(await state(page)).toBe('closed');
    await page.close();
  });

  test('Enter on a CLOSED box takes the native click and still moves focus in', async () => {
    const page = await open();
    await tabTo(page, 'button[aria-label="Linked"]');
    await page.waitForSelector('.floating-panel');
    await page.keyboard.press('Escape'); // closes it, focus stays on the trigger
    await page.waitForSelector('.floating-panel', { state: 'detached' });
    await page.keyboard.press('Enter');
    await page.waitForSelector('#inner');
    await page.waitForTimeout(100);
    expect(await on(page, '#inner')).toBe(true);
    expect(await page.locator('#clicks').innerText()).toBe('0');
    await page.close();
  });

  test('a key-up that never arrives (focus left first) cannot eat a later click', async () => {
    const page = await open();
    await tabTo(page, 'button[aria-label="Linked"]');
    await page.waitForSelector('.floating-panel');
    await page.keyboard.down('Enter');
    await page.focus('button[aria-label="Plain"]'); // focusout: the gesture is over
    // A click that is not a pointer press (so only the focus-out can have cleared the flag).
    await page.evaluate(() =>
      (document.querySelector('button[aria-label="Linked"]') as HTMLElement).click(),
    );
    await page.waitForSelector('#inner');
    await page.keyboard.up('Enter');
    await page.close();
  });

  test('a pointer press clears a held gesture too: the next real click toggles the box', async () => {
    const page = await open();
    await tabTo(page, 'button[aria-label="Linked"]');
    await page.waitForSelector('.floating-panel');
    await page.keyboard.down('Enter'); // focus stays; the key-up is lost
    await page.click('button[aria-label="Linked"]');
    await page.waitForSelector('.floating-panel', { state: 'detached' });
    await page.keyboard.up('Enter');
    await page.close();
  });
});

describe('text-only InfoBox keeps its plain toggle', () => {
  for (const key of ['Enter', 'Space']) {
    test(`${key} toggles the box and focus stays on the trigger`, async () => {
      const page = await open();
      await tabTo(page, 'button[aria-label="Plain"]');
      await page.waitForSelector('.floating-panel');
      await page.keyboard.press(key);
      await page.waitForSelector('.floating-panel', { state: 'detached' });
      expect(await on(page, 'button[aria-label="Plain"]')).toBe(true);
      await page.keyboard.press(key);
      await page.waitForSelector('.floating-panel');
      expect(await on(page, 'button[aria-label="Plain"]')).toBe(true);
      await page.close();
    });
  }

  test('Space on a CLOSED text-only box is not prevented: the native click path', async () => {
    const page = await open();
    await tabTo(page, 'button[aria-label="Plain"]');
    await page.waitForSelector('.floating-panel');
    await page.keyboard.press('Escape'); // owned by the keyboard open: closes the box only
    await page.waitForSelector('.floating-panel', { state: 'detached' });
    expect(await state(page)).toBe('open');
    await page.evaluate(() => {
      document.addEventListener('keydown', (e) => {
        (window as unknown as { dp: boolean }).dp = e.defaultPrevented;
      });
    });
    await page.keyboard.press('Space');
    await page.waitForSelector('.floating-panel');
    expect(await page.evaluate(() => (window as unknown as { dp: boolean }).dp)).toBe(false);
    expect(await on(page, 'button[aria-label="Plain"]')).toBe(true);
    await page.close();
  });
});
