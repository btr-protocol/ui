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

// Ad-hoc sizing tokens: height, padding, radius, type size, fixed width.
const ADHOC = /(^|[\s"'`:])(h-|min-h-|px-|py-|p-|rounded|text-(xs|sm|base|lg|xl|2xs|3xs)\b|text-\[|w-\d)/;
/** Opening tags `<Tag ...>` for one tag name; `=>` and `>` inside `{...}` expressions do not end the tag. */
function tags(src: string, name: string): { attrs: string; line: number }[] {
  const out: { attrs: string; line: number }[] = [];
  for (const m of src.matchAll(new RegExp(`<${name}(?=[\\s/>])`, 'g'))) {
    let i = m.index! + m[0].length, depth = 0, q = '';
    for (; i < src.length; i++) {
      const c = src[i]!;
      if (q) { if (c === q && src[i - 1] !== '\\') q = ''; continue; }
      if (c === '"' || c === "'" || c === '`') q = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    out.push({ attrs: src.slice(m.index! + m[0].length, i), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}
/** The text of every string literal inside the `className=` attribute (any expression form: "..", {`..${x}`}, {cn('..', x && '..')}). */
function classLiterals(attrs: string): string {
  const at = attrs.search(/\bclassName=/);
  if (at < 0) return '';
  const rest = attrs.slice(at + 10);
  const end = rest[0] === '{' ? matchBrace(rest) : rest[0] === '"' ? rest.indexOf('"', 1) : 0;
  return rest.slice(0, end + 1);
}
function matchBrace(s: string): number {
  let d = 0, q = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (q) { if (c === q && s[i - 1] !== '\\') q = ''; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '{') d++;
    else if (c === '}' && --d === 0) return i;
  }
  return s.length;
}

test('Button wrappers (components that forward className / spread props into a Button) are not given ad-hoc sizing by callers', async () => {
  // A wrapper = an exported component whose body renders <Button> with a spread or a forwarded className.
  const wrappers = new Set<string>();
  for (const f of files) {
    const src = await read(f);
    const parts = src.split(/^export (?:default )?function (\w+)/m); // [pre, name, body, name, body...]
    for (let i = 1; i < parts.length; i += 2) {
      if (tags(parts[i + 1]!, 'Button').some((t) => /\{\.\.\./.test(t.attrs) || /className=\{className\}/.test(t.attrs))) wrappers.add(parts[i]!);
    }
  }
  wrappers.delete('Button');
  const bad: string[] = [];
  for (const f of files) {
    const src = await read(f);
    for (const w of wrappers)
      for (const t of tags(src, w)) if (ADHOC.test(classLiterals(t.attrs))) bad.push(`${f}:${t.line}: <${w}> ${classLiterals(t.attrs)}`);
    // `<Button {...props}>` with a className literal AND a spread: the spread may smuggle sizing in; the literal is checked above, the spread source here.
    for (const t of tags(src, 'Button'))
      if (/\{\.\.\./.test(t.attrs) && ADHOC.test(classLiterals(t.attrs))) bad.push(`${f}:${t.line}: <Button {...spread} className=…>`);
  }
  expect(bad).toEqual([]);
});

// Raw <button> in the kit that is NOT a Button must have a reason: its geometry is genuinely not a button's
// (icon-only chrome, a tab/segment/row/menu item, a notice-tinted action...). file -> why. Anything else with ad-hoc sizing must be a <Button>.
const RAW_BUTTON_OK: Record<string, string> = {
  'src/ui/Button.tsx': 'the definition',
  'src/ui/CloseButton.tsx': 'icon-only dismiss glyph with its own hit-area contract',
  'src/ui/Feedback.tsx': 'notice-action is tinted by the notice tone (.notice-action); Toast dismiss is an icon',
  'src/ui/AddrActions.tsx': 'icon-only copy / explorer glyph buttons inline with text',
  'src/ui/Table.tsx': 'sortable header cell and row-expander: table chrome, not an action button',
  'src/ui/SegmentedControl.tsx': 'segments are a radio-like group, not buttons',
  'src/layout/TabBar.tsx': 'tab items',
  'src/layout/Footer.tsx': 'footer text links rendered as buttons',
  'src/layout/Header.tsx': 'nav items / icon chrome',
  'src/ui/selectionView.tsx': 'list rows, section headings and the +/check mark of a row',
  'src/ui/SelectionList.tsx': 'filter chip remove and funnel glyph buttons in the search field',
  'src/ui/Select.tsx': 'listbox options and picker rows, not actions',
  'src/ui/ClickMenu.tsx': 'menu items (role=menuitem rows)',
  'src/ui/TabStrip.tsx': 'pin / close glyph buttons inside a tab',
  'src/ui/Expandable.tsx': 'disclosure header',
  'src/ui/InfoBox.tsx': 'inline help trigger glyph',
  'src/ui/MasterDetail.tsx': 'phone Back row',
  'src/ui/SearchInput.tsx': 'inline clear (x) glyph inside the input',
  'src/ui/AddressField.tsx': 'inline paste/clear glyphs inside the input',
  'src/ui/WalletItemButton.tsx': 'wallet picker row',
  'src/wallet/WalletConnectTile.tsx': 'WalletConnect tile: a tall picker row with a mark grid, not an action button',
  'src/wallet/AccountModal.tsx': 'identity row disconnect glyph (icon-only, inline with copy / explorer)',
};
test('raw <button> with ad-hoc sizing must be a <Button>, unless the file is allowlisted with a reason', async () => {
  const bad: string[] = [];
  for (const f of files) {
    if (f in RAW_BUTTON_OK) continue;
    const src = await read(f);
    for (const t of tags(src, 'button')) if (ADHOC.test(classLiterals(t.attrs))) bad.push(`${f}:${t.line}: <button> ${classLiterals(t.attrs).slice(0, 80)}`);
  }
  expect(bad).toEqual([]);
});
test('every RAW_BUTTON_OK entry still has a raw <button> (no stale exceptions)', async () => {
  const stale: string[] = [];
  for (const f of Object.keys(RAW_BUTTON_OK)) {
    if (f === 'src/ui/Button.tsx') continue;
    if (!tags(await read(f), 'button').length) stale.push(f);
  }
  expect(stale).toEqual([]);
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

// ── type scale: lib/design.ts TYPE_SIZES / TYPE_WEIGHTS only ──────────────────────────────────────────────────────────
import { TYPE_SIZES, TYPE_WEIGHTS } from '../src/lib/design';
const SRC = [...new Glob('src/**/*.{ts,tsx,css}').scanSync('.')].filter((f) => !f.endsWith('lib/design.ts'));
/** Every type-size / weight utility (any variant prefix) in a source: a class token, not prose. */
export function typeViolations(src: string, sizes: readonly string[] = TYPE_SIZES, weights: readonly string[] = TYPE_WEIGHTS): string[] {
  const bad: string[] = [];
  for (const m of src.matchAll(/(?<![\w-])(?:[\w-]+:)*text-(3xs|2xs|xs|sm|base|lg|xl|[2-9]xl|\[[^\]\s]+\])(?![\w-])/g)) {
    const v = m[1]!;
    if (v.startsWith('[') ? /^(?:\d|calc|clamp|var\(--fs)/.test(v.slice(1)) : !sizes.includes(v)) bad.push(m[0]);
  }
  for (const m of src.matchAll(/(?<![\w-])(?:[\w-]+:)*font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)(?![\w-])/g)) if (!weights.includes(m[1]!)) bad.push(m[0]);
  for (const m of src.matchAll(/(?<![\w-])(?:[\w-]+:)*font-\[\d+\]/g)) bad.push(m[0]);
  return bad;
}
test('type scale: only the documented sizes and weights, no arbitrary text sizes', async () => {
  const bad: string[] = [];
  for (const f of SRC) for (const v of typeViolations(await read(f))) bad.push(`${f}: ${v}`);
  expect(bad).toEqual([]);
});
test('type-scale lint catches what it must', () => {
  expect(typeViolations('a text-lg b sm:text-4xl text-[2rem] font-bold md:font-light text-3xs font-[600]')).toEqual(['text-lg', 'sm:text-4xl', 'text-[2rem]', 'text-3xs', 'font-bold', 'md:font-light', 'font-[600]']);
  expect(typeViolations('text-sm text-fg-2 text-[var(--fg-0)] font-title font-medium text-primary text-black')).toEqual([]);
});

// ── icon shapes: chains are rounded squares, tokens / protocols circles ──────────────────────────────────────────────
test('chain marks are never circles: ChainGlyph has no round path, chain sets go through ChainStack', async () => {
  const bad: string[] = [];
  const cs = await read('src/ui/ChainSelect.tsx');
  const [g0, g1] = [cs.indexOf('export function ChainGlyph'), cs.indexOf('export function ChainStack')];
  expect(g0 >= 0 && g1 > g0).toBe(true);
  const glyph = cs.slice(g0, g1);
  if (/rounded-full|shape/.test(glyph)) bad.push('ChainGlyph: round / shape option');
  for (const f of files) {
    const src = await read(f);
    for (const t of tags(src, 'StackedIcons')) if (/ChainGlyph|chainIcon\(/.test(t.attrs) && !/shape="square"/.test(t.attrs)) bad.push(`${f}:${t.line}: chain marks in <StackedIcons> (use <ChainStack>)`);
    for (const t of tags(src, 'img')) if (/chainIcon\(/.test(t.attrs) && /rounded-full/.test(t.attrs)) bad.push(`${f}:${t.line}: round chain img`);
  }
  for (const f of ['src/ui/TokenGlyph.tsx', 'src/ui/ProtocolGlyph.tsx']) if (!/rounded-full/.test(await read(f))) bad.push(`${f}: not a circle`);
  expect(bad).toEqual([]);
});

// ── review follow-ups: chain marks fed through helpers, inline font sizes, disclosure chevrons ──────────────────────────
test('chain marks are not fed to a round stack through an items helper (.map(... icon: <ChainGlyph ...) next to a StackedIcons)', async () => {
  const bad: string[] = [];
  for (const f of files) {
    if (f === 'src/ui/ChainSelect.tsx') continue;
    const src = await read(f);
    if (/<StackedIcons\b/.test(src) && /icon:\s*(?:\w+\.icon\s*\?\?\s*)?<ChainGlyph\b/.test(src)) bad.push(`${f}: chain marks built as stack items (use <ChainStack>)`);
  }
  expect(bad).toEqual([]);
});
// Inline font sizes: only computed glyph monograms (a fraction of the glyph's own size) and chart canvases (not DOM text).
const INLINE_FONT_OK: Record<string, string> = {
  'src/ui/TokenGlyph.tsx': 'monogram scales with the glyph diameter',
  'src/ui/ProtocolGlyph.tsx': 'monogram scales with the glyph diameter',
  'src/ui/ChainSelect.tsx': 'monogram scales with the glyph size',
  'src/charts/ChartShell.tsx': 'watermark fitted to the chart width',
  'src/charts/MetricChart.tsx': 'canvas axis labels (lightweight-charts option)',
  'src/lib/chart.ts': 'canvas axis labels (lightweight-charts option)',
};
test('no inline style font sizes outside the allowlisted glyph / canvas cases', async () => {
  const bad: string[] = [];
  for (const f of [...new Glob('src/**/*.{ts,tsx}').scanSync('.')]) if (!(f in INLINE_FONT_OK) && !f.endsWith('.test.ts') && /\bfontSize\s*:/.test(await read(f)) && !f.endsWith('tailwind.preset.js')) bad.push(f);
  expect(bad).toEqual([]);
});
/** A left disclosure: a caret / chevron swapped or rotated on open (caret-right <-> caret-down, ChevronRight, rotate-90). The kit rule: one caret-down at the far right that turns 180. */
export const leftChevron = (src: string): boolean =>
  /'caret-(?:down|right)'\s*:\s*'caret-(?:right|down)'/.test(src) || /ChevronRight\b[^\n]*(?:open|expanded)|(?:open|expanded)[^\n]*ChevronRight\b/.test(src) || /caret-right[^\n]*rotate-90|rotate-90[^\n]*caret-right/.test(src);
test('no left disclosure chevron in the kit', async () => {
  const bad: string[] = [];
  for (const f of files) if (leftChevron(await read(f))) bad.push(f);
  expect(bad).toEqual([]);
  expect([leftChevron("name={open ? 'caret-down' : 'caret-right'}"), leftChevron('{expanded ? <ChevronDown/> : <ChevronRight/>}'), leftChevron('<Icon name="caret-right" className={open ? "rotate-90" : ""} />'), leftChevron("name=\"caret-down\" className={open ? 'rotate-180' : ''}")]).toEqual([true, true, true, false]);
});
