import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

export interface StripTab {
  id: string;
  label: ComponentChildren;
  /** Full text on hover (raw id behind a short label). */
  title?: string;
  pinned?: boolean;
  /** false: a fixed tab (an Overview / home tab) with no close button. */
  closable?: boolean;
}

export interface TabStripProps {
  tabs: readonly StripTab[];
  active: string | null;
  onSelect: (id: string) => void;
  onClose?: (id: string) => void;
  /** Pin / unpin a tab: pinned tabs stay first and show a pin instead of a close button until hovered. */
  onPin?: (id: string) => void;
  /** Drag-to-reorder: called with the new id order (pinned and unpinned tabs reorder inside their own group). */
  onReorder?: (ids: string[]) => void;
  className?: string;
  label?: string;
}

/** Move `id` to the slot of `over`, inside the pinned / unpinned group of `over`; pinned tabs stay first. */
export function reorderTabs(tabs: readonly StripTab[], id: string, over: string): string[] {
  const from = tabs.find((t) => t.id === id);
  const to = tabs.find((t) => t.id === over);
  if (!from || !to || id === over || !!from.pinned !== !!to.pinned) return tabs.map((t) => t.id);
  const ids = tabs.map((t) => t.id).filter((x) => x !== id);
  ids.splice(ids.indexOf(over) + (tabs.findIndex((t) => t.id === id) < tabs.findIndex((t) => t.id === over) ? 1 : 0), 0, id);
  return ids;
}

/** Tab to focus for an arrow / Home / End key from index `i` of `n` (wraps); null for any other key. */
export function tabKeyTarget(key: string, i: number, n: number): number | null {
  if (n < 1) return null;
  if (key === 'ArrowRight') return (i + 1) % n;
  if (key === 'ArrowLeft') return (i - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return null;
}

/** Closable, pinnable, drag-reorderable tab strip (a comparison set, open documents), Chrome-like: the selected tab is the content's surface
 *  (no rule under it, primary top edge) and the strip's rule runs under the others. Bar height = the search header row (3rem + its rule).
 *  Roving tabindex: the active tab (else the first) is the strip's one tab stop, arrows / Home / End move focus, Enter / Space select.
 *  Delete / Backspace closes the focused tab and P toggles its pin (so a non-active tab needs no extra tab stops).
 *  Pin and close are sibling buttons of the tab (never inside role=tab) and are tab stops only on the roving tab. */
export function TabStrip({ tabs, active, onSelect, onClose, onPin, onReorder, className, label = 'Tabs' }: TabStripProps) {
  const [drag, setDrag] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const ordered = [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)];
  const stop = ordered.some((t) => t.id === active) ? active : ordered[0]?.id;
  return (
    <div ref={list} role="tablist" aria-label={label} className={cn('scroll-x flex h-[calc(3rem+1px)] items-end gap-0.5 border-b border-border bg-bg-0 px-2', className)}>
      {ordered.map((t, i) => {
        const roving = t.id === stop;
        return (
          <div
            key={t.id}
            draggable={!!onReorder}
            onDragStart={() => setDrag(t.id)}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => drag && e.preventDefault()}
            onDrop={() => {
              if (drag && onReorder) onReorder(reorderTabs(ordered, drag, t.id));
              setDrag(null);
            }}
            className={cn(
              'group flex h-9 shrink-0 select-none items-center gap-1 rounded-t-md border border-b-0 pr-1.5 text-xs font-medium transition-colors',
              t.id === active ? '-mb-px h-[37px] border-border border-t-2 border-t-primary bg-bg-1 text-fg-0' : 'border-transparent text-fg-2 hover:bg-bg-2 hover:text-fg-0',
              drag === t.id && 'opacity-50',
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={t.id === active}
              tabIndex={roving ? 0 : -1}
              title={t.title}
              onClick={() => onSelect(t.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return; // a key typed in a control inside the tab is not a tab command
                const tabEls = list.current?.querySelectorAll<HTMLElement>('[role=tab]');
                // Delete / Backspace closes the focused tab, P toggles its pin: the pin / close buttons are tab stops of the roving tab only.
                if ((e.key === 'Delete' || e.key === 'Backspace') && onClose && !t.pinned && t.closable !== false) {
                  e.preventDefault();
                  (tabEls?.[i + 1] ?? tabEls?.[i - 1])?.focus();
                  onClose(t.id);
                  return;
                }
                if ((e.key === 'p' || e.key === 'P') && onPin && t.closable !== false && !e.ctrlKey && !e.metaKey && !e.altKey) {
                  e.preventDefault();
                  onPin(t.id);
                  return;
                }
                const to = tabKeyTarget(e.key, i, ordered.length);
                if (to == null) return;
                e.preventDefault();
                tabEls?.[to]?.focus();
              }}
              className="h-full max-w-[12rem] cursor-pointer truncate rounded-sm pl-3 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.label}
            </button>
            {onPin && t.closable !== false && (
              <button type="button" tabIndex={roving ? 0 : -1} aria-label={t.pinned ? 'Unpin' : 'Pin'} aria-pressed={!!t.pinned} onClick={() => onPin(t.id)} className={cn('inline-flex h-5 w-5 items-center justify-center rounded-xs hover:bg-bg-4 focus-visible:opacity-100', !t.pinned && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 coarse:opacity-100')}>
                <Icon name="pin" className={cn('h-3.5 w-3.5', t.pinned && 'text-primary')} />
              </button>
            )}
            {onClose && !t.pinned && t.closable !== false && (
              <button type="button" tabIndex={roving ? 0 : -1} aria-label="Close" onClick={() => onClose(t.id)} className="inline-flex h-5 w-5 items-center justify-center rounded-xs hover:bg-bg-4">
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
