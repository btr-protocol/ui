import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

export interface MasterDetailProps {
  /** The list (usually a selectable `<Table noHeader>`). */
  master: ComponentChildren;
  /** The selected item's pane. */
  detail: ComponentChildren;
  /** Something is selected. Below lg this alone switches list -> detail (URL-agnostic: the host
   *  derives it from its route). */
  selected: boolean;
  /** Back button / Esc on the phone detail: the host clears the selection. */
  onBack: () => void;
  backLabel?: string;
  /** Detail pane while nothing is selected (>= lg only). */
  placeholder?: ComponentChildren;
  /** Master column width on lg+ (CSS length). Default clamp(280px, 22%, 360px). */
  masterWidth?: string;
  className?: string;
}

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023.98px)').matches;

/**
 * Master list + detail pane. >= lg: fixed clamp(280px, 22%, 360px) master beside the detail, both
 * visible. < lg: one at a time, list -> detail drill-down with a Back row. Focus: drilling down
 * moves focus to the detail pane, Back restores it to the row last focused in the list.
 * One frame (rounded border) groups both: the master is the full-height left part (give its Table `frame={false}`),
 * separated from the detail by the shared border; the selected row wears the SelectionModal highlight.
 */
export function MasterDetail({
  master,
  detail,
  selected,
  onBack,
  backLabel = 'Back',
  placeholder,
  masterWidth,
  className,
}: MasterDetailProps) {
  const detailRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLDivElement>(null);
  const lastRow = useRef<HTMLElement | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!isPhone()) return;
    if (selected) detailRef.current?.focus();
    else {
      const row = lastRow.current?.isConnected
        ? lastRow.current
        : masterRef.current?.querySelector<HTMLElement>('[aria-selected="true"],[aria-current="true"]');
      row?.focus();
    }
  }, [selected]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-bg-1 lg:grid lg:grid-cols-[var(--md-w,clamp(280px,22%,360px))_minmax(0,1fr)]',
        className,
      )}
      style={masterWidth ? ({ '--md-w': masterWidth } as Record<string, string>) : undefined}
    >
      <div
        ref={masterRef}
        onFocusIn={(e) => {
          lastRow.current = e.target as HTMLElement;
        }}
        className={cn('min-w-0 bg-bg-0 lg:block lg:border-r lg:border-border', selected && 'max-lg:hidden')}
      >
        {master}
      </div>
      <div
        ref={detailRef}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && isPhone()) {
            e.preventDefault();
            onBack();
          }
        }}
        className={cn('min-w-0 bg-bg-1 outline-none', !selected && 'max-lg:hidden')}
      >
        {selected && (
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[var(--ctl-m)] w-full items-center gap-1.5 border-b border-border px-3 text-sm font-medium text-fg-1 hover:bg-bg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:hidden"
          >
            <Icon name="caret-left" className="h-4 w-4" />
            {backLabel}
          </button>
        )}
        {selected ? detail : placeholder}
      </div>
    </div>
  );
}
