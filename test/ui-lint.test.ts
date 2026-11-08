// Design-system lint: ONE button scale (xs / sm / default from lib/design.ts), no inline sizing, no dropdown popups in the kit's own screens.
import { expect, test } from 'bun:test';
import { Glob } from 'bun';

const files = [...new Glob('src/**/*.tsx').scanSync('.')];
const read = (f: string) => Bun.file(f).text();

/** Every `<Button ...>` opening tag (attributes may span lines; `=>` inside an attribute is not a tag end). */
const buttonTags = (src: string) => [...src.matchAll(/<Button\b((?:[^>]|=>)*?)>/gs)].map((m) => m[1]);

test('Buttons never carry inline sizing: height, padding, radius and text size come from `size`', async () => {
  const bad: string[] = [];
  for (const f of files) {
    const src = await read(f);
    for (const attrs of buttonTags(src)) {
      const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/.exec(attrs);
      if (!cls) continue;
      const c = cls[1] ?? cls[2] ?? cls[3] ?? '';
      if (/(^|\s)(h-|min-h-|px-|py-|p-|rounded|text-(xs|sm|base|lg|xl)|w-\d)/.test(c)) bad.push(`${f}: className="${c}"`);
    }
  }
  expect(bad).toEqual([]);
});

test('Button sizes are the scale of lib/design.ts only', async () => {
  const bad: string[] = [];
  for (const f of files) {
    const src = await read(f);
    for (const attrs of buttonTags(src)) {
      const m = /size=(?:"([^"]*)"|\{'([^']*)'\})/.exec(attrs);
      const v = m?.[1] ?? m?.[2];
      if (v && !['xs', 'sm', 'default'].includes(v)) bad.push(`${f}: size="${v}"`);
    }
  }
  expect(bad).toEqual([]);
});

test('no Dropdown popup in screens: pickers are modals (SelectModal / MultiSelectModal / SelectionModal)', async () => {
  const allowed = new Set(['src/ui/Select.tsx']); // the definition; the nav "More" menu of Header is the one remaining use (a menu, not a picker)
  const bad: string[] = [];
  for (const f of files) if (!allowed.has(f) && f !== 'src/layout/Header.tsx' && /<Dropdown\b/.test(await read(f))) bad.push(f);
  expect(bad).toEqual([]);
});
