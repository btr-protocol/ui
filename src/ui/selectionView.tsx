import type { ComponentChildren } from 'preact';
import { useEffect, useId, useMemo, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { isStringIcon, isSvgPath, renderIcon } from '../lib/iconHelpers';
import type { SelectionItem } from '../lib/uiTypes';
import { useDebounce } from '../lib/useDebounce';
import { useKeyboardNav } from '../lib/useKeyboardNav';
import { MODAL_PADDING } from './BaseModal';
import { PageState } from './Feedback';
import { Icon } from './Icon';
import { DATA_TABLE_HEADER, type SortDir, SortHeader, compareSorted } from './Table';

/** Every fixed string of the modal, so a host can translate it. */
export interface SelectionLabels {
  navigate: string;
  select: string;
  toggle: string;
  close: string;
  selected: (n: number) => string;
  selectAll: string;
  unselectAll: string;
  unselectAllBut: (n: number) => string;
  reset: string;
  /** Name of the presets bar. */
  quickPicks: string;
  /** Between a section's label and its note ("Ethereum · DEX not deployed"). */
  noteSep: string;
}
export const SELECTION_LABELS: SelectionLabels = {
  navigate: 'Navigate',
  select: 'Select',
  toggle: 'Toggle',
  close: 'Close',
  selected: (n) => `${n} selected`,
  selectAll: 'Select All',
  unselectAll: 'Unselect All',
  unselectAllBut: (n) => `Unselect all but ${n}`,
  reset: 'Reset',
  quickPicks: 'Quick picks',
  noteSep: '· ',
};

/** Width of ONE right-aligned data column, shared by the sort header and the cells under it: they must match or every
 *  numeric column sits off its heading. A column narrows it with `className` (`w-12`). */
export const SELECTION_DATA_COL = 'w-[4.5rem]';

export interface SelectionSortColumn {
  key: string;
  label: string;
  /** Extra header and cell classes, e.g. a phone-hide or a narrower width. */
  className?: string;
  /** Extra classes of the sort button alone (a smaller, unshouted label over a narrow column). */
  headClassName?: string;
  /** Render `item.data[key]` as the row's cell (tabular figures, right aligned). Without it the caller renders `item.badge`. */
  fmt?: (v: number | string | null) => string;
}

/** A section of the list (`SelectionItem.group`): e.g. a chain heading its pools. */
export interface SelectionGroup {
  id: string;
  label: string;
  icon?: ComponentChildren;
  /** Why the section is empty or off ("DEX not deployed"): shown on the heading, the section takes no picks. */
  note?: string;
}

/** A filter chip of the inline list's search bar: items carry `tags`; chips of one `group` OR, groups AND. */
export interface SelectionFilter {
  id: string;
  label: string;
  group?: string;
}

export const groupOf = (f: SelectionFilter) => f.group ?? f.id;
/** Does a row with these `tags` pass the chips switched on? None on: everything passes. */
export function chipMatch(tags: readonly string[] | undefined, filters: readonly SelectionFilter[], active: readonly string[]): boolean {
  const on = filters.filter((f) => active.includes(f.id));
  return [...new Set(on.map(groupOf))].every((g) => on.some((f) => groupOf(f) === g && tags?.includes(f.id)));
}

/** Same cycle as `useTableSort`: new key → asc → desc → off. */
function nextSort(prev: { key: string | null; dir: SortDir }, key: string): { key: string | null; dir: SortDir } {
  if (prev.key !== key) return { key, dir: 'asc' };
  if (prev.dir === 'asc') return { key, dir: 'desc' };
  if (prev.dir === 'desc') return { key: null, dir: null };
  return { key, dir: 'asc' };
}

const matches = (item: SelectionItem, q: string) => {
  const s = q.toLowerCase().trim();
  return !s || item.label.toLowerCase().includes(s) || (item.caption?.toLowerCase().includes(s) ?? false);
};

export interface SelectionViewProps {
  items: SelectionItem[];
  /** Raw search text (debounced here on a long list). */
  search: string;
  selected: readonly string[];
  /** Row toggled (modal: the row; inline with `mark`: the +/✓ button). */
  onToggle: (id: string) => void;
  /** A section heading toggled (multi). Without it headings are plain. */
  onToggleMany?: (ids: readonly string[]) => void;
  /** Inline: the row itself opens the item, the mark toggles it. */
  onOpen?: (id: string) => void;
  /** The open row: primary text + tint. */
  activeId?: string | null;
  /** Trailing +/✓ toggle on every row (the row click is `onOpen`). */
  mark?: boolean;
  filterFn?: (item: SelectionItem, search: string) => boolean;
  /** Sortable headers beside the pinned primary column. Values from `item.data[key]`; the primary sorts by label. */
  sortColumns?: SelectionSortColumn[];
  primaryColumnLabel?: string;
  /** Re-applied whenever `resetKey` changes (the modal opening). */
  initialSort?: { key: string; dir: Exclude<SortDir, null> };
  resetKey?: unknown;
  groups?: readonly SelectionGroup[];
  enabled?: boolean;
  emptyMessage?: string;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  /** Fixed strings (`reset`, `noteSep`) a host translates. */
  labels?: Partial<Pick<SelectionLabels, 'reset' | 'noteSep'>>;
}

// Shared parts of the selection list (types, chip matching, `useSelectionView`): `SelectionModal` (Select.tsx) and `SelectionList` both build on
// this module, which imports neither, so there is no Select <-> SelectionList import cycle.

/** THE selection list of the design system, as parts: the sortable header and the rows, in the front's multiselect-modal look
 *  (label + caption, right-aligned figures, state mark). `SelectionModal` hosts them in a modal, `SelectionList` inline. */
export function useSelectionView(p: SelectionViewProps) {
  const { items, search, selected, onToggle, onToggleMany, onOpen, activeId, mark, filterFn = matches, sortColumns, primaryColumnLabel = 'Asset', initialSort, resetKey, groups, enabled = true, emptyMessage = 'No items found', onResetFilters, hasActiveFilters = false, labels } = p;
  const L = { ...SELECTION_LABELS, ...labels };
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({ key: initialSort?.key ?? null, dir: initialSort?.dir ?? null });
  useEffect(() => setSort({ key: initialSort?.key ?? null, dir: initialSort?.dir ?? null }), [resetKey]);
  const debounced = useDebounce(search, 300);
  // A short list filters in one frame: the 300 ms lag only pays for itself on a long one.
  const q = items.length <= 50 ? search : debounced;
  const filtered = useMemo(() => items.filter((i) => filterFn(i, q)), [items, q, filterFn]);
  const sorted = useMemo(() => {
    if (!sortColumns?.length || !sort.key || !sort.dir) return filtered;
    const val = (i: SelectionItem) => (sort.key === 'asset' ? i.label : ((i.data as Record<string, number | string | null> | undefined)?.[sort.key as string] ?? null));
    return [...filtered.filter((i) => i.pinned), ...compareSorted(filtered.filter((i) => !i.pinned), val, sort.dir)];
  }, [filtered, sortColumns, sort.key, sort.dir]);
  // Sections keep their order; the sort applies inside each. Rows of no known section go last.
  const ordered = useMemo(() => {
    if (!groups?.length) return sorted;
    const known = new Set(groups.map((g) => g.id));
    return [...groups.flatMap((g) => sorted.filter((i) => i.group === g.id)), ...sorted.filter((i) => !i.group || !known.has(i.group))];
  }, [sorted, groups]);
  const { selectedIndex, handleKeyDown } = useKeyboardNav({ items: ordered, onSelect: (i) => !i.disabled && onToggle(i.id), isEnabled: enabled });
  const uid = useId();
  const headId = (g: string) => `${uid}-sec-${g.replace(/[^\w-]/g, '_')}`;
  const toggle = (e: Event, id: string) => (e.stopPropagation(), !items.find((i) => i.id === id)?.disabled && onToggle(id));
  const aria = (key: string) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  const head = (label: string, key: string, align: 'left' | 'right', className?: string) => (
    <SortHeader label={label} sortKey={key} active={sort.key === key} dir={sort.dir} onToggle={(k) => setSort((s) => nextSort(s, k))} align={align} className={className} />
  );

  const header = sortColumns?.length ? (
    <div className={cn(DATA_TABLE_HEADER, MODAL_PADDING, 'flex items-center gap-3 py-2')} role="row">
      {/* No icon-width spacer: the primary heading starts at the ICON's left edge, not the label's. */}
      <div className="flex min-w-0 flex-1 items-center gap-3" role="columnheader" aria-sort={aria('asset')}>
        {head(primaryColumnLabel, 'asset', 'left')}
      </div>
      {sortColumns.map((c) => (
        <div key={c.key} className={cn(SELECTION_DATA_COL, 'flex shrink-0 justify-end', c.className)} role="columnheader" aria-sort={aria(c.key)}>
          {head(c.label, c.key, 'right', c.headClassName)}
        </div>
      ))}
      {mark && <span className="w-5 shrink-0" aria-hidden="true" />}
    </div>
  ) : null;

  const row = (item: SelectionItem, idx: number) => {
    const on = selected.includes(item.id);
    const open = item.id === activeId;
    const off = !!item.disabled;
    const click = () => (mark && onOpen ? onOpen(item.id) : onToggle(item.id));
    const cls = cn(
          `flex w-full cursor-pointer items-center py-2 text-left transition-colors coarse:min-h-14 ${mark ? 'gap-2 px-3' : `gap-3 ${MODAL_PADDING}`}`,
          off ? 'cursor-not-allowed opacity-60' : idx === selectedIndex ? 'bg-bg-2' : 'hover:bg-bg-2',
          open ? 'bg-bg-primary text-primary' : on && (mark ? 'bg-bg-3' : 'bg-bg-primary'),
        );
    const body = (
      <>
        {item.icon &&
          (isStringIcon(item.icon) && isSvgPath(item.icon) ? (
            <img src={item.icon} alt={item.label} className="h-8 w-8 rounded-xs" />
          ) : (
            <div className={`flex h-8 w-8 items-center justify-center ${on ? 'text-primary' : 'text-fg-2'}`}>{renderIcon(item.icon, 'w-5 h-5')}</div>
          ))}
        <div className="min-w-0 flex-1 text-left">
          <div className={cn('mt-0.5 truncate font-title text-sm', open ? 'font-medium' : on && !mark && 'font-medium text-primary')} title={item.label}>
            {item.label}
          </div>
          {item.caption && <div className={cn('-mt-1 truncate text-xs', open ? 'text-primary' : 'text-fg-3')}>{item.caption}</div>}
          {item.note && <div className="whitespace-normal break-words text-xs text-red">{item.note}</div>}
        </div>
        {sortColumns?.map(
          (c) =>
            c.fmt && (
              <span key={c.key} className={cn(SELECTION_DATA_COL, 'shrink-0 text-right font-numeric text-sm tabular-nums', c.className)}>
                {c.fmt(((item.data as Record<string, number | string | null> | undefined)?.[c.key] ?? null) as number | string | null)}
              </span>
            ),
        )}
        {item.badge}
      </>
    );
    // With a mark the row is a plain div holding TWO sibling controls (the open button fills the row, the mark toggles): no nested interactive.
    if (mark)
      return (
        <div key={item.id} className={cls}>
          <button type="button" disabled={off} aria-current={open || undefined} title={item.id} onClick={click} className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed">
            {body}
          </button>
          <button type="button" disabled={off} aria-label={on ? `Remove ${item.label}` : `Add ${item.label}`} aria-pressed={on} onClick={(e) => toggle(e, item.id)} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-xs hover:bg-bg-4 disabled:cursor-not-allowed">
            <Icon name={on ? 'check' : 'plus'} className={cn('h-3.5 w-3.5', on ? 'text-primary' : 'text-fg-2')} />
          </button>
        </div>
      );
    return (
      <button key={item.id} type="button" disabled={off} aria-current={open || undefined} onClick={off ? undefined : click} className={cls}>
        {body}
      </button>
    );
  };

  /** Section heading: icon + label + picked/total (+ the note of an empty section). With `onToggleMany`: a button toggling the section. */
  const heading = (g: SelectionGroup, rows: SelectionItem[]) => {
    const ids = rows.map((r) => r.id);
    const live = g.note ? [] : rows.filter((r) => !r.disabled); // a noted section ("DEX not deployed") takes no picks
    const n = live.filter((r) => selected.includes(r.id)).length;
    const inner = (
      <>
        {g.icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center">{g.icon}</span>}
        <span className="min-w-0 truncate font-medium text-fg-1">{g.label}</span>
        {g.note ? <span className="min-w-0 truncate text-fg-3">{L.noteSep}{g.note}</span> : live.length > 0 && <span className="ml-auto shrink-0 tabular-nums text-fg-3">{n}/{live.length}</span>}
      </>
    );
    const cls = cn(MODAL_PADDING, 'flex w-full items-center gap-2 bg-bg-2 py-1.5 text-left text-xs');
    return onToggleMany && live.length > 0 ? (
      <button type="button" id={headId(g.id)} data-group={g.id} aria-label={g.label} aria-pressed={live.every((r) => selected.includes(r.id))} onClick={() => onToggleMany(ids)} className={cn(cls, 'hover:bg-bg-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}>
        {inner}
      </button>
    ) : (
      <div id={headId(g.id)} data-group={g.id} className={cn(cls, !live.length && 'opacity-60')}>
        {inner}
      </div>
    );
  };

  const searching = !!q.trim();
  const rows = groups?.length
    ? (() => {
        let idx = 0;
        const known = new Set(groups.map((g) => g.id));
        const out: ComponentChildren[] = [];
        for (const g of groups) {
          const rs = ordered.filter((i) => i.group === g.id);
          if (!rs.length && searching) continue;
          // a section is a labelled group: screen readers announce "Monad, group" before its rows
          out.push(
            <div key={`g-${g.id}`} role="group" aria-labelledby={headId(g.id)} className="divide-y divide-border">
              {heading(g, rs)}
              {rs.map((r) => row(r, idx++))}
            </div>,
          );
        }
        for (const r of ordered.filter((i) => !i.group || !known.has(i.group))) out.push(row(r, idx++));
        return out;
      })()
    : ordered.map(row);
  const body = (
    <div className="divide-y divide-border">
      {rows}
      {ordered.length === 0 && !(groups?.length && !searching) && (
        <PageState kind="empty" message={search ? `${emptyMessage} for "${search}"` : emptyMessage} action={hasActiveFilters || !!search ? { label: L.reset, onClick: onResetFilters || (() => undefined) } : undefined} />
      )}
    </div>
  );
  return { header, body, filtered, keyDown: handleKeyDown };
}

