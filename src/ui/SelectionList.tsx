import { useMemo, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { MODAL_PADDING } from './BaseModal';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { SearchInput } from './SearchInput';
import { SelectionModal } from './Select';
import { type SelectionFilter, type SelectionViewProps, chipMatch, groupOf, useSelectionView } from './selectionView';

export * from './selectionView';

export interface SelectionListProps extends Omit<SelectionViewProps, 'search' | 'enabled' | 'resetKey' | 'filterFn' | 'onResetFilters' | 'hasActiveFilters'> {
  searchPlaceholder?: string;
  /** Chips under the search field (items carry matching `tags`). */
  filters?: readonly SelectionFilter[];
  /** Cap the scrolling body (px). */
  maxHeight?: number;
  className?: string;
}

/** The inline selection list: the modal's list (label + caption, sortable figure columns, state mark) under its own search bar, with
 *  the filters as toggle chips right under the field, as the front's asset picker. A master pane, a series picker. */
export function SelectionList({ searchPlaceholder = 'Search…', filters, maxHeight, className, items, mark, ...rest }: SelectionListProps) {
  const [search, setSearch] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const shown = useMemo(() => (filters?.length ? items.filter((i) => chipMatch(i.tags, filters, chips)) : items), [items, filters, chips]);
  const reset = () => (setSearch(''), setChips([]));
  const v = useSelectionView({ ...rest, mark, items: shown, search, onResetFilters: reset, hasActiveFilters: chips.length > 0 });
  const [pick, setPick] = useState(false);
  const label = (f: SelectionFilter) => filters?.find((x) => x.id === f.id)?.label ?? f.id;
  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="border-b border-border bg-bg-1">
        <div className={cn('flex h-12 items-center gap-2', mark ? 'px-3' : MODAL_PADDING)}>
          {/* One bordered field: the active filters are chips in it (the front's scope chip in the search header), the funnel opens the filter picker. */}
          <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-sm border border-border bg-bg-2 pl-1.5 pr-1 focus-within:border-primary">
            {filters?.filter((f) => chips.includes(f.id)).map((f) => (
              <Badge key={f.id} variant="chip" className="shrink-0">
                <button type="button" onClick={() => setChips((c) => c.filter((x) => x !== f.id))} title={`Remove ${label(f)}`} className="inline-flex items-center gap-1">
                  {f.label}
                  <Icon name="x" className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <SearchInput variant="bare" className="min-w-[4rem] flex-1" value={search} onChange={setSearch} onKeyDown={v.keyDown} placeholder={chips.length ? 'Search' : searchPlaceholder} />
            {filters?.length ? (
              <button type="button" aria-label="Filters" title="Filters" onClick={() => setPick(true)} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xs text-fg-2 hover:bg-bg-4 hover:text-fg-0">
                <Icon name="funnel" className={cn('h-4 w-4', chips.length && 'text-primary')} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {filters?.length ? (
        <SelectionModal
          isOpen={pick}
          onClose={() => setPick(false)}
          title="Filters"
          searchable={false}
          multiSelect
          minSelect={0}
          items={filters.map((f) => ({ id: f.id, label: f.label, group: groupOf(f) }))}
          groups={[...new Set(filters.map(groupOf))].map((g) => ({ id: g, label: g }))}
          selectedIds={chips}
          onSelect={(ids) => setChips(Array.isArray(ids) ? ids : [ids])}
          applyLabel="Apply"
          size="sm"
        />
      ) : null}
      {v.header}
      <div className="min-h-0 flex-1 overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
        {v.body}
      </div>
    </div>
  );
}
