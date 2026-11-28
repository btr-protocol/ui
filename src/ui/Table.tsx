// Canonical Table: sortable headers, search, virtual window, phone horizontal scroll with a sticky first column. Family contract
// with Panel/ChartShell: `title` + `meta` header, `loading`, empty as `emptyMessage`. Sort is ONE
// cycle (asc, desc, off) via useTableSort; SortHeader is the only sort control, `<th>` only
// carries aria-sort.

import { SEVERITY_ICON } from '../lib/severity';
import { openPopout } from '../lib/popout';
import { safeHref } from '../lib/safeHref';
import { itemAt, itemOffsets, virtualWindow } from '../lib/virtualWindow';
import { Empty, PageState } from './Feedback';
import { DataSpinner } from './Spinner';
import { Tooltip } from './FloatingPanel';
import { cn } from '../lib/cn';
import type { ComponentChildren, JSX } from 'preact';
import { useContext, useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from './Icon';
import { InfoTip } from './InfoBox';
import { HeaderBar, InFrame, Panel } from './Panel';
import { SearchInput } from './SearchInput';
import type { InputProps } from './Input';

export const DATA_TABLE_HEADER =
  'border-b border-border bg-bg-3 text-xs uppercase tracking-wide text-fg-1 font-semibold';
export const DATA_TABLE_ROW = 'transition-colors hover:bg-bg-2';
/**
 * The one row-actions reveal, shared by every list/table row (notifications log, pools table).
 * The row carries Tailwind's `group`; its actions container adds this and stays hidden until the
 * row is hovered or focus moves into it. Without hover (`(hover: none)`, touch) they stay visible
 * rather than unreachable.
 */
export const ROW_ACTIONS =
  'transition-opacity hoverable:opacity-0 group-hover:opacity-100 focus-within:opacity-100';
/** Selected row of a `selectable` table: the SelectionModal highlight (primary tint + primary text, bold so
 *  the state is never colour alone). Cells that pin their own text colour must follow it themselves. */
export const SELECTED_ROW = 'bg-bg-primary hover:bg-bg-primary text-primary font-semibold';

/** Roving-focus target for a row key: arrows step (clamped), Home/End jump. null = not ours. */
export function rowNavTarget(key: string, index: number, count: number): number | null {
  if (count < 1) return null;
  if (key === 'ArrowDown') return Math.min(index + 1, count - 1);
  if (key === 'ArrowUp') return Math.max(index - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
const VIRTUAL_ROW_H = 32;
const COMPACT_ROW_H = 28;
/** Height of a virtual body's day separator (the one non-data item in the height model). */
const DAY_ROW_H = 24;
/** Load more when this few DATA rows remain below the viewport (counted from item offsets, not pixels). */
const LOAD_MORE_ROWS = 10;

/**
 * THE table geometry, named once. Every table in the app - the semantic `<Table>` below and the
 * grid tables that cannot use it (PoolsPage) - reads these instead of re-typing the strings, so
 * a padding or a divider changes in ONE place and cannot drift between two tables, between the
 * virtual and non-virtual bodies.
 */
/** Header cell: sticky so a scrolled body keeps its labels. */
const TABLE_HEAD_CELL = 'px-3 py-1.5 font-medium bg-bg-3 sticky top-0 z-raised';
/** A sortable header is a click target and must not select its own label on double-click. */
const TABLE_HEAD_SORTABLE = 'cursor-pointer select-none hover:text-fg-1';
/** Body cell. Vertical padding is added per body: the virtual one pays its rhythm with a fixed
 *  row height (`py-0`) instead, so its cells must not add any of their own. */
const TABLE_CELL = 'px-3 align-middle';
/** Row rule. `last:border-0` because the frame's own border closes the table. */
const TABLE_ROW_BORDER = 'border-b border-border last:border-0';
/** The one focus ring for a row that is itself a click target (pool rows, asset rows). Inset:
 *  an outset ring on a full-bleed row is clipped by the frame's `overflow-hidden`. */
export const ROW_FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
/** Phones get the desktop table: horizontal scroll (nowrap cells; `min-w-full`, not `min-w-max`, which
 *  resolves a `width:100%` column to ~1e6px), sticky first column, compact 2xs cells. */
const PHONE =
  'max-sm:overflow-x-auto max-sm:[&_table]:min-w-full max-sm:[&_table]:text-2xs max-sm:[&_td]:whitespace-nowrap max-sm:[&_th]:whitespace-nowrap max-sm:[&_td]:px-2 max-sm:[&_th]:px-2 ' +
  'max-sm:[&_td:first-child]:sticky max-sm:[&_th:first-child]:sticky max-sm:[&_td:first-child]:left-0 max-sm:[&_th:first-child]:left-0 max-sm:[&_td:first-child]:z-base max-sm:[&_th:first-child]:z-base max-sm:[&_td:first-child]:bg-bg-1 max-sm:[&_th:first-child]:bg-bg-1';
const TABLE_BASE = 'w-full text-sm';

const alignCls = (a?: 'left' | 'right' | 'center') =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

/**
 * Sort state, shared by the semantic `<Table>` and the grid tables that cannot use it
 * (nested/expandable rows). One cycle everywhere: asc, desc, off.
 */
export function useTableSort(initial?: { key: string; dir: SortDir }) {
  const [sortKey, setSortKey] = useState<string | null>(initial?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(initial?.dir ?? null);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') setSortDir('desc');
    else if (sortDir === 'desc') {
      setSortKey(null);
      setSortDir(null);
    } else setSortDir('asc');
  };

  return { sortKey, sortDir, toggleSort };
}

/**
 * Comparator for a sort key. Nulls always sink, whichever direction: a pool with no
 * indexed APR is unknown, not worst, so it must never top a descending sort.
 */
export function compareSorted<Row>(
  rows: readonly Row[],
  valueOf: (row: Row) => number | string | null | undefined,
  dir: SortDir,
): Row[] {
  if (!dir) return [...rows];
  return [...rows].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    return dir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });
}

/**
 * The one sort affordance: neutral both-ways arrow when idle, up/down when active.
 * A button, so grid headers (plain divs, no <th>) stay keyboard-reachable. `aria-sort`
 * lives on the columnheader (the <th> in HeadRow, role="columnheader" in grid headers),
 * never on this button: the button only labels its own state for screen readers.
 */
export function SortHeader({
  label,
  sortKey: key,
  active,
  dir,
  onToggle,
  align = 'right',
  className,
}: {
  label: ComponentChildren;
  sortKey: string;
  active: boolean;
  dir: SortDir;
  onToggle: (key: string) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const on = active && dir !== null;
  const state = !on ? 'not sorted' : dir === 'asc' ? 'sorted ascending' : 'sorted descending';
  return (
    <button
      type="button"
      onClick={() => onToggle(key)}
      aria-label={`${typeof label === 'string' ? label : key}: ${state}. Activate to sort.`}
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 select-none hover:text-fg-1',
        'rounded-sm uppercase tracking-wide coarse:min-h-[var(--ctl-m)]',
        align === 'right' ? 'flex-row-reverse' : '',
        on && 'text-fg-1',
        className,
      )}
    >
      {/* truncate, not wrap: a header that grows collides with its neighbour on a narrow grid
          track, and a wrapped one desynchronises the row heights. */}
      <span className="truncate" aria-hidden>
        {label}
      </span>
      <Icon
        name={!on ? 'arrow-down-up' : dir === 'asc' ? 'arrow-up' : 'arrow-down'}
        size={11}
        className={cn('shrink-0', on ? 'text-primary' : 'text-fg-2')}
      />
    </button>
  );
}

