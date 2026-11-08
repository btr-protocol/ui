// Canonical Table: sortable headers, search, virtual window, mobile card stack. Family contract
// with Panel/ChartShell: `title` + `meta` header, `loading`, empty as `emptyMessage`. Sort is ONE
// cycle (asc, desc, off) via useTableSort; SortHeader is the only sort control, `<th>` only
// carries aria-sort.

import { SEVERITY_ICON } from '../lib/severity';
import { virtualWindow } from '../lib/virtualWindow';
import { Empty, PageState } from './Feedback';
import { Tooltip } from './FloatingPanel';
import { DASH, type MetricPhase } from '../lib/metricPhase';
import { cn } from '../lib/cn';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon, type IconName } from './Icon';
import { InfoBox } from './InfoBox';
import { Panel, PanelHeader, PanelTitle } from './Panel';
import { SearchInput } from './SearchInput';

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
/** Selected row of a `selectable` table: the same surface as the detail pane it opens (bg-1, so it
 *  fuses into it when the list sits on bg-0), a primary bar on the left and bold text, so the
 *  state is never colour alone. */
export const SELECTED_ROW =
  'bg-bg-1 hover:bg-bg-1 font-semibold shadow-[inset_3px_0_0_var(--primary)]';

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

/**
 * THE table geometry, named once. Every table in the app - the semantic `<Table>` below and the
 * grid tables that cannot use it (PoolsPage) - reads these instead of re-typing the strings, so
 * a padding or a divider changes in ONE place and cannot drift between two tables, between the
 * virtual and non-virtual bodies, or between desktop and the mobile stack.
 */
/** Header cell: sticky so a scrolled body keeps its labels. */
const TABLE_HEAD_CELL = 'px-3 py-1.5 coarse:py-3 font-medium bg-bg-3 sticky top-0 z-[1]';
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
/** Mobile stack: a row becomes a card of label/value lines. */
const MOBILE_ROW = 'px-3 py-2 space-y-1';
const MOBILE_ROW_TAP = 'cursor-pointer hover:bg-bg-2';
const MOBILE_LINE = 'flex items-start justify-between gap-3 text-sm';
const MOBILE_LABEL = 'text-xs text-fg-3 shrink-0';
const MOBILE_VALUE = 'text-right min-w-0 flex-1 flex justify-end';
/** Where the table turns into a stack: the desktop body shows from the breakpoint up, the stack
 *  (and its phone sort chips) below it. Literal classes, so Tailwind sees them. */
const STACK = {
  md: { desktop: 'hidden md:block', mobile: 'md:hidden' },
  lg: { desktop: 'hidden lg:block', mobile: 'lg:hidden' },
} as const;
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
  searchPlaceholder?: string;
  searchable?: boolean;
  onRowClick?: (row: Row) => void;
  /** Makes rows selectable (master list): click / Enter / Space call it; ArrowUp/Down/Home/End move
   *  focus (roving tabindex); the row carries `aria-selected` and the `SELECTED_ROW` style. */
  onSelect?: (row: Row, key: string) => void;
  /** `rowKey` of the selected row, or null. */
  selectedKey?: string | null;
  /** No frame, radius or fill: the table sits flush in a pane (MasterDetail master); the column header is visually hidden, kept for screen readers. */
  bare?: boolean;
  rowKey: (row: Row, idx: number) => string;
  /** Rows held above the body: never searched, sorted or counted as empty (aggregates that frame
   *  the rows beneath them). Plain desktop table only: the virtual body and the mobile stack
   *  ignore it. */
  pinned?: Row[];
  emptyMessage?: string;
  initialSort?: { key: string; dir: SortDir };
  /** The row as a card in the stack below `stackBelow`. Desktop keeps the columns; without it the
   *  stack is label/value lines. */
  renderCard?: (row: Row) => JSX.Element;
  /** Breakpoint under which rows stack as cards. Tables past ~6 columns need `lg`. */
  stackBelow?: 'md' | 'lg';
  /**
   * Optional per-row class on the desktop `<tr>` and the mobile stack card - used to
   * grey out rows whose underlying market is closed. Return `undefined` for no override.
   */
  rowClassName?: (row: Row) => string | undefined;
  /** Full-body load: overlay the table, never a caption in the toolbar. */
  loading?: boolean;
  loadingTitle?: string;
  /** Cap the (non-virtual) body height in px and scroll within it; the sticky
   *  header stays pinned. For bounded feeds where virtualization is overkill. */
  maxHeight?: number;
  /** Virtual window for unbounded feeds - fixed row height, max body height. */
  virtual?: {
    rowHeight?: number;
    maxHeight?: number;
    overscan?: number;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
  };
}

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
                <InfoBox
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

