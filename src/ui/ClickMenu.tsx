import type { ComponentChildren } from 'preact';
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

/** A small action menu opened by CLICK (the kit Popover is hover on desktop, which is wrong for a menu): rows are 40px, 44px on touch. */
export function ClickMenu({ trigger, items, side = 'top' }: { trigger: ComponentChildren; items: readonly ClickMenuItem[]; side?: Position }) {
  const row = (it: ClickMenuItem) => cn('flex min-h-10 touch:min-h-11 w-full items-center px-3 text-left text-sm hover:bg-bg-2 disabled:opacity-50', it.tone === 'danger' ? 'text-red' : 'text-fg-0');
  return (
    <FloatingPanel
      mode="click"
      side={side}
      interactive
      arrow={false}
      content={
        <div role="menu" className="flex min-w-44 flex-col py-1">
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
