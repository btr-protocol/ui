import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { cn } from '../lib/cn';
import { FloatingPanel } from './FloatingPanel';
import type { Position } from '../lib/positioning';

export interface ClickMenuItem {
  id: string;
  label: ComponentChildren;
  onSelect?: () => void;
  /** Renders an anchor instead of a button. */
  href?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

const ITEMS = '[role="menuitem"]:not(:disabled)';

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
  const row = (it: ClickMenuItem) => cn('flex min-h-10 touch:min-h-11 w-full items-center px-3 text-left text-sm hover:bg-bg-2 disabled:opacity-50', it.tone === 'danger' ? 'text-red' : 'text-fg-0');
  return (
    <FloatingPanel
      mode="click"
      side={side}
      interactive
      arrow={false}
      content={
        <div role="menu" ref={mount} onKeyDown={onKeyDown} className="flex min-w-44 flex-col py-1">
          {items.map((it) =>
            it.href ? (
              <a key={it.id} role="menuitem" href={it.href} className={row(it)}>{it.label}</a>
            ) : (
              <button key={it.id} type="button" role="menuitem" disabled={it.disabled} className={row(it)} onClick={it.onSelect}>{it.label}</button>
            ),
          )}
        </div>
      }
    >
      {trigger}
    </FloatingPanel>
  );
}