/** One row of the mobile stack: every column becomes a label/value line. */
function MobileCells<Row>({ columns, row }: { columns: TableColumn<Row>[]; row: Row }) {
  return (
    <>
      {columns.map((col) => (
        <div key={col.key} className={MOBILE_LINE}>
          <span className={MOBILE_LABEL}>{col.label}</span>
          <div className={MOBILE_VALUE}>
            {col.render ? col.render(row) : (defaultValue(col, row) ?? '')}
          </div>
        </div>
      ))}
    </>
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
  searchPlaceholder = 'Search...',
  searchable = true,
  onRowClick,
  onSelect,
  selectedKey = null,
  bare = false,
  rowKey,
  pinned,
  emptyMessage = 'No results',
  initialSort,
  renderCard,
  stackBelow = 'md',
  rowClassName,
  maxHeight,
  virtual,
  loading = false,
  loadingTitle = 'Loading…',
}: TableProps<Row>) {
  const compact = variant === 'compact';
  const desktop = compact ? 'min-h-0 flex flex-col flex-1' : STACK[stackBelow].desktop;
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
  const [mobileLimit, setMobileLimit] = useState(50);
  const pageRef = useRef(false);
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

  const sortable = columns.filter((c) => c.sortable);
  const head = (
    <HeadRow
      columns={columns}
      sortKey={sortKey}
      sortDir={sortDir}
      onToggle={toggleSort}
      compact={compact}
    />
  );

  const search = searchable && (
    <SearchInput
      value={query}
      onChange={setQuery}
      placeholder={searchPlaceholder}
      className={title ? 'w-full sm:w-64' : undefined}
    />
  );

  return (
    <div className={cn(compact ? 'flex flex-col min-h-0 h-full' : 'space-y-3', className)}>
      {!title && search}

      <Panel
        variant={bare ? 'plain' : 'default'} // every table wears the frame (outer border + radius, divided rows); only a headerless `bare` list is frameless
        className={cn('overflow-hidden', compact && 'flex flex-col flex-1 min-h-0')}
      >
        {title && (
          <PanelHeader>
            <PanelTitle>{title}</PanelTitle>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {meta}
              {search}
            </div>
          </PanelHeader>
        )}
        {loading ? (
          <div className="py-8">
            <PageState kind="loading" title={loadingTitle} />
          </div>
        ) : isVirtual ? (
          (() => {
            const win = virtualWindow(
              scrollTop,
              MAX_BODY_H,
              sorted.length,
              rowH,
              virtual?.overscan ?? 8,
            );
            const view = sorted.slice(win.start, win.end);
            return (
              <div className={desktop}>
                <table
                  ref={headRef}
                  className={cn(TABLE_BASE, compact && 'text-xs')}
                  style={{ paddingRight: sbGutter }}
                >
                  <thead className={bare ? 'sr-only' : undefined}>{head}</thead>
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
                      const rowsToBottom =
                        (el.scrollHeight - el.scrollTop - el.clientHeight) / rowH;
                      if (rowsToBottom <= 10) {
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
                          {view.map((row, i) => {
                            const idx = win.start + i;
                            const key = rowKey(row, idx);
                            return (
                              <tr
                                key={key}
                                {...rowProps?.(row)}
                                {...selProps(row, key)}
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
                                className="py-2 text-center text-3xs uppercase tracking-wide text-fg-3"
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
              )}
              style={maxHeight ? { maxHeight } : undefined}
            >
              <table data-table={variant} {...tableRole} className={cn(TABLE_BASE, compact && 'text-xs')}>
                <thead className={bare ? 'sr-only' : undefined}>{head}</thead>
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

        {/* Mobile */}
        {!loading && !compact && (
          <div className={cn(STACK[stackBelow].mobile, 'divide-y divide-border')}>
            {sortable.length > 0 && (
              // Sort is a header click on desktop; the stack has no header, so the same
              // `SortHeader` toggles ride here, one per sortable column.
              <div
                role="group"
                aria-label="Sort by"
                className="scroll-x flex items-center gap-3 px-3 py-1 text-xs text-fg-3"
              >
                <span className="shrink-0">Sort</span>
                {sortable.map((c) => (
                  <SortHeader
                    key={c.key}
                    label={c.label}
                    sortKey={c.key}
                    active={sortKey === c.key && sortDir !== null}
                    dir={sortKey === c.key ? sortDir : null}
                    onToggle={toggleSort}
                    align="left"
                    className="shrink-0 py-1.5"
                  />
                ))}
              </div>
            )}
            {sorted.length === 0 ? (
              <div className="p-4">
                <Empty>{emptyMessage}</Empty>
              </div>
            ) : (
              (() => {
                const win = isVirtual
                  ? virtualWindow(
                      scrollTop,
                      MAX_BODY_H,
                      sorted.length,
                      rowH,
                      virtual?.overscan ?? 8,
                    )
                  : null;
                const view = win ? sorted.slice(win.start, win.end) : sorted;
                // One stack, both bodies: the virtual one windows its slice and pages the rest
                // behind a "show more"; the plain one is the whole list at offset 0.
                const shown = win ? view.slice(0, mobileLimit) : view;
                const offset = win?.start ?? 0;
                return (
                  <>
                    {shown.map((row, idx) => {
                      const key = rowKey(row, offset + idx);
                      const { 'aria-selected': sel, ...mobileSel } = selProps(row, key) as {
                        'aria-selected'?: boolean;
                      };
                      return (
                        <div
                          key={key}
                          {...rowProps?.(row)}
                          {...mobileSel}
                          aria-current={sel ? 'true' : undefined}
                          className={cn(
                            MOBILE_ROW,
                            (onRowClick || selectable) && MOBILE_ROW_TAP,
                            selectable && ROW_FOCUS,
                            key === selectedKey && SELECTED_ROW,
                            rowClassName?.(row),
                          )}
                          onClick={() => pick(row, key)}
                        >
                          {renderCard?.(row) ?? <MobileCells columns={columns} row={row} />}
                        </div>
                      );
                    })}
                    {win && view.length > mobileLimit && (
                      <button
                        type="button"
                        className="w-full py-3 text-xs text-fg-2 hover:text-fg-1"
                        onClick={() => setMobileLimit((n) => n + 50)}
                      >
                        Show {Math.min(50, view.length - mobileLimit)} more of{' '}
                        {view.length.toLocaleString('en-US')}
                      </button>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

export type { MetricPhase } from '../lib/metricPhase';

export interface MetricStateProps {
  phase: MetricPhase;
  /** Formatted value. Rendered only when `phase` is 'live'; null falls through to 'empty'. */
  value: string | null | undefined;
  /** Why the number is missing: the fetch failure for 'error', the refusal for 'unfillable'. */
  reason?: string;
  /** What the number is, for the empty tooltip ("No fees booked in this window yet"). */
  emptyHint?: string;
  className?: string;
  /** Skeleton width while loading. */
  skeletonClassName?: string;
}

export function MetricState({
  phase,
  value,
  reason,
  emptyHint,
  className,
  skeletonClassName = 'w-12',
}: MetricStateProps) {
  if (phase === 'loading') {
    return (
      <span
        role="status"
        aria-label="Loading"
        className={cn(
          'inline-block h-3.5 rounded-md bg-bg-3 animate-pulse align-middle',
          skeletonClassName,
          className,
        )}
      />
    );
  }

  if (phase === 'live' && value != null && value !== DASH) {
    return <span className={className}>{value}</span>;
  }

  if (phase === 'error') {
    return (
      <Tooltip
        content={reason ? `Metrics unavailable: ${reason}` : 'Metrics service unreachable'}
        side="bottom"
      >
        <span
          className={cn('inline-flex items-center text-warning', className)}
          aria-label={reason ? `Metrics unavailable: ${reason}` : 'Metrics service unreachable'}
        >
          <Icon name={SEVERITY_ICON.error as IconName} size={11} aria-hidden />
        </span>
      </Tooltip>
    );
  }

  if (phase === 'unfillable') {
    return (
      <Tooltip
        content={reason ?? 'The book cannot fill this size, so no price is quoted.'}
        side="bottom"
      >
        <span
          className={cn('inline-flex items-center text-warning', className)}
          aria-label={reason ?? 'Unfillable'}
        >
          <Icon name="x-circle" size={11} aria-hidden />
        </span>
      </Tooltip>
    );
  }

  // A lagging indexer blocks nothing: a calm dash, never a warning glyph on an informational cell.
  return (
    <Tooltip
      content={
        phase === 'stale'
          ? 'Updating: shown once the next report lands.'
          : (emptyHint ?? 'Not reported for this window yet.')
      }
      side="bottom"
    >
      <span className={cn('text-fg-3', className)}>{DASH}</span>
    </Tooltip>
  );
}
