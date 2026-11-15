// SectionBar: THE top edge of a section, card or table. One fixed-height bar (--ctl-m) of full-height cells
// separated by 1px dividers, the chart toolbar's language (styles/section-bar.css). Slots:
//   title    text or node, start edge (truncates)
//   start    cells after the title            end   cells at the far edge (after a flexible gap)
//   search   built into the bar, `searchSide` 'left' | 'right': the search cell takes the bar's outer corner on that side
// Cells are <SectionBarCell>s: a Button, an icon Button, a SegmentedControl, a modal-select trigger (SelectModal) or
// <SectionBarText> (a count). The bar is the same height with or without title or search. Where the bar sits in a Panel
// or a Table frame the container draws the edges; `standalone` draws its own. Filter cells are modal selects only
// (SelectModal / MultiSelectModal triggers, or a SegmentedControl for 2-3 options): never a Dropdown popover.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Icon } from './Icon';
import { Hairline } from './Loaders';
import { SearchField } from './SearchField';

export interface SectionBarSearch {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Accessible name (default: the placeholder). */
  ariaLabel?: string;
  /** ms before `onChange` fires (see SearchField). */
  debounce?: number;
  /** A search is pending (kit Spinner in the field). */
  busy?: boolean;
}

export interface SectionBarProps {
  title?: ComponentChildren;
  start?: ComponentChildren;
  end?: ComponentChildren;
  search?: SectionBarSearch;
  /** The side the search cell sits on, and so which top corner it rounds. Default 'right'. */
  searchSide?: 'left' | 'right';
  /** Names the toolbar that holds `start` / `end` (required for assistive tech whenever they hold controls). */
  label?: string;
  /** Draw the bar's own top and side edges (no container supplies them). */
  standalone?: boolean;
  /** The section's data is refreshing in the background: the kit `Hairline` sweeps along the bar's top edge. */
  refreshing?: boolean;
  className?: string;
}

/** One cell of the bar: full height, divided from its neighbour. `pad` for plain content, `flush` for controls that fill the cell. */
export function SectionBarCell({ children, pad = false, className }: { children?: ComponentChildren; pad?: boolean; className?: string }) {
  return <div className={cn('sb-cell', pad && 'sb-pad', className)}>{children}</div>;
}

/** Count / meta text cell (not a control). */
export function SectionBarText({ children, className }: { children?: ComponentChildren; className?: string }) {
  return <div className={cn('sb-cell sb-text text-xs text-fg-2', className)}>{children}</div>;
}

export function SectionBar({ title, start, end, search, searchSide = 'right', label, standalone = false, refreshing = false, className }: SectionBarProps) {
  const [open, setOpen] = useState(false); // phone only: the collapsed icon cell is expanded over the bar
  const input = useRef<HTMLInputElement>(null);
  const cell = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  // Edge fade (`seg-fade`): `data-l` / `data-r` mark the edge that still has cells beyond it (abs: scrollLeft is negative in RTL).
  useEffect(() => {
    const c = scroller.current;
    if (!c) return;
    const edges = () => {
      const x = Math.abs(c.scrollLeft), over = c.scrollWidth - c.clientWidth > 2;
      c.toggleAttribute('data-l', over && x > 1);
      c.toggleAttribute('data-r', over && x + c.clientWidth < c.scrollWidth - 1);
    };
    edges();
    c.addEventListener('scroll', edges, { passive: true });
    const ro = new ResizeObserver(edges);
    ro.observe(c);
    return () => {
      c.removeEventListener('scroll', edges);
      ro.disconnect();
    };
  }, []);

  const hasControls = start != null || end != null;
  const searchCell = search && (
    <div
      ref={cell}
      role="search"
      aria-label={search.ariaLabel ?? search.placeholder ?? 'Search'}
      className="sb-cell sb-search"
      data-side={searchSide}
      data-open={open || undefined}
      onFocusOut={() => {
        // Collapse again once focus has left an empty field (a typed query keeps it open). Deferred: the icon button
        // that opened the field hides itself and drops focus for a tick before the input takes it.
        setTimeout(() => {
          if (!cell.current?.contains(document.activeElement) && !search.value) setOpen(false);
        });
      }}
    >
      <Button type="button" variant="ghost" size="sm" className="sb-search-btn" aria-label={search.ariaLabel ?? search.placeholder ?? 'Search'} aria-expanded={open} aria-pressed={!!search.value} onClick={() => setOpen(true)} leftIcon={<Icon name="magnifying-glass" className="h-4 w-4" />} />
      <SearchField variant="bar" value={search.value} onChange={search.onChange} placeholder={search.placeholder} ariaLabel={search.ariaLabel} debounce={search.debounce} busy={search.busy} inputRef={input} />
    </div>
  );

  return (
    <div className={cn('section-bar', className)} data-standalone={standalone || undefined} data-search-side={search ? searchSide : undefined}>
      <Hairline active={refreshing} />
      {searchSide === 'left' && searchCell}
      {title != null && (
        <h2 className="sb-cell sb-title text-sm font-semibold text-fg-0">
          <span className="min-w-0 truncate">{title}</span>
        </h2>
      )}
      <div ref={scroller} className="sb-scroll seg-fade" role={hasControls ? 'toolbar' : undefined} aria-label={hasControls ? label : undefined}>
        {start}
        <span className="sb-fill" aria-hidden="true" />
        {end}
      </div>
      {searchSide === 'right' && searchCell}
    </div>
  );
}