export type SortDir = 'asc' | 'desc' | null;

export interface TableColumn<Row> {
  key: string;
  label: string;
  sortable?: boolean; // header click toggles sort
  search?: boolean; // include in search match (default: true)
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Preferred header-cell width (any CSS width). Auto-layout treats it as the column's
   *  share; content can still force it wider. */
  width?: number | string;
  /** What the column MEANS, as a ⓘ beside its heading. For a number whose shape is surprising and
   *  correct - a coverage ratio, an APR that spans three orders of magnitude across legs - where
   *  the explanation has to sit where the number is read and not in a doc nobody opens. */
  hint?: { label: string; content: ComponentChildren };
  render?: (row: Row) => JSX.Element | string | number | null;
  // value extractor for sort / search. defaults to row[key]
  getValue?: (row: Row) => string | number | null | undefined;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  data: Row[];
  /** Compact embedded table: keeps columns on phones and shares the chart frame. */
  variant?: 'default' | 'compact';
  className?: string;
  /** Shared interaction bindings for linked chart rows. */
  rowProps?: (
    row: Row,
  ) => Pick<
    JSX.HTMLAttributes<HTMLElement>,
    'tabIndex' | 'onPointerEnter' | 'onPointerLeave' | 'onPointerUp' | 'onFocus' | 'onBlur'
  >;
  /** Section heading rendered inside the frame; the search input joins it on the
   *  same row so heading + controls + table read as one object (MetricsPage idiom). */
  title?: string;
  /** Right-aligned header content (source note, selector). Requires `title`. */
  meta?: ComponentChildren;
  /** The search resets when this changes (the data source or segment the rows come from). */
  resetKey?: unknown;
  searchPlaceholder?: string;
  searchable?: boolean;
  onRowClick?: (row: Row) => void;
  /** Makes rows selectable (master list): click / Enter / Space call it; ArrowUp/Down/Home/End move
   *  focus (roving tabindex); the row carries `aria-selected` and the `SELECTED_ROW` style. */
  onSelect?: (row: Row, key: string) => void;
  /** `rowKey` of the selected row, or null. */
  selectedKey?: string | null;
  /** Visually hides the column header (kept for screen readers). The frame (outer border, nested radius, row dividers) stays. */
  noHeader?: boolean;
  /** false = no own border/radius/fill (the table sits inside a frame that already has one, e.g. the master of a MasterDetail).
   *  Default: off inside a framed Panel (`InFrame`: the container draws the one border), on elsewhere. */
  frame?: boolean;
  rowKey: (row: Row, idx: number) => string;
  /** Rows held above the body: never searched, sorted or counted as empty (aggregates that frame
   *  the rows beneath them). Plain table only: the virtual body ignores it. */
  pinned?: Row[];
  emptyMessage?: string;
  initialSort?: { key: string; dir: SortDir };
  /**
   * Optional per-row class on the `<tr>` - used to
   * grey out rows whose underlying market is closed. Return `undefined` for no override.
   */
  rowClassName?: (row: Row) => string | undefined;
  /** Full-body load: overlay the table, never a caption in the toolbar. */
  loading?: boolean;
  loadingTitle?: string;
  /** Cap the (non-virtual) body height in px and scroll within it; the sticky
   *  header stays pinned. For bounded feeds where virtualization is overkill. */
  maxHeight?: number;
  /** Columns keep their natural width and the body scrolls sideways inside the frame (title and meta stay put): many numeric columns on a laptop. */
  scrollX?: boolean;
  /** Virtual window for unbounded feeds - fixed row height, max body height. */
  virtual?: {
    rowHeight?: number;
    maxHeight?: number;
    overscan?: number;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
  };
  /** Day separators in the virtual body: a full-width row before the first data row of each day.
   *  ONLY rendered while the active sort is `key` (any direction), so the caller must sort by the
   *  time column (usually `initialSort`) for separators to appear. `dayOf` returns the local day. */
  groupByDay?: {
    /** The time/day column the separators belong to; the separators require it as the active sort. */
    key: string;
    dayOf: (row: Row) => string | number;
    label: (day: string | number) => ComponentChildren;
    /** ISO value for the row's `<time datetime>` (the label stays human-readable). */
    dateTime?: (day: string | number) => string;
  };
  /** Header icon right of the search: opens this table's full page in a headless popup (the anchor
   *  stays the fallback when the popup is refused). Unsafe hrefs (`javascript:`, `data:`) render
   *  nothing. `name` reuses one popup per table. */
  expand?: { href: string; label?: string; name?: string };
}

