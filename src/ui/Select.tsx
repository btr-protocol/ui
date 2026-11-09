import { DROPDOWN_ITEM_SIZES, SIZE_CHECK, type Size } from '../lib/design';
import { useDebounce } from '../lib/useDebounce';
import type { DropdownItem, SelectionItem } from '../lib/uiTypes';
import { BaseModal, MODAL_PADDING, type ModalSize } from './BaseModal';
import { Button, type ButtonProps } from './Button';
import { PageState } from './Feedback';
import { KeyboardShortcutGroup } from './KeyboardShortcut';
import { MaskIcon } from './MaskIcon';
import { DATA_TABLE_HEADER, type SortDir, SortHeader, compareSorted } from './Table';
import { useKeyboardNav } from '../lib/useKeyboardNav';
import { addNotification } from '../lib/notifications';
import { cn } from '../lib/cn';
import { isStringIcon, isSvgPath, renderIcon } from '../lib/iconHelpers';
import type { ComponentChildren } from 'preact';
import { createPortal, forwardRef } from 'preact/compat';
import type { HTMLAttributes, Ref } from 'preact/compat';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { Tooltip } from './FloatingPanel';
import { Icon } from './Icon';
import { fieldSizing, inputVariants } from './Input';
import { FormRow } from './Primitives';
import { useDismiss } from './useDismiss';

export type { DropdownItem, SelectionItem } from '../lib/uiTypes';

/** The two Input variants a picker can wear: prose (`default`) or hex/id (`address`, mono). */
export type SelectVariant = 'default' | 'address';

export interface SelectProps extends Omit<HTMLAttributes<HTMLSelectElement>, 'size'> {
  variant?: SelectVariant;
  size?: Size;
  ref?: Ref<HTMLSelectElement>;
  value?: string | number;
  disabled?: boolean;
}

/**
 * A native `<select>` wearing `Input`'s chrome - same variants, same size scale, same border,
 * focus and `aria-invalid` treatment, because it renders literally the same class table.
 *
 * Native on purpose: no `appearance-none`, no custom popup, no keydown handler, so the platform
 * keeps the caret, typeahead, Home/End, Escape-cancels and the mobile picker for free. When a
 * menu needs icons, checks, multi-select or a portal, that is `Dropdown`, not this.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant = 'default', size = 'default', children, ...props }, ref) => (
    <select
      className={inputVariants({
        variant,
        className: cn(
          fieldSizing(variant, size),
          'cursor-pointer',
          typeof className === 'string' ? className : undefined,
        ),
      })}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  ),
);

interface DropdownProps<T = string> {
  items: DropdownItem<T>[];
  value: T | T[];
  onChange: (value: T | T[]) => void;
  mode?: 'single' | 'multi';
  /** Render custom trigger, or use default button */
  trigger?: ComponentChildren;
  /** Label shown in default trigger */
  placeholder?: string;
  /** Size variant */
  size?: Size;
  /** Style variant - maps to Button variant */
  variant?: ButtonProps['variant'];
  /** Direction to open */
  side?: 'top' | 'bottom' | 'auto';
  /** Leading icon on the default trigger. Named to match `Button.leftIcon`, and
   *  forwarded straight to it, so a dropdown in a button group is the same
   *  control as the buttons beside it. `adornment` is the TRAILING slot. */
  leftIcon?: ComponentChildren;
  /** Additional className for trigger */
  className?: string;
  /** Controlled open state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Footer content (e.g., "Clear all" button) */
  footer?: ComponentChildren;
  /** Min width of dropdown panel */
  minWidth?: number;
  /** Accessible name for the trigger. Required when no visible label sits beside the control:
   *  the trigger otherwise announces only its current value ("7d"), which does not say of what. */
  ariaLabel?: string;
  /** Control rendered INSIDE the default trigger between the label and the caret - an InfoBox
   *  ⓘ explaining the current value, say. It must stop its own pointer events (InfoBox does)
   *  so touching it does not toggle the menu, and it must stay visible: the label truncates,
   *  the adornment does not. */
  adornment?: ComponentChildren;
}

/** Only one toolbar/menu dropdown open at a time - opening another closes the previous. */
const dropdownClosers = new Map<string, () => void>();
let activeDropdownId: string | null = null;

