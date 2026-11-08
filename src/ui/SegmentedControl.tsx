// Generic segmented control - ONE tab idiom across the app (swap Atomic/Intent, the metrics
// section switch, any binary/n-ary mode switch). Squared like every other control: BORDER_RADIUS,
// no pills. The selected tab is exactly the navbar-active look (bg-bg-primary + text-primary, see
// Button's navActive variant). Supports per-option disable + tooltip.

import { BORDER_RADIUS } from '../lib/design';
import { haptic } from '../lib/haptic';
import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ComponentChildren;
  disabled?: boolean;
  title?: string;
  /** Link mode: the tab is a real anchor (middle-click, new tab, copy link); a plain click still calls `onChange`. */
  href?: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** compact size for inline use (e.g. swap mode row) */
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const pad =
    size === 'sm'
      ? 'px-2.5 py-1 text-xs touch:min-h-11'
      : 'px-3 py-1.5 text-sm touch:min-h-[var(--ctl-m)]';

  // Scrolls when the tabs outrun the row (6 admin tabs at 360dp): `seg-fade` masks whichever edge
  // still has content, and the active tab is centred.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const edges = () => {
      c.toggleAttribute('data-l', c.scrollLeft > 1);
      c.toggleAttribute('data-r', c.scrollLeft + c.clientWidth < c.scrollWidth - 1);
    };
    const t = c.querySelector<HTMLElement>('[aria-selected="true"]');
    if (t) c.scrollLeft = t.offsetLeft - (c.clientWidth - t.offsetWidth) / 2;
    edges();
    c.addEventListener('scroll', edges, { passive: true });
    const ro = new ResizeObserver(edges);
    ro.observe(c);
    return () => {
      c.removeEventListener('scroll', edges);
      ro.disconnect();
    };
  }, [value]);

  const step = (dir: 1 | -1) => {
    const on = options.filter((o) => !o.disabled);
    const next = on[(on.findIndex((o) => o.value === value) + dir + on.length) % on.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      ref={ref}
      role="tablist"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        step(e.key === 'ArrowRight' ? 1 : -1);
        queueMicrotask(() =>
          ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus(),
        );
      }}
      className={cn(
        'seg-fade relative inline-flex max-w-full snap-x items-center scroll-x bg-bg-2 p-0.5 border border-border',
        BORDER_RADIUS,
        className,
      )}
    >
      {options.map((opt) => {
        const cls = cn(
          pad,
          'shrink-0 snap-center whitespace-nowrap font-semibold transition-colors focus-visible:outline-offset-[-2px]',
          BORDER_RADIUS,
          // Selected = navbar-active look, identical to Button variant="navActive".
          value === opt.value ? 'bg-bg-primary text-primary' : 'text-fg-2 hover:text-fg-0',
          opt.disabled && 'opacity-50 cursor-not-allowed hover:text-fg-2',
        );
        const pick = () => {
          if (opt.disabled) return;
          if (opt.value !== value) haptic('tap');
          onChange(opt.value);
        };
        if (opt.href && !opt.disabled)
          return (
            <a
              key={opt.value}
              role="tab"
              href={opt.href}
              aria-selected={value === opt.value}
              tabIndex={value === opt.value ? 0 : -1}
              title={opt.title}
              className={cn(cls, 'inline-flex items-center')}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
                e.preventDefault();
                pick();
              }}
            >
              {opt.label}
            </a>
          );
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={value === opt.value}
            tabIndex={value === opt.value ? 0 : -1}
            disabled={opt.disabled}
            title={opt.title}
            className={cls}
            onClick={pick}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