/** One item in the virtual body: a data row, or a visual day separator before the first row of a day. */
type BodyItem<Row> =
  | { kind: 'row'; row: Row; dataIndex: number; describedBy?: string; height: number }
  | {
      kind: 'day';
      day: string | number;
      dataIndex: number;
      id: string;
      label: ComponentChildren;
      dateTime?: string;
      height: number;
    };

export function defaultValue<Row>(
  col: TableColumn<Row>,
  row: Row,
): string | number | null | undefined {
  if (col.getValue) return col.getValue(row);
  // Column keys are free-form strings, so the default extractor reads the row
  // dynamically and only accepts primitives it can display.
  const v: unknown = (row as Record<string, unknown>)?.[col.key];
  if (v == null) return v;
  if (typeof v === 'string' || typeof v === 'number') return v;
  return null;
}

/**
 * The header row, shared: the virtual body renders it in a separate `<table>` outside the scroller
 * (so the scrollbar gutter can be padded), the plain body inside its own.
 */
function HeadRow<Row>({
  columns,
  sortKey,
  sortDir,
  onToggle,
  compact,
}: {
  compact?: boolean;
  columns: TableColumn<Row>[];
  sortKey: string | null;
  sortDir: SortDir;
  onToggle: (key: string) => void;
}) {
  return (
    <tr className={DATA_TABLE_HEADER}>
      {columns.map((col) => {
        const active = sortKey === col.key && sortDir !== null;
        return (
          <th
            key={col.key}
            scope="col"
            style={col.width != null ? { width: col.width } : undefined}
            className={cn(
              TABLE_HEAD_CELL,
              compact && 'px-2 py-1 text-2xs',
              alignCls(col.align),
              col.sortable && TABLE_HEAD_SORTABLE,
            )}
            aria-sort={
              col.sortable
                ? active
                  ? sortDir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                : undefined
            }
          >
            <span
              className={cn(
                'inline-flex items-center gap-1',
                col.align === 'right' && 'flex-row-reverse',
              )}
            >
              {col.sortable ? (
                <SortHeader
                  label={col.label}
                  sortKey={col.key}
                  active={active}
                  dir={active ? sortDir : null}
                  onToggle={onToggle}
                  align={col.align === 'right' ? 'right' : 'left'}
                />
              ) : (
                col.label
              )}
              {/* Outside the sort target: the header sorts on click and the hint pins on click,
                  and the ⓘ stops the event so one gesture cannot do both. */}
              {col.hint && (
                <InfoTip
                  label={col.hint.label}
                  content={col.hint.content}
                  maxWidth="20rem"
                  iconClassName="w-3 h-3"
                />
              )}
            </span>
          </th>
        );
      })}
    </tr>
  );
}

