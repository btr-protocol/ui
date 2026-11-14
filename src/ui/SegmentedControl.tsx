// The kit's tab selector, built ON ButtonGroup: the tablist IS a `.btn-group` and every tab IS a
// <Button>, so height, line height, padding, radius, border and dividers are the ButtonGroup's by
// construction (one code path, nothing to keep in sync). Tab semantics on top: role=tablist/tab,
// aria-selected, roving tabindex, Arrow/Home/End, aria-controls when a panel exists.
//
// Two presentations from the same component:
//   group     a ButtonGroup with the active segment marked (toolbars: the tabs switch a view in place).
//   attached  browser-style: the strip sits on the top edge of the card the tabs control and the
//             active tab shares the card's surface (styles/button-group.css, `.tabs-*`). Pass the
//             card's content as `children` (rendered as the tabpanel), or `panelId` when the panel is yours.
//
// Overflow: ONE line that scrolls (the active tab is centred, `seg-fade` masks the edge with more).
// A tab strip that wraps would stack the active tab's merge with the card on several rows.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { cn } from '../lib/cn';
import { haptic } from '../lib/haptic';
import { Button } from './Button';
import { PANEL_BODY } from './Panel';
import { tabKeyTarget } from './TabStrip';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ComponentChildren;
  disabled?: boolean;
  title?: string;
  /** Link mode: the tab is a real anchor (middle-click, new tab, copy link); a plain click still calls `onChange`. */
  href?: string;
}

/** A tablist needs a name for assistive tech: `aria-label` or `aria-labelledby` is required. */
export type TablistName = { 'aria-label': string; 'aria-labelledby'?: undefined } | { 'aria-labelledby': string; 'aria-label'?: undefined };

export type SegmentedControlProps<T extends string> = TablistName & {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** `xs`: dense inline rows (Button xs). `sm` and `md` (the default): the standard ButtonGroup height (Button sm). */
  size?: 'xs' | 'sm' | 'md';
  /** Every option as wide as the widest label (toggles that should not jump or look ragged). */
  equal?: boolean;
  /** `group` (default): a plain ButtonGroup. `attached`: the strip sits on the top edge of the card it controls. */
  presentation?: 'group' | 'attached';
  /** attached only: a primary accent on the active tab's top edge (default true; false = flush with the card). */
  accent?: boolean;
  /** `auto` (default): arrows move focus AND select. `manual`: arrows move focus only, Enter / Space selects (for tabs whose change is expensive: a route or a fetch). */
  activation?: 'auto' | 'manual';
  /** The tabpanel's id: the one id `aria-controls` points at. With `children` the built-in panel takes it; without, the panel is yours and must carry it. */
  panelId?: string;
  /** attached only: the card's content (rendered as the tabpanel below the strip, named by the active tab). */
  children?: ComponentChildren;
};