function claimExclusiveOpen(id: string, close: () => void) {
  dropdownClosers.set(id, close);
  if (activeDropdownId && activeDropdownId !== id) {
    dropdownClosers.get(activeDropdownId)?.();
  }
  activeDropdownId = id;
}

function releaseExclusiveOpen(id: string) {
  if (activeDropdownId === id) activeDropdownId = null;
  dropdownClosers.delete(id);
}

export function Dropdown<T = string>({
  items,
  value,
  onChange,
  mode = 'single',
  trigger,
  placeholder = 'Select...',
  size = 'default',
  variant = 'secondary',
  side = 'auto',
  leftIcon,
  className,
  open: controlledOpen,
  onOpenChange,
  footer,
  minWidth = 120,
  ariaLabel,
  adornment,
}: DropdownProps<T>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
    minWidth?: number;
  } | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement & HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dropdownId = useId();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = (open: boolean) => {
    if (!open) {
      setHighlightedIndex(-1);
      setPosition(null);
      releaseExclusiveOpen(dropdownId);
    }
    if (isControlled) {
      onOpenChange?.(open);
    } else {
      setInternalOpen(open);
    }
  };
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  // Outside press / Escape / Back. Escape also hands focus back to the trigger and is not passed
  // on, so a chart or drawing surface below cannot act on the same key.
  useDismiss(
    isOpen,
    (e) => {
      const esc = e?.type === 'keydown';
      if (esc) {
        e?.preventDefault();
        e?.stopPropagation();
      }
      setOpen(false);
      if (esc) triggerRef.current?.focus?.();
    },
    (t) => !!triggerRef.current?.contains(t) || !!panelRef.current?.contains(t),
  );

  const selectedArray = Array.isArray(value) ? value : [value];
  const isSelected = (v: T) => selectedArray.includes(v);

  const getDisplayLabel = () => {
    if (mode === 'multi') {
      const count = selectedArray.length;
      return count === 0 ? placeholder : `${count} selected`;
    }
    const selected = items.find((i) => i.value === value);
    return selected?.label || placeholder;
  };

  // Claim/release exclusive open + compute position when opening
  useEffect(() => {
    if (!isOpen) {
      releaseExclusiveOpen(dropdownId);
      return;
    }

    claimExclusiveOpen(dropdownId, () => setOpenRef.current(false));

    const triggerEl = triggerRef.current;
    if (!triggerEl || typeof triggerEl.getBoundingClientRect !== 'function') return;

    const rect = triggerEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let openUp = side === 'top';
    if (side === 'auto') {
      openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    }

    let left = rect.left;
    const panelWidth = Math.max(minWidth, rect.width);
    if (left + panelWidth > viewportWidth - 8) {
      left = viewportWidth - panelWidth - 8;
    }
    if (left < 8) left = 8;

    setPosition({
      top: openUp ? rect.top : rect.bottom + 4,
      left,
      width: rect.width,
      openUp,
      minWidth,
    });

    return () => releaseExclusiveOpen(dropdownId);
  }, [isOpen, side, minWidth, dropdownId]);

  // Arrow/Enter navigation while open.
  useEffect(() => {
    if (!isOpen) return;

    const selectableItems = items.filter((item) => !item.disabled);

    const handleKeyboard = (e: KeyboardEvent) => {
      // Capture on document: while any dropdown is open it would otherwise swallow arrows and
      // Enter from every text field in the app (the caret stops moving), so editable targets pass.
      const target = e.target as HTMLElement | null;
      const editable =
        !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (editable) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex((prev) => {
            const next = prev + 1;
            return next >= selectableItems.length ? selectableItems.length - 1 : next;
          });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          e.stopPropagation();
          setHighlightedIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? 0 : next;
          });
          break;
        }
        case 'Enter': {
          e.preventDefault();
          e.stopPropagation();
          if (highlightedIndex >= 0 && highlightedIndex < selectableItems.length) {
            handleSelect(selectableItems[highlightedIndex].value, false);
          }
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyboard, true);
    return () => document.removeEventListener('keydown', handleKeyboard, true);
  }, [isOpen, highlightedIndex, items]);

  const handleSelect = (itemValue: T, disabled?: boolean) => {
    if (disabled) return;
    if (mode === 'single') {
      onChange(itemValue);
      setOpen(false);
    } else {
      const newValue = isSelected(itemValue)
        ? selectedArray.filter((v) => v !== itemValue)
        : [...selectedArray, itemValue];
      onChange(newValue as T[]);
    }
  };

  const toggleOpen = () => {
    if (isOpen) {
      setOpen(false);
    } else {
      claimExclusiveOpen(dropdownId, () => setOpenRef.current(false));
      setOpen(true);
    }
  };

  const itemSizeClasses = DROPDOWN_ITEM_SIZES[size] || DROPDOWN_ITEM_SIZES.default;

  const defaultTrigger = (
    <Button
      ref={triggerRef}
      onClick={toggleOpen}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      size={size}
      variant={variant}
      leftIcon={leftIcon}
      className={cn('justify-between text-left', className)}
      rightIcon={
        <Icon
          name="caret-down"
          className={cn(SIZE_CHECK[size], 'transition-transform', isOpen && 'rotate-180')}
        />
      }
    >
      <span className="flex min-w-0 flex-1 items-center gap-1 text-left">
        <span className="truncate">{getDisplayLabel()}</span>
        {adornment && <span className="shrink-0 inline-flex items-center">{adornment}</span>}
      </span>
    </Button>
  );

  // Custom triggers are arbitrary markup (icons, toolbar chips, tooltip wrappers), so the
  // wrapper must carry the button semantics itself: without tabIndex/role/keys none of them
  // can be opened from the keyboard, and Escape's refocus below lands on a non-focusable node.
  // Not a <button>: several triggers nest <div>s, which is invalid phrasing content.
  const triggerElement = trigger ? (
    <div
      ref={triggerRef}
      onClick={toggleOpen}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || (!isOpen && e.key === 'ArrowDown')) {
          e.preventDefault();
          toggleOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      className={cn('tap-target cursor-pointer', className)}
    >
      {trigger}
    </div>
  ) : (
    defaultTrigger
  );

  const panelContent = (
    <>
      <div className="max-h-64 overflow-y-auto">
        {items.map((item) => {
          const selectableItems = items.filter((i) => !i.disabled);
          const selectableIdx = selectableItems.findIndex((i) => i.value === item.value);
          const isHighlighted = selectableIdx === highlightedIndex && !item.disabled;
          const selected = isSelected(item.value);
          const disabled = item.disabled || false;

          // An item that navigates is a link, so it keeps middle-click, cmd-click and
          // "copy link address", and is announced as a link rather than a button.
          const Tag = (item.href ? 'a' : 'button') as 'a' | 'button';
          // Full-row hit target: an inset control covers the chrome; `trailing` (ⓘ) sits above
          // it with its own pointer events so nested buttons stay valid.
          const row = (
            <div
              className={cn(
                'relative w-full flex items-center gap-1 font-title font-medium transition-colors',
                itemSizeClasses.item,
                !disabled && 'hover:bg-bg-2',
                isHighlighted && !disabled && 'bg-bg-3',
                selected && !disabled && 'bg-bg-primary',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              onMouseEnter={() => {
                if (!disabled) setHighlightedIndex(selectableIdx);
              }}
            >
              <Tag
                {...(item.href
                  ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
                  : { type: 'button', disabled })}
                aria-label={typeof item.label === 'string' ? item.label : undefined}
                onClick={(e: MouseEvent) => {
                  if (item.href) {
                    setOpen(false);
                    return;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(item.value, disabled);
                }}
                className={cn(
                  'absolute inset-0 z-0',
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                  item.href && 'no-underline',
                )}
              />
              <div className="relative z-[1] flex min-w-0 flex-1 items-center gap-1.5 pointer-events-none">
                {!!item.icon && (
                  <span
                    className={cn('shrink-0', selected && !disabled ? 'text-primary' : 'text-fg-2')}
                  >
                    {renderIcon(item.icon, itemSizeClasses.icon)}
                  </span>
                )}
                <span className={cn(selected && !disabled && 'text-primary font-medium')}>
                  {item.label}
                </span>
                {item.detail != null && <span className="ml-auto shrink-0 pl-3 font-normal tabular-nums text-fg-2">{item.detail}</span>}
                {item.trailing ? (
                  <div
                    // Same active color as the label: the trailing ⓘ is part of the row's
                    // statement, so it must not read dimmer than the text it annotates.
                    className={cn(
                      'shrink-0 inline-flex items-center pointer-events-auto',
                      selected && !disabled && 'text-primary',
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {item.trailing}
                  </div>
                ) : null}
              </div>
              {selected && !disabled && (
                <Icon
                  name="check"
                  className={cn(
                    'relative z-[1] shrink-0 text-primary pointer-events-none',
                    itemSizeClasses.check,
                  )}
                />
              )}
            </div>
          );

          if (disabled && item.tooltip) {
            return (
              <Tooltip key={String(item.value)} content={item.tooltip} side="left" asChild>
                <div className="w-full">{row}</div>
              </Tooltip>
            );
          }

          return (
            <div key={String(item.value)} className="w-full">
              {row}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className={cn('text-center text-fg-2', itemSizeClasses.item)}>No options</div>
        )}
      </div>

      {footer && (
        <>
          <div className="border-t border-border" />
          {footer}
        </>
      )}
    </>
  );

  const panel =
    isOpen && position
      ? createPortal(
          <div
            ref={panelRef}
            data-dropdown-id={dropdownId}
            className="fixed z-dropdown bg-bg-1 border border-border rounded-sm shadow-lg overflow-hidden pointer-events-auto font-title outline-none"
            tabIndex={-1}
            style={{
              top: position.openUp ? 'auto' : `${position.top}px`,
              bottom: position.openUp ? `${window.innerHeight - position.top + 4}px` : 'auto',
              left: `${position.left}px`,
              minWidth: `${Math.max(position.minWidth || 120, position.width)}px`,
              // A menu sizes to its items: a footer caption must wrap, never widen the panel.
              maxWidth: 'min(22rem, calc(100vw - 16px))',
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {panelContent}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {triggerElement}
      {panel}
    </>
  );
}

/** Width of ONE right-aligned data column, shared by the sort header and the `badge` a caller
 *  renders into the row: they must match or every numeric column sits off its heading. */
export const SELECTION_DATA_COL = 'w-[4.5rem]';

export interface SelectionSortColumn {
  key: string;
  label: string;
  /** Extra header classes, e.g. the phone-hide a matching row cell wears. */
  className?: string;
}

/** A section of the list (`SelectionItem.group`): e.g. a chain heading its pools. */
export interface SelectionGroup {
  id: string;
  label: string;
  icon?: ComponentChildren;
  /** Why the section is empty or off ("DEX not deployed"): shown on the heading, the section takes no picks. */
  note?: string;
}
/** A quick pick above the list (multi): toggles its ids in the pending selection. */
export interface SelectionPreset {
  id: string;
  label: string;
  ids: readonly string[];
}

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
}
const SELECTION_LABELS: SelectionLabels = {
  navigate: 'Navigate',
  select: 'Select',
  toggle: 'Toggle',
  close: 'Close',
  selected: (n) => `${n} selected`,
  selectAll: 'Select All',
  unselectAll: 'Unselect All',
  unselectAllBut: (n) => `Unselect all but ${n}`,
  reset: 'Reset',
};

interface SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  searchPlaceholder?: string;
  items: SelectionItem[];
  selectedIds: string[];
  onSelect: (id: string | string[]) => void;
  minSelect?: number;
  maxSelect?: number;
  filterFn?: (item: SelectionItem, search: string) => boolean;
  headerRight?: ComponentChildren;
  /** Content between the search bar and the list: static column labels, or a whole identity row
   *  (the wallet account modal puts its address + actions here). Sits above the sort header, and
   *  above the scroller with it - the scrollbar belongs to the rows alone. */
  listHeader?: ComponentChildren;
  /**
   * Sortable headers (reuses table `SortHeader` + `compareSorted`). Prepends the primary column.
   * Values from `item.data[key]` (number | string | null); primary sorts by `item.label`.
   */
  sortColumns?: SelectionSortColumn[];
  /** Label of the prepended primary (label) column. Its sort key is always `asset`. */
  primaryColumnLabel?: string;
  /** Re-applied each time the modal opens. */
  initialSort?: { key: string; dir: Exclude<SortDir, null> };
  emptyMessage?: string;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  size?: ModalSize;
  /** false = a titled modal without the search box (short fixed lists: swatches). Default true. */
  searchable?: boolean;
  multiSelect?: boolean;
  applyLabel?: string;
  labels?: Partial<SelectionLabels>;
  /** Sections, in order: rows list under their `group`; a section without rows still shows its heading + `note`
   *  (a chain the protocol is not deployed on). Multi: the heading toggles its enabled rows. */
  groups?: readonly SelectionGroup[];
  /** Multi: quick picks above the list ("Whole DEX", a pool, an asset); pressed = every id of it picked. */
  presets?: readonly SelectionPreset[];
}

/** Same cycle as `useTableSort`: new key → asc → desc → off. */
function nextSort(
  prev: { key: string | null; dir: SortDir },
  key: string,
): { key: string | null; dir: SortDir } {
  if (prev.key !== key) return { key, dir: 'asc' };
  if (prev.dir === 'asc') return { key, dir: 'desc' };
  if (prev.dir === 'desc') return { key: null, dir: null };
  return { key, dir: 'asc' };
}

export function SelectionModal({
  isOpen,
  onClose,
  title,
  searchPlaceholder = 'Search...',
  searchable = true,
  items,
  selectedIds,
  onSelect,
  minSelect,
  maxSelect,
  filterFn,
  headerRight,
  listHeader,
  sortColumns,
  primaryColumnLabel = 'Asset',
  initialSort,
  emptyMessage = 'No items found',
  onResetFilters,
  hasActiveFilters = false,
  size = 'md',
  multiSelect = false,
  applyLabel = 'Ok',
  labels,
  groups,
  presets,
}: SelectionModalProps) {
  const L = { ...SELECTION_LABELS, ...labels };
  const [search, setSearch] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>(selectedIds);
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({
    key: initialSort?.key ?? null,
    dir: initialSort?.dir ?? null,
  });
  const debounced = useDebounce(search, 300);
  // A short list filters in one frame: the 300 ms lag only pays for itself on a long one.
  const debouncedSearch = items.length <= 50 ? search : debounced;

  const isMulti = multiSelect || (maxSelect !== undefined && maxSelect !== 1);
  const minSelections = minSelect ?? (isMulti ? 1 : 0);
  const maxSelections = maxSelect ?? (isMulti ? Infinity : 1);

  useEffect(() => {
    if (!isOpen) return;
    setTempSelected(selectedIds);
    setSearch('');
    setSort({
      key: initialSort?.key ?? null,
      dir: initialSort?.dir ?? null,
    });
  }, [isOpen]);

  const defaultFilterFn = (item: SelectionItem, searchQuery: string): boolean => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      item.label.toLowerCase().includes(query) ||
      (item.caption?.toLowerCase().includes(query) ?? false)
    );
  };
  const filterFunction = filterFn || defaultFilterFn;

  const filteredItems = useMemo(() => {
    return items.filter((item) => filterFunction(item, debouncedSearch));
  }, [items, debouncedSearch, filterFunction]);

  const displayedItems = useMemo(() => {
    if (!sortColumns?.length || !sort.key || !sort.dir) return filteredItems;
    const pin = filteredItems.filter((i) => i.pinned);
    return [...pin, ...compareSorted(
      filteredItems.filter((i) => !i.pinned),
      (item) => {
        if (sort.key === 'asset') return item.label;
        const data = item.data as Record<string, number | string | null | undefined> | undefined;
        return data?.[sort.key!] ?? null;
      },
      sort.dir,
    )];
  }, [filteredItems, sortColumns, sort.key, sort.dir]);
  // Sections keep their order; the sort applies inside each. Rows of no known section go last.
  const ordered = useMemo(() => {
    if (!groups?.length) return displayedItems;
    const known = new Set(groups.map((g) => g.id));
    return [...groups.flatMap((g) => displayedItems.filter((i) => i.group === g.id)), ...displayedItems.filter((i) => !i.group || !known.has(i.group))];
  }, [displayedItems, groups]);

  const { selectedIndex, handleKeyDown } = useKeyboardNav({
    items: ordered,
    onSelect: (item) => handleToggle(item.id),
    isEnabled: isOpen,
  });

  const handleToggle = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item?.disabled) return;
    if (isMulti) {
      setTempSelected((prev) => {
        const idx = prev.indexOf(id);
        const isSelected = idx !== -1;
        if (isSelected && prev.length <= minSelections) {
          addNotification('warning', `At least ${minSelections} must remain selected`);
          return prev;
        }
        if (!isSelected && prev.length >= maxSelections) {
          addNotification('warning', `Maximum ${maxSelections} selections allowed`);
          return prev;
        }
        return isSelected ? prev.filter((_, i) => i !== idx) : [...prev, id];
      });
    } else {
      onSelect(id);
      onClose();
    }
  };

  /** Toggle a set (a section heading, a preset): all of its enabled ids picked -> drop them, else add the missing ones. */
  const toggleMany = (ids: readonly string[]) => {
    const on = ids.filter((id) => !items.find((i) => i.id === id)?.disabled);
    if (!on.length) return;
    setTempSelected((prev) => (on.every((id) => prev.includes(id)) ? prev.filter((id) => !on.includes(id)) : [...new Set([...prev, ...on])]));
  };
  const allOn = (ids: readonly string[]) => { const on = ids.filter((id) => !items.find((i) => i.id === id)?.disabled); return on.length > 0 && on.every((id) => tempSelected.includes(id)); };

  const handleSelectAll = () => {
    // only what the search leaves visible (and enabled); rows already chosen outside the filter stay chosen
    const visible = filteredItems.filter((item) => !item.disabled).map((item) => item.id);
    setTempSelected((prev) => [...new Set([...prev, ...visible])]);
  };

  const handleDeselectAll = () => {
    // clears only the visible rows
    const next = tempSelected.filter((id) => !selectableIds.includes(id));
    if (next.length >= minSelections) setTempSelected(next);
    else setTempSelected(tempSelected.slice(0, minSelections));
  };

  // Counted over what Select All can actually reach: disabled rows are skipped there, so
  // comparing against `items.length` left the label stuck on 'Select All' forever.
  const selectableIds = filteredItems.filter((item) => !item.disabled).map((item) => item.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => tempSelected.includes(id));

  const handleApply = () => {
    if (tempSelected.length < minSelections) {
      addNotification('error', `Select at least ${minSelections}`);
      return;
    }
    onSelect(tempSelected);
    onClose();
  };

  const sortHeader = sortColumns?.length ? (
    <div
      className={cn(DATA_TABLE_HEADER, MODAL_PADDING, 'flex items-center gap-3 py-2')}
      role="row"
    >
      {/* No icon-width spacer: the primary heading starts at the ICON's left edge, not the
          label's. Aligning it to the label left the heading floating in the middle of the
          column with the glyphs hanging outside it. */}
      <div
        className="flex flex-1 min-w-0 items-center gap-3"
        role="columnheader"
        aria-sort={
          sort.key === 'asset' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
        }
      >
        <SortHeader
          label={primaryColumnLabel}
          sortKey="asset"
          active={sort.key === 'asset'}
          dir={sort.dir}
          onToggle={(k) => setSort((s) => nextSort(s, k))}
          align="left"
        />
      </div>
      {sortColumns.map((col) => (
        <div
          key={col.key}
          className={cn(SELECTION_DATA_COL, 'shrink-0 flex justify-end', col.className)}
          role="columnheader"
          aria-sort={
            sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
          }
        >
          <SortHeader
            label={col.label}
            sortKey={col.key}
            active={sort.key === col.key}
            dir={sort.dir}
            onToggle={(k) => setSort((s) => nextSort(s, k))}
            align="right"
          />
        </div>
      ))}
    </div>
  ) : null;

  // One block ABOVE the scroller, not a sticky pinned inside it: whatever the surface put above
  // the list - identity row, sort header, or both stacked - is a sibling of the rows, so the
  // scrollbar runs beside the rows alone instead of the whole panel. See `ScrollPane`.
  const presetBar =
    isMulti && presets?.length ? (
      <div className={cn(MODAL_PADDING, 'flex flex-wrap items-center gap-1.5 py-2')} role="group">
        {presets.map((p) => {
          const on = allOn(p.ids);
          return (
            <Button key={p.id} size="sm" active={on} aria-pressed={on} disabled={!p.ids.some((id) => !items.find((i) => i.id === id)?.disabled)} onClick={() => toggleMany(p.ids)}>
              {p.label}
            </Button>
          );
        })}
      </div>
    ) : null;
  const pinnedHeader =
    listHeader || sortHeader || presetBar ? (
      <>
        {listHeader}
        {presetBar}
        {sortHeader}
      </>
    ) : null;

  const renderRow = (item: SelectionItem, idx: number) => {
    const isSelected = tempSelected.includes(item.id);
    const isHighlighted = idx === selectedIndex;
    const isDisabled = !!item.disabled;
    return (
      <button
        key={item.id}
        type="button"
        disabled={isDisabled}
        onClick={() => handleToggle(item.id)}
        className={cn(
          `w-full flex items-center gap-3 ${MODAL_PADDING} py-2 coarse:min-h-14 transition-colors`,
          isDisabled
            ? 'opacity-60 cursor-not-allowed'
            : isHighlighted
              ? 'bg-bg-2'
              : 'hover:bg-bg-2',
          isSelected && !isDisabled ? 'bg-bg-primary' : '',
        )}
      >
        {item.icon &&
          (isStringIcon(item.icon) && isSvgPath(item.icon) ? (
            <img src={item.icon} alt={item.label} className="w-8 h-8 rounded-xs" />
          ) : (
            <div
              className={`w-8 h-8 flex items-center justify-center ${isSelected ? 'text-primary' : 'text-fg-2'}`}
            >
              {renderIcon(item.icon, 'w-5 h-5')}
            </div>
          ))}
        <div className="flex-1 text-left min-w-0">
          <div
            className={`font-title text-sm truncate mt-0.5 ${isSelected ? 'text-primary font-medium' : ''}`}
          >
            {item.label}
          </div>
          {item.caption && (
            <div className="text-xs text-fg-3 truncate -mt-1">{item.caption}</div>
          )}
          {item.note && <div className="text-xs text-red whitespace-normal break-words">{item.note}</div>}
        </div>
        {item.badge}
        {/* No trailing check mark: it shoved the right-aligned amount block (wallet balance /
            USD) left on the selected row. Selection already reads from bg-bg-primary plus
            the primary label colour. */}
      </button>
    );
  };

  /** Section heading: icon + label + picked/total (+ the note of an empty section). Multi: a button toggling the section. */
  const renderGroup = (g: SelectionGroup, rows: SelectionItem[]) => {
    const ids = rows.map((r) => r.id);
    const live = rows.filter((r) => !r.disabled);
    const n = live.filter((r) => tempSelected.includes(r.id)).length;
    const inner = (
      <>
        {g.icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center">{g.icon}</span>}
        <span className="min-w-0 truncate font-medium text-fg-1">{g.label}</span>
        {g.note ? <span className="min-w-0 truncate text-fg-3">· {g.note}</span> : live.length > 0 && <span className="ml-auto shrink-0 tabular-nums text-fg-3">{n}/{live.length}</span>}
      </>
    );
    const cls = cn(MODAL_PADDING, 'flex w-full items-center gap-2 bg-bg-2 py-1.5 text-left text-xs');
    return isMulti && live.length > 0 ? (
      <button type="button" key={`g-${g.id}`} data-group={g.id} aria-pressed={allOn(ids)} onClick={() => toggleMany(ids)} className={cn(cls, 'hover:bg-bg-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}>
        {inner}
      </button>
    ) : (
      <div key={`g-${g.id}`} data-group={g.id} role="presentation" className={cn(cls, !live.length && 'opacity-60')}>
        {inner}
      </div>
    );
  };
  const searching = !!debouncedSearch.trim();
  const body = groups?.length
    ? (() => {
        let idx = 0;
        const known = new Set(groups.map((g) => g.id));
        const out: ComponentChildren[] = [];
        for (const g of groups) {
          const rows = ordered.filter((i) => i.group === g.id);
          if (!rows.length && searching) continue;
          out.push(renderGroup(g, rows));
          for (const r of rows) out.push(renderRow(r, idx++));
        }
        for (const r of ordered.filter((i) => !i.group || !known.has(i.group))) out.push(renderRow(r, idx++));
        return out;
      })()
    : ordered.map((item, idx) => renderRow(item, idx));

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      headerType={searchable ? 'input' : 'title'}
      placeholder={searchPlaceholder}
      searchValue={search}
      onSearchChange={setSearch}
      onSearchKeyDown={handleKeyDown}
      size={size}
      headerRight={headerRight}
      bodyHeader={pinnedHeader}
      footerNav={
        <KeyboardShortcutGroup
          shortcuts={[
            { keys: '↑↓', label: L.navigate },
            { keys: 'Enter', label: isMulti ? L.toggle : L.select },
            { keys: 'Esc', label: L.close },
          ]}
        />
      }
      footerContent={
        isMulti ? (
          <FormRow
            label={L.selected(tempSelected.length)}
            labelClassName="text-sm text-fg-2"
            value={
              <div className="flex items-center gap-2">
                <Button
                  size="default"
                  onClick={allSelected ? handleDeselectAll : handleSelectAll}
                  disabled={allSelected && tempSelected.length === minSelections}
                >
                  {allSelected
                    ? minSelections > 0
                      ? L.unselectAllBut(minSelections)
                      : L.unselectAll
                    : L.selectAll}
                </Button>
                <Button variant="primary" size="default" onClick={handleApply}>
                  {applyLabel}
                </Button>
              </div>
            }
          />
        ) : undefined
      }
    >
      <div className="divide-y divide-border">
        {body}
        {ordered.length === 0 && !(groups?.length && !searching) && (
          <PageState
            kind="empty"
            message={search ? `${emptyMessage} for "${search}"` : emptyMessage}
            action={
              hasActiveFilters || !!search
                ? {
                    label: L.reset,
                    onClick: onResetFilters || (() => setSearch('')),
                  }
                : undefined
            }
          />
        )}
      </div>
    </BaseModal>
  );
}

interface FilterButtonProps {
  label: string;
  options: SelectionItem[];
  selected: string[];
  maxVisible?: number;
  onClick: () => void;
  partialFilter?: boolean;
  onClear?: () => void;
}

export function FilterButton({
  label,
  options,
  selected,
  maxVisible = 3,
  onClick,
  partialFilter = false,
  onClear,
}: FilterButtonProps) {
  const selectedOptions = options.filter((opt) => selected.includes(opt.id));
  const visibleOptions = selectedOptions.slice(0, maxVisible);
  const remainingCount = Math.max(0, selectedOptions.length - maxVisible);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-2.5 rounded-sm transition-colors bg-bg-primary border border-primary"
    >
      <span className="text-sm text-primary font-medium">{label}</span>
      <div className="flex items-center gap-0.5">
        {visibleOptions.length === 0 ? (
          <MaskIcon src="/icons/filter-on.svg" size="md" color="var(--fg-primary)" />
        ) : (
          <>
            {visibleOptions.map((opt) => {
              const iconSrc = opt.miniIcon || opt.icon;
              return isStringIcon(iconSrc) && isSvgPath(iconSrc) ? (
                partialFilter ? (
                  <div key={opt.id} className="relative w-5 h-5" title={opt.label}>
                    <img src={iconSrc} alt={opt.label} className="w-5 h-5 rounded-full" />
                    <div
                      className="absolute inset-0 rounded-full pointer-events-none bg-primary opacity-50"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                  </div>
                ) : (
                  <MaskIcon
                    key={opt.id}
                    src={iconSrc}
                    size="md"
                    color="var(--fg-primary)"
                    aria-label={opt.label}
                  />
                )
              ) : (
                <div
                  key={opt.id}
                  title={opt.label}
                  className="w-5 h-5 flex items-center justify-center text-primary [&>*]:!w-5 [&>*]:!h-5"
                >
                  {renderIcon(iconSrc, 'w-5 h-5')}
                </div>
              );
            })}
            {remainingCount > 0 && (
              <span className="text-sm text-primary font-semibold pl-0.5">+{remainingCount}</span>
            )}
            {onClear && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="ml-0.5 flex items-center justify-center w-4 h-4 hover:bg-bg-3 rounded-sm text-primary transition-colors"
                title="Clear filter"
              >
                <Icon name="x" className="w-3 h-3" />
              </button>
            )}
          </>
        )}
      </div>
    </button>
  );
}
