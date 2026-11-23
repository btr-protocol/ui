import type { Signal } from '@preact/signals';

export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | undefined
  | null
  | { [key: string]: boolean }
  | ClassValue[]
  | Signal<string | number | bigint | boolean | undefined | null>
  | Signal<ClassValue>;

// Conflict groups of the utilities kit + front actually override (audited against tailwind-merge over the
// full kit + front suites, 2026-11-24). A class outside these groups is never dropped, only deduped.
// ponytail: hand-kept groups; a new override family (e.g. inset, translate) needs a row here + a cn.test case.
const SIZE = /^text-(?:3xs|2xs|xs|sm|base|lg|[2-9]?xl|\[[\d.]+(?:px|rem|em|%)\])$/;
const WEIGHT = /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/;
const DISPLAY = /^(?:block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|table|flow-root)$/;
const POSITION = /^(?:static|fixed|absolute|relative|sticky)$/;
const BORDER_W = /^border(?:-([trblxy]))?(?:-(?:0|2|4|8|\[\d+px\]))?$/;
const BORDER_STYLE = /^border-(?:solid|dashed|dotted|double|none)$/;
const RADIUS = /^rounded(?:-([trbl]|tl|tr|bl|br|[se]|s[se]|e[se]))?(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?$/;
const SPACING = /^-?(p|m|gap|space)(?:-?([xytrblse]))?-/;
const PLAIN: [RegExp, string][] = [
  [/^flex-(?:row|col)(?:-reverse)?$/, 'flex-dir'],
  [/^flex-(?:wrap|nowrap|wrap-reverse)$/, 'flex-wrap'],
  [/^flex-/, 'flex'],
  [/^(?:items|justify-items|justify-self|justify|self|content|cursor|opacity|z|leading|tracking|shadow|overflow(?:-[xy])?)-/, ''],
  [/^(?:w|h|min-w|max-w|min-h|max-h|size)-/, ''],
];

/** Group of one utility (variants already split off), `''` when it joins no group. Spacing keys carry their axis. */
function group(u: string): string {
  if (DISPLAY.test(u)) return 'display';
  if (POSITION.test(u)) return 'position';
  if (u.startsWith('text-')) return SIZE.test(u) ? 'text-size' : /^text-(?:left|center|right|justify|start|end)$/.test(u) ? 'text-align' : 'text-color';
  if (u.startsWith('font-')) return WEIGHT.test(u) ? 'font-weight' : 'font-family';
  if (u.startsWith('bg-')) return /^bg-(?:none|gradient-)/.test(u) ? 'bg-image' : /^bg-(?:cover|contain|auto)$/.test(u) ? 'bg-size' : 'bg-color';
  let m = BORDER_W.exec(u);
  if (m) return `border-w${m[1] ?? ''}`;
  if (BORDER_STYLE.test(u)) return 'border-style';
  m = /^border-([trblxy])-/.exec(u);
  if (u.startsWith('border-')) return `border-color${m?.[1] ?? ''}`;
  m = RADIUS.exec(u);
  if (m) return `rounded${m[1] ?? ''}`;
  m = SPACING.exec(u);
  if (m) return `${m[1]}${m[2] ?? ''}`;
  for (const [re, name] of PLAIN) {
    const hit = re.exec(u);
    if (hit) return name || hit[0];
  }
  return '';
}

/** Groups a later class also overrides: `p-*` beats `px-*`/`pt-*`, `px-*` beats `pl-*`/`pr-*`, a font size its line height. */
const AXES: Record<string, string[]> = { x: ['l', 'r', 's', 'e'], y: ['t', 'b'], '': ['x', 'y', 't', 'r', 'b', 'l', 's', 'e'] };
function covers(g: string): string[] {
  if (g === 'text-size') return ['leading-'];
  const sp = /^(p|m|gap|space)([xytrblse]?)$/.exec(g);
  return sp ? (AXES[sp[2]] ?? []).map((a) => sp[1] + a) : [];
}

/** tailwind-merge's rule over those groups: per variant stack (`sm:hover:`) + `!`, the last class of a group wins. */
function merge(classes: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = classes.length - 1; i >= 0; i--) {
    const c = classes[i];
    const at = c.lastIndexOf(':', c.lastIndexOf('[') < 0 ? c.length : c.indexOf('['));
    const variants = c.slice(0, at + 1).split(':').sort().join(':');
    const u = c.slice(at + 1);
    const imp = u.startsWith('!') ? '!' : '';
    const g = group(u.slice(imp.length));
    const key = g ? `${variants}${imp}${g}` : `=${c}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const o of covers(g)) seen.add(`${variants}${imp}${o}`);
    out.push(c);
  }
  return out.reverse().join(' ');
}

function isSignalLike(v: ClassValue): boolean {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    'value' in (v as Record<string, unknown>)
  );
}

function flatten(inputs: ClassValue[], out: string[]): void {
  for (let raw of inputs) {
    if (isSignalLike(raw)) {
      raw = (raw as { value: ClassValue }).value;
    }
    if (!raw) continue;

    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'bigint') {
      out.push(String(raw));
    } else if (Array.isArray(raw)) {
      flatten(raw, out);
    } else if (typeof raw === 'object') {
      for (const [key, value] of Object.entries(raw as Record<string, boolean>)) {
        if (value) out.push(key);
      }
    }
  }
}

/** clsx-style conditional classes, then `merge`: the last class of a group wins, so a call-site `className` beats a component base. */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  flatten(inputs, classes);
  return merge(classes.join(' ').split(/\s+/).filter(Boolean));
}
