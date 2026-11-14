import { useEffect, useId, useMemo, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { BaseModal } from './BaseModal';
import { Icon, type IconName } from './Icon';

export interface PaletteItem {
  id: string;
  title: string;
  /** Muted second line (family · side · coins, a path). */
  sub?: string;
  /** Section the item lists under and ranks within (strategy, view, action). */
  group: string;
  /** Extra text that matches but is not shown (the raw id behind a display name). */
  keywords?: string;
  icon?: IconName;
  run: () => void;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tri = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 2) }, (_, i) => s.slice(i, i + 3)));

/** Score of `q` against one text: equal 100, prefix 80, substring 60, else trigram Jaccard x 50 (0 below 0.2). */
export function score(q: string, text: string): number {
  const t = norm(text);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  const a = tri(q);
  const b = tri(t);
  const inter = [...a].filter((x) => b.has(x)).length;
  const j = a.size && b.size ? inter / (a.size + b.size - inter) : 0;
  return j >= 0.2 ? j * 50 : 0;
}

/** Every whitespace token of the query must match something; the item scores the sum of its best per-token score. Empty query = the given order. */
export function rank(items: readonly PaletteItem[], query: string, limit = 20): PaletteItem[] {
  const toks = norm(query).split(' ').filter(Boolean);
  if (!toks.length) return items.slice(0, limit);
  return items
    .map((it) => {
      const per = toks.map((t) => Math.max(score(t, it.title), score(t, it.sub ?? '') * 0.8, score(t, it.keywords ?? '') * 0.9, score(t, it.group) * 0.5));
      return { it, s: per.every((x) => x > 0) ? per.reduce((a, b) => a + b, 0) : 0 };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}

// ONE window listener for every mounted palette; the first mounted one answers Ctrl / Cmd K (two palettes would otherwise toggle each other off).
const toggles = new Set<() => void>();
const onGlobalKey = (e: KeyboardEvent) => {
  if (e.isComposing || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
  const first = toggles.values().next().value;
  if (!first) return;
  e.preventDefault();
  first();
};
/** Register a palette's toggle; returns its unregister. Exported for the test. */
export function registerPaletteHotkey(toggle: () => void): () => void {
  if (toggles.size === 0) addEventListener('keydown', onGlobalKey);
  toggles.add(toggle);
  return () => {
    toggles.delete(toggle);
    if (toggles.size === 0) removeEventListener('keydown', onGlobalKey);
  };
}

/** Ctrl / Cmd + K palette over host-provided items: type to filter, arrows move, Enter runs, Esc closes. */
export function CommandPalette({ items, placeholder = 'Jump to, add, export...' }: { items: readonly PaletteItem[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  useEffect(() => registerPaletteHotkey(() => setOpen((o) => !o)), []);
  const uid = useId();
  const list = useMemo(() => rank(items, q), [items, q]);
  const go = (it?: PaletteItem) => {
    if (!it) return;
    setOpen(false);
    setQ('');
    it.run();
  };
  return (
    <BaseModal
      isOpen={open}
      onClose={(o) => {
        setOpen(o);
        if (!o) setQ('');
      }}
      title="Command palette"
      headerType="input"
      placeholder={placeholder}
      searchValue={q}
      onSearchChange={(v) => {
        setQ(v);
        setAt(0);
      }}
      inputProps={{
        role: 'combobox',
        'aria-expanded': true,
        'aria-controls': `${uid}-list`,
        'aria-autocomplete': 'list',
        'aria-activedescendant': list[at] ? `${uid}-opt-${at}` : undefined,
      }}
      onSearchKeyDown={(e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % Math.max(1, list.length));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          go(list[at]);
        }
      }}
      footer={<span className="text-xs text-fg-2">↑↓ move · Enter run · Esc close · Ctrl/Cmd K toggles</span>}
    >
      <ul id={`${uid}-list`} role="listbox" aria-label="Commands" className="m-0 max-h-[60dvh] list-none overflow-y-auto p-1">
        {list.length === 0 && <li className="p-6 text-center text-sm text-fg-2">No match</li>}
        {list.map((it, i) => (
          <li key={it.id} id={`${uid}-opt-${i}`} role="option" aria-selected={i === at} onMouseEnter={() => setAt(i)} onClick={() => go(it)} className={cn('flex cursor-pointer items-center gap-3 rounded-sm px-3 py-1.5', i === at && 'bg-bg-3')}>
            <Icon name={it.icon ?? 'arrow-right'} className="h-4 w-4 shrink-0 text-fg-2" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg-0">{it.title}</span>
              {it.sub && <span className="block truncate text-2xs text-fg-2">{it.sub}</span>}
            </span>
            <span className="shrink-0 text-2xs uppercase tracking-wide text-fg-3">{it.group}</span>
          </li>
        ))}
      </ul>
    </BaseModal>
  );
}