/** The `<td>`s of one desktop row. `dense` is the virtual body, whose fixed row height carries
 *  the vertical rhythm the cell padding carries everywhere else. */
function BodyCells<Row>({
  columns,
  row,
  dense,
  compact,
}: { columns: TableColumn<Row>[]; row: Row; dense?: boolean; compact?: boolean }) {
  return (
    <>
      {columns.map((col) => (
        <td
          key={col.key}
          className={cn(
            TABLE_CELL,
            dense ? 'py-0' : 'py-1.5',
            compact && (dense ? 'px-2' : 'px-2 py-1'),
            alignCls(col.align),
            col.className,
          )}
        >
          {col.render ? col.render(row) : (defaultValue(col, row) ?? '')}
        </td>
      ))}
    </>
  );
}

/** Virtual-window spacer: the rows outside the window, as one blank tr of their summed height.
 *  Carries no rule of its own - it is padding, not a row. */
function SpacerRow({ height, cols }: { height: number; cols: number }) {
  return (
    <tr aria-hidden style={{ height }}>
      <td colSpan={cols} className="border-b-0 p-0" />
    </tr>
  );
}

/** Visual full-width day separator: no header semantics, but its text describes the day's first row. */
function DayRow({
  id,
  label,
  dateTime,
  cols,
}: { id: string; label: ComponentChildren; dateTime?: string; cols: number }) {
  return (
    <tr id={id} aria-hidden="true" style={{ height: DAY_ROW_H }}>
      <td
        colSpan={cols}
        className="bg-bg-2 px-3 text-left align-middle text-2xs font-normal uppercase tracking-wide text-fg-3"
      >
        {dateTime ? <time dateTime={dateTime}>{label}</time> : <span>{label}</span>}
      </td>
    </tr>
  );
}