let uid = 0;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  equal = false,
  presentation = 'group',
  accent = true,
  activation = 'auto',
  panelId,
  children,
  'aria-label': label,
  'aria-labelledby': labelledby,
}: SegmentedControlProps<T>) {
  const id = (useRef<string>().current ??= `seg${++uid}`);
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const attached = presentation === 'attached';
  const hasPanel = attached && children != null;
  const controls = panelId ?? (hasPanel ? `${id}-panel` : undefined); // ONE id: the built-in panel carries exactly it
  const panel = useRef<HTMLDivElement>(null);
  const btnSize = size === 'xs' ? 'xs' : 'sm';
  const on = options.filter((o) => !o.disabled);
  // Roving tabindex: the selected tab is the one tab stop (else the first enabled one).
  const stop = on.some((o) => o.value === value) ? value : on[0]?.value;

  // Scrolls when the tabs outrun the row (6 admin tabs at 360dp): `seg-fade` masks whichever edge
  // still has content, and the active tab is centred.
  useEffect(() => {
    const c = scroller.current;
    if (!c) return;
    // `data-l` / `data-r` = the start / end edge (physical in LTR, mirrored in RTL: scrollLeft is negative there, hence abs).
    // A strip that lacks <= 2 px is fitted, not scrolled: that is its own two 1px borders (a container 1-2 px short of a
    // shrink-wrapped group, or sub-pixel rounding of scrollWidth / clientWidth), and no label is hidden by it.
    const slack = 2;
    const overflows = () => c.scrollWidth - c.clientWidth > slack;
    const edges = () => {
      const x = Math.abs(c.scrollLeft), over = overflows();
      c.toggleAttribute('data-l', over && x > 1);
      c.toggleAttribute('data-r', over && x + c.clientWidth < c.scrollWidth - 1);
    };
    const t = c.querySelector<HTMLElement>('[aria-selected="true"]');
    // Measured from the rects, not offsetLeft: no dependence on which ancestor is the offsetParent. Nothing to centre when it fits.
    if (t && overflows()) c.scrollLeft += t.getBoundingClientRect().left - c.getBoundingClientRect().left - (c.clientWidth - t.offsetWidth) / 2;
    edges();
    c.addEventListener('scroll', edges, { passive: true });
    const ro = new ResizeObserver(edges);
    ro.observe(c);
    return () => {
      c.removeEventListener('scroll', edges);
      ro.disconnect();
    };
  }, [value]);

  // A tabpanel with nothing focusable inside is itself a tab stop (APG); set imperatively, it depends on the children's DOM.
  useEffect(() => {
    const p = panel.current;
    if (!p) return;
    if (p.querySelector(FOCUSABLE)) p.removeAttribute('tabindex');
    else p.setAttribute('tabindex', '0');
  });

  // Arrow / Home / End step from the FOCUSED tab (not the selected value: an async consumer has not committed the last change yet).
  // auto: they also select; manual: focus only, Enter / Space selects.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const els = [...(list.current?.querySelectorAll<HTMLElement>('[role=tab]:not([aria-disabled])') ?? [])];
    if (e.key === ' ' && (e.target as HTMLElement).tagName === 'A') {
      e.preventDefault(); // an anchor does not click on Space
      (e.target as HTMLElement).click();
      return;
    }
    const focused = els.indexOf(document.activeElement as HTMLElement);
    const i = focused >= 0 ? focused : on.findIndex((o) => o.value === stop);
    const to = tabKeyTarget(e.key, Math.max(i, 0), on.length);
    if (to == null) return;
    e.preventDefault();
    els[to]?.focus();
    const next = on[to];
    if (activation === 'auto' && next && next.value !== value) {
      haptic('tap');
      onChange(next.value);
    }
  };

  const strip = (
    <div
      ref={attached ? list : (el: HTMLDivElement | null) => { list.current = el; scroller.current = el; }}
      role="tablist"
      aria-label={label}
      aria-labelledby={labelledby}
      onKeyDown={onKeyDown}
      className={cn(
        'btn-group',
        equal && 'btn-group-equal',
        attached ? ['btn-group-attached', accent && 'btn-group-accent'] : ['btn-group-scroll seg-fade', className],
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        const pick = () => {
          if (opt.disabled) return;
          if (!selected) haptic('tap');
          onChange(opt.value);
        };
        // aria-disabled, not `disabled`: a disabled button swallows pointer events, so its `title` (why it is off) would never show.
        const tab = {
          role: 'tab',
          id: `${id}-${opt.value}`,
          'aria-selected': selected,
          'aria-controls': controls,
          'aria-disabled': opt.disabled || undefined,
          tabIndex: opt.value === stop ? 0 : -1,
          title: opt.title,
        } as const;
        const dim = opt.disabled && 'cursor-not-allowed opacity-50 hover:border-transparent hover:bg-glass';
        return opt.href && !opt.disabled ? (
          <Button
            key={opt.value}
            {...tab}
            href={opt.href}
            size={btnSize}
            active={selected}
            onClick={(e: MouseEvent) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
              e.preventDefault();
              pick();
            }}
          >
            {opt.label}
          </Button>
        ) : (
          <Button key={opt.value} {...tab} type="button" size={btnSize} active={selected} className={dim} onClick={pick}>
            {opt.label}
          </Button>
        );
      })}
    </div>
  );

  if (!attached) return strip;
  const active = options.find((o) => o.value === value);
  return (
    <div className={cn('tabs-attached', className)}>
      <div ref={scroller} className="tabs-attached-bar seg-fade">
        {strip}
      </div>
      {hasPanel && (
        <div ref={panel} id={controls} role="tabpanel" aria-labelledby={active ? `${id}-${active.value}` : undefined} className={cn('tabs-panel surface bg-bg-1 shadow-sm', PANEL_BODY)}>
          {children}
        </div>
      )}
    </div>
  );
}
