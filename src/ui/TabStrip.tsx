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

/** Closable, pinnable, drag-reorderable tab strip (a comparison set, open documents). Selected tab = the navbar-active look.
 *  Roving tabindex: the active tab (else the first) is the strip's one tab stop, arrows / Home / End move focus, Enter / Space select.
 *  Pin and close are sibling buttons of the tab (never inside role=tab) and are tab stops only on the roving tab. */
export function TabStrip({ tabs, active, onSelect, onClose, onPin, onReorder, className, label = 'Tabs' }: TabStripProps) {
  const [drag, setDrag] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const ordered = [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)];
  const stop = ordered.some((t) => t.id === active) ? active : ordered[0]?.id;
  return (
    <div ref={list} role="tablist" aria-label={label} className={cn('scroll-x flex items-stretch gap-1 border-b border-border px-2 py-1.5', className)}>
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
              'group flex h-8 shrink-0 select-none items-center gap-1 rounded-sm pr-1.5 text-xs font-medium transition-colors',
              t.id === active ? 'bg-bg-primary text-primary' : 'text-fg-1 hover:bg-bg-3',
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
                const to = tabKeyTarget(e.key, i, ordered.length);
                if (to == null) return;
                e.preventDefault();
                list.current?.querySelectorAll<HTMLElement>('[role=tab]')[to]?.focus();
              }}
              className="h-full max-w-[12rem] cursor-pointer truncate rounded-sm pl-2.5 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.label}
            </button>
            {onPin && (
              <button type="button" tabIndex={roving ? 0 : -1} aria-label={t.pinned ? 'Unpin' : 'Pin'} aria-pressed={!!t.pinned} onClick={() => onPin(t.id)} className={cn('inline-flex h-5 w-5 items-center justify-center rounded-xs hover:bg-bg-4 focus-visible:opacity-100', !t.pinned && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 coarse:opacity-100')}>
                <Icon name="pin" className={cn('h-3.5 w-3.5', t.pinned && 'text-primary')} />
              </button>
            )}
            {onClose && !t.pinned && (
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