export function Table<Row>({
  columns,
  data,
  variant = 'default',
  className,
  rowProps,
  title,
  meta,
  resetKey,
  searchPlaceholder = 'Search...',
  searchable = true,
  onRowClick,
  onSelect,
  selectedKey = null,
  noHeader = false,
  frame,
  rowKey,
  pinned,
  emptyMessage = 'No results',
  initialSort,
  rowClassName,
  maxHeight,
  scrollX = false,
  virtual,
  groupByDay,
  expand,
  loading = false,
  loadingTitle = 'Loading',
}: TableProps<Row>) {
  const compact = variant === 'compact';
  // Inside a framed Panel the container draws the one border: flush unless the caller says.
  const framed = frame ?? !useContext(InFrame);
  const desktop = cn(compact && 'min-h-0 flex flex-col flex-1', PHONE);
  const [query, setQuery] = useState('');
  const { sortKey, sortDir, toggleSort } = useTableSort(initialSort);
  // Virtual window - only when virtual prop set
  const isVirtual = !!virtual;
  const rowH = virtual?.rowHeight ?? (compact ? COMPACT_ROW_H : VIRTUAL_ROW_H);
  const MAX_BODY_H = virtual?.maxHeight ?? 420;
  const [scrollTop, setScrollTop] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLTableElement>(null);
  const [colW, setColW] = useState<number[]>([]);
  // Scrollbar-gutter alignment: the body reserves the scrollbar width
  // ([scrollbar-gutter:stable]) whether or not it overflows; the header lives
  // OUTSIDE the scroller, so it pads itself by the same measured amount and
  // right-aligned headers stay over their amounts instead of drifting left.
  const [sbGutter, setSbGutter] = useState(0);
  const pageRef = useRef(false);
  // A new data source/segment opens the list at the top: query, scroll offset, the DOM's own
  // scroll position and the load-more latch all reset together. The previous key is also held so
  // THIS render already windows from 0 instead of painting the new list at the old offset.
  const resetRef = useRef(resetKey);
  const resetChanged = resetRef.current !== resetKey;
  const viewScrollTop = resetChanged ? 0 : scrollTop;
  useEffect(() => {
    resetRef.current = resetKey;
    setQuery('');
    setScrollTop(0);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    pageRef.current = false;
  }, [resetKey]);
  useEffect(() => {
    if (!virtual?.loadingMore) pageRef.current = false;
  }, [virtual?.loadingMore]);
  useEffect(() => {
    if (!isVirtual) return;
    const sync = () => {
      const body = bodyRef.current;
      if (body) setSbGutter(body.offsetWidth - body.clientWidth);
      const ths = headRef.current?.querySelectorAll('th');
      if (!ths?.length) return;
      setColW(Array.from(ths).map((th) => (th as HTMLElement).offsetWidth));
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [isVirtual, columns]);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    const searchCols = columns.filter((c) => c.search !== false);
    return data.filter((row) =>
      searchCols.some((c) => {
        const v = defaultValue(c, row);
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      }),
    );
  }, [data, query, columns]);

  const sorted = useMemo(() => {
    const col = sortKey ? columns.find((c) => c.key === sortKey) : undefined;
    if (!col) return filtered;
    return compareSorted(filtered, (row) => defaultValue(col, row), sortDir);
  }, [filtered, sortKey, sortDir, columns]);

  // Separators only while the time column is the ACTIVE sort; no sort (or another column) is plain.
  const { dayOf, label: dayLabel, dateTime } = groupByDay ?? {};
  const grouping =
    !!groupByDay && !!sortKey && sortKey === groupByDay.key && sortDir != null;
  // Callbacks are read through refs so an inline `groupByDay` object (new every parent render)
  // does not invalidate the whole prefix-sum walk.
  const dayOfRef = useRef(dayOf);
  const dayLabelRef = useRef(dayLabel);
  const dateTimeRef = useRef(dateTime);
  dayOfRef.current = dayOf;
  dayLabelRef.current = dayLabel;
  dateTimeRef.current = dateTime;
  const uid = useId();
  // The virtual body's items and their prefix sums. Data rows keep `dataIndex` into `sorted`
  // (rowKey and selection must see that index, never the flattened one); day rows are extra
  // items of DAY_ROW_H. A day row's id is what `aria-describedby` on its first data row points to.
  const body = useMemo(() => {
    const items: BodyItem<Row>[] = [];
    const of = dayOfRef.current;
    const labelOf = dayLabelRef.current;
    const timeOf = dateTimeRef.current;
    let prev: string | number | undefined;
    sorted.forEach((row, dataIndex) => {
      let describedBy: string | undefined;
      if (grouping && of && labelOf) {
        const day = of(row);
        if (dataIndex === 0 || day !== prev) {
          const id = `${uid}-day-${dataIndex}`;
          describedBy = id;
          items.push({
            kind: 'day',
            day,
            dataIndex,
            id,
            label: labelOf(day),
            dateTime: timeOf?.(day),
            height: DAY_ROW_H,
          });
        }
        prev = day;
      }
      items.push({ kind: 'row', row, dataIndex, describedBy, height: rowH });
    });
    const dataBefore = new Int32Array(items.length + 1);
    for (let i = 0; i < items.length; i++) {
      dataBefore[i + 1] = dataBefore[i]! + (items[i]!.kind === 'row' ? 1 : 0);
    }
    return {
      items,
      offsets: itemOffsets(items.map((item) => item.height)),
      dataBefore,
      dataRows: dataBefore[items.length]!,
    };
  }, [sorted, groupByDay?.key, rowH, grouping, uid]);

  const selectable = !!onSelect;
  // Roving tabindex: the selected row is the tab stop, else the first row.
  const anchorKey =
    selectedKey != null && sorted.some((r, i) => rowKey(r, i) === selectedKey)
      ? selectedKey
      : sorted.length
        ? rowKey(sorted[0]!, 0)
        : null;
  const selProps = (row: Row, key: string) =>
    selectable
      ? ({
          'data-row': '',
          tabIndex: key === anchorKey ? 0 : -1,
          'aria-selected': key === selectedKey,
          onKeyDown: (e: KeyboardEvent) => {
            const el = e.currentTarget as HTMLElement;
            if (e.target !== el) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(row, key);
              return;
            }
            const rows = Array.from(el.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-row]') ?? []);
            const to = rowNavTarget(e.key, rows.indexOf(el), rows.length);
            if (to != null) {
              e.preventDefault();
              rows[to]?.focus();
            }
          },
        } as const)
      : {};
  const pick = (row: Row, key: string) => {
    onSelect?.(row, key);
    onRowClick?.(row);
  };
  const tableRole = selectable ? ({ role: 'grid', 'aria-label': title } as const) : {};

  const head = (
    <HeadRow
      columns={columns}
      sortKey={sortKey}
      sortDir={sortDir}
      onToggle={toggleSort}
      compact={compact}
    />
  );

  // Search lives in the table's own header row (borderless, full height), never a box above it.
  const search = searchable && (
    <SearchInput
      variant="header"
      value={query}
      onChange={setQuery}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !query) return;
        e.preventDefault();
        e.stopPropagation(); // a modal around the table keeps its own Escape for the next press
        setQuery('');
      }}
      placeholder={searchPlaceholder}
      ariaLabel={title ? `Search ${title}` : undefined}
      inputProps={query ? ({ 'data-esc-clear': '' } as Partial<InputProps>) : undefined}
      className={title || meta ? 'sm:w-64' : 'flex-1 border-l-0 max-sm:w-auto'}
    />
  );
  // Right of the search, never inside it: a new window is a different view of the same rows,
  // not a search refinement. A real anchor keeps middle-click, Cmd-click and AT; safeHref drops
  // javascript:/data: links (nothing renders at all). A plain left click opens the headless popup
  // the chart expand uses; a refused popup falls through to the anchor.
  const expandHref = expand && safeHref(expand.href);
  const expandButton = expandHref ? (
    <a
      href={expandHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={expand?.label ?? 'Open table in a new window'}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (openPopout(expandHref, expand?.name ?? 'btr-table')) e.preventDefault();
      }}
      className="flex min-h-8 min-w-8 items-center justify-center text-fg-2 transition-colors hover:bg-bg-2 hover:text-fg-0"
    >
      <Icon name="corners-out" className="h-4 w-4" />
    </a>
  ) : undefined;

  return (
    <div className={cn(compact ? 'flex flex-col min-h-0 h-full' : 'space-y-3', className)}>
      <Panel
        // every table wears ONE frame (outer border, radius by nesting, divided rows): its own, or
        // the framed Panel's it sits in
        className={cn('overflow-hidden', !framed && 'rounded-none border-0 bg-transparent shadow-none', compact && 'flex flex-col flex-1 min-h-0')}
      >
        {(title || meta || search || expandHref) && (
          <HeaderBar
            title={title}
            meta={meta}
            search={search || undefined}
            actions={expandButton}
          />
        )}
        {loading ? (
          <DataSpinner label={loadingTitle} className="py-8" />
        ) : isVirtual ? (
          (() => {
            const win = virtualWindow(
              viewScrollTop,
              MAX_BODY_H,
              body.offsets,
              virtual?.overscan ?? 8,
            );
            const view = body.items.slice(win.start, win.end);
            return (
              <div className={desktop}>
                <table
                  ref={headRef}
                  className={cn(TABLE_BASE, compact && 'text-xs')}
                  style={{ paddingRight: sbGutter }}
                >
                  <thead className={noHeader ? 'sr-only' : undefined}>{head}</thead>
                </table>
                <div
                  ref={bodyRef}
                  className="overflow-y-auto [scrollbar-gutter:stable]"
                  style={{ maxHeight: MAX_BODY_H }}
                  onScroll={(e) => {
                    const el = e.target as HTMLDivElement;
                    setScrollTop(el.scrollTop);
                    const maybe = virtual?.onLoadMore;
                    if (maybe && virtual?.hasMore && !virtual?.loadingMore && !pageRef.current) {
                      const at = itemAt(body.offsets, el.scrollTop + el.clientHeight);
                      if (body.dataRows - body.dataBefore[at]! <= LOAD_MORE_ROWS) {
                        pageRef.current = true;
                        maybe();
                      }
                    }
                  }}
                >
                  <table
                    data-table={variant}
                    {...tableRole}
                    className={cn(TABLE_BASE, 'table-fixed', compact && 'text-xs')}
                  >
                    {colW.length === columns.length && (
                      <colgroup>
                        {colW.map((w, i) => (
                          <col key={columns[i]!.key} style={{ width: `${w}px` }} />
                        ))}
                      </colgroup>
                    )}
                    <tbody>
                      {view.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="p-4">
                            <Empty>{emptyMessage}</Empty>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {win.padTop > 0 && (
                            <SpacerRow height={win.padTop} cols={columns.length} />
                          )}
                          {view.map((item) => {
                            if (item.kind === 'day') {
                              return (
                                <DayRow
                                  key={`day:${item.dataIndex}`}
                                  id={item.id}
                                  label={item.label}
                                  dateTime={item.dateTime}
                                  cols={columns.length}
                                />
                              );
                            }
                            const { row, dataIndex } = item;
                            const key = rowKey(row, dataIndex);
                            return (
                              <tr
                                key={key}
                                {...rowProps?.(row)}
                                {...selProps(row, key)}
                                aria-describedby={item.describedBy}
                                style={{ height: rowH }}
                                className={cn(
                                  TABLE_ROW_BORDER,
                                  DATA_TABLE_ROW,
                                  (rowProps || selectable) && ROW_FOCUS,
                                  (onRowClick || selectable) && 'cursor-pointer',
                                  key === selectedKey && SELECTED_ROW,
                                  rowClassName?.(row),
                                )}
                                onClick={() => pick(row, key)}
                              >
                                <BodyCells columns={columns} row={row} dense compact={compact} />
                              </tr>
                            );
                          })}
                          {win.padBottom > 0 && (
                            <SpacerRow height={win.padBottom} cols={columns.length} />
                          )}
                          {virtual?.hasMore && virtual?.loadingMore && (
                            <tr>
                              <td colSpan={columns.length} className="py-3">
                                <PageState kind="loading" title="Loading more…" className="!py-3" />
                              </td>
                            </tr>
                          )}
                          {virtual?.hasMore === false && (
                            <tr>
                              <td
                                colSpan={columns.length}
                                className="py-2 text-center text-2xs uppercase tracking-wide text-fg-3"
                              >
                                End of activity
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()
        ) : (
          <div className={desktop}>
            <div
              className={cn(
                maxHeight && 'overflow-y-auto [scrollbar-gutter:stable]',
                compact && 'flex-1 overflow-auto min-h-0',
                scrollX && 'overflow-x-auto [&_table]:min-w-max [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap',
              )}
              style={maxHeight ? { maxHeight } : undefined}
            >
              <table data-table={variant} {...tableRole} className={cn(TABLE_BASE, compact && 'text-xs')}>
                <thead className={noHeader ? 'sr-only' : undefined}>{head}</thead>
                <tbody>
                  {pinned?.map((row, idx) => (
                    <tr
                      key={rowKey(row, idx)}
                      {...rowProps?.(row)}
                      className={cn(
                        TABLE_ROW_BORDER,
                        'bg-bg-2 font-semibold',
                        rowProps && ROW_FOCUS,
                        rowClassName?.(row),
                      )}
                    >
                      <BodyCells columns={columns} row={row} compact={compact} />
                    </tr>
                  ))}
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="p-4">
                        <Empty>{emptyMessage}</Empty>
                      </td>
                    </tr>
                  ) : (
                    sorted.map((row, idx) => {
                      const key = rowKey(row, idx);
                      return (
                        <tr
                          key={key}
                          {...rowProps?.(row)}
                          {...selProps(row, key)}
                          className={cn(
                            TABLE_ROW_BORDER,
                            DATA_TABLE_ROW,
                            (rowProps || selectable) && ROW_FOCUS,
                            (onRowClick || selectable) && 'cursor-pointer',
                            key === selectedKey && SELECTED_ROW,
                            rowClassName?.(row),
                          )}
                          onClick={() => pick(row, key)}
                        >
                          <BodyCells columns={columns} row={row} compact={compact} />
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </Panel>
    </div>
  );
}

export { MetricState, type MetricStateProps, type MetricPhase } from './MetricState';
