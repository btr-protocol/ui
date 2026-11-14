import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { cn } from '../lib/cn';
import { FloatingPanel } from './FloatingPanel';
import { SelectedCheck } from './SelectedCheck';
import type { Position } from '../lib/positioning';

export interface ClickMenuItem {
  id: string;
  label: ComponentChildren;
  onSelect?: () => void;
  /** Renders an anchor instead of a button. */
  href?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** The current choice: the row gets the kit's trailing `SelectedCheck` (and `menuitemradio` / `aria-checked`). Leave undefined for plain actions. */
  selected?: boolean;
}

const ITEMS = '[role^="menuitem"]:not(:disabled)';

/** A small action menu opened by CLICK (the kit Popover is hover on desktop, which is wrong for a menu): rows are 40px, 44px on touch.
 *  Keyboard (ARIA menu): focus lands on the first item on open, ArrowUp/Down rove (wrap), Home/End jump,
 *  and when the menu closes (Esc, pick) focus returns to the element that opened it. */
export function ClickMenu({ trigger, items, side = 'top' }: { trigger: ComponentChildren; items: readonly ClickMenuItem[]; side?: Position }) {
  const opener = useRef<HTMLElement | null>(null);
  // Panel mounts on open, unmounts on close: remember the opener, focus the first item, hand focus back on close.
  const mount = (el: HTMLDivElement | null) => {
    if (el) {
      opener.current = document.activeElement as HTMLElement | null;
      el.querySelector<HTMLElement>(ITEMS)?.focus();
    } else if (!document.activeElement || document.activeElement === document.body) opener.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const list = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(ITEMS));
    const at = list.indexOf(document.activeElement as HTMLElement);
    const to = e.key === 'ArrowDown' ? (at + 1) % list.length : e.key === 'ArrowUp' ? (at - 1 + list.length) % list.length : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1;
    if (to < 0 || !list.length) return;
    e.preventDefault();
    list[to]!.focus();
  };
  const row = (it: ClickMenuItem) => cn('flex min-h-10 touch:min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-bg-2 disabled:opacity-50', it.tone === 'danger' ? 'text-red' : 'text-fg-0');
  const body = (it: ClickMenuItem) => (it.selected === undefined ? it.label : <><span className="min-w-0 flex-1 truncate">{it.label}</span>{it.selected && <SelectedCheck />}</>);
  return (
    <FloatingPanel
      mode="click"
      side={side}
      interactive
      flush
      arrow={false}
      content={
        <div role="menu" ref={mount} onKeyDown={onKeyDown} className="flex min-w-44 flex-col">
          {items.map((it) =>
            it.href ? (
              <a key={it.id} role="menuitem" href={it.href} className={row(it)}>{body(it)}</a>
            ) : (
              <button key={it.id} type="button" role={it.selected === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={it.selected} disabled={it.disabled} className={row(it)} onClick={it.onSelect}>{body(it)}</button>
            ),
          )}
        </div>
      }
    >
      {trigger}
    </FloatingPanel>
  );
}
