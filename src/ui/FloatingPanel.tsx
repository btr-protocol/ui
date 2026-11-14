import { type Placement, type Position, getArrowStyles, placePanel } from '../lib/positioning';
import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Portal } from './Portal';
import { useDismiss } from './useDismiss';

export interface FloatingPanelProps {
  content: ComponentChildren;
  /** A function receives the open state, for a trigger that reports `aria-expanded`. */
  children: ComponentChildren | ((open: boolean) => ComponentChildren);
  side?: Position;
  /** `hover`: mouse hover (tap toggles on touch). `click`: click toggles. `both`: hover, and a
   *  click on the trigger toggles too. */
  mode?: 'hover' | 'click' | 'both';
  /** Hover-open delay, ms. */
  delay?: number;
  asChild?: boolean;
  arrow?: boolean;
  maxWidth?: string;
  /** Terse label look: `rounded-xs`, one line unless `maxWidth` or `interactive` asks to wrap. */
  tooltipMode?: boolean;
  /** Panel carries links: stays hoverable past the trigger, clicks inside survive. */
  interactive?: boolean;
  /** Panel of full-bleed rows (a menu): no panel padding, rows span edge to edge and carry their own. */
  flush?: boolean;
  /** Classes on the trigger wrapper. */
  wrapClass?: string;
}

/**
 * The one popover engine behind Tooltip, Popover and InfoBox: trigger wrapper, portaled panel,
 * viewport containment, hover bridge, outside-press / Escape / Back dismissal.
 */
export function FloatingPanel({
  content,
  children,
  side = 'top',
  mode = 'hover',
  delay = 0,
  asChild,
  arrow = true,
  maxWidth = 'auto',
  tooltipMode = false,
  interactive = false,
  flush = false,
  wrapClass,
}: FloatingPanelProps) {
  const [visible, setVisible] = useState(false);
  const [placed, setPlaced] = useState<Placement>({ left: 0, top: 0, side });
  const triggerRef = useRef<HTMLSpanElement>(null);
  // State, not a ref: the Portal mounts one render after `visible`, and placement must re-run then.
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const openTimer = useRef<number>();
  const hideTimer = useRef<number>();
  const hovers = mode !== 'click';

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(hideTimer.current);
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), 250);
  };
  useEffect(() => clearTimers, []);

  // A tooltip dismisses on ANY press (it often opens another layer). Interactive panels are exempt
  // inside the panel: a press there starts a link click. NOT gated on `visible`: a click on the
  // trigger delivers pointerenter and pointerdown in one task, so an effect that subscribes once
  // the panel is open misses the very press it exists to catch.
  useEffect(() => {
    if (mode !== 'hover') return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (interactive && t?.closest('.floating-panel')) return;
      // A touch on the trigger belongs to `onClick` (toggle), not to this dismiss.
      if (e.pointerType !== 'mouse' && triggerRef.current?.contains(t)) return;
      setVisible(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [mode, interactive]);

  // The panel is portaled: it is inside for dismissal purposes, whichever instance owns it.
  useDismiss(
    visible && (mode !== 'hover' || interactive),
    () => setVisible(false),
    (t) => !!triggerRef.current?.contains(t) || !!(t as Element).closest?.('.floating-panel'),
  );

  // Measure the rendered panel, then flip/shift it against the trigger (never over it). Re-runs
  // when the content resizes (a lazy body) and when the page scrolls or resizes under it.
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!visible || !panel || !trigger) return;
    let raf = 0;
    const place = () => {
      const next = placePanel(
        trigger.getBoundingClientRect(),
        { w: panel.offsetWidth, h: Math.max(panel.offsetHeight, panel.scrollHeight) },
        side,
        tooltipMode ? 8 : 10,
      );
      setPlaced((p) =>
        p.left === next.left &&
        p.top === next.top &&
        p.side === next.side &&
        p.maxHeight === next.maxHeight
          ? p
          : next,
      );
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        place();
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    const stop = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
    if (typeof ResizeObserver === 'undefined') return stop;
    const ro = new ResizeObserver(place);
    ro.observe(panel);
    return () => {
      ro.disconnect();
      stop();
    };
  }, [visible, panel, side, tooltipMode]);

  // `pointerType` is the only thing separating a hover from a TAP: touch synthesises pointerenter
  // and never a leave, so a tooltip opened that way stayed pinned with no gesture to dismiss it.
  const onEnter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimers();
    if (delay > 0) openTimer.current = window.setTimeout(() => setVisible(true), delay);
    else setVisible(true);
  };
  const onLeave = () => {
    clearTimeout(openTimer.current);
    if (interactive)
      scheduleHide(); // bridge: the pointer can reach the panel and its links
    else setVisible(false);
  };
  // Keyboard focus opens like hover (pointer focus does not: that is the click path); Esc or
  // focus leaving the trigger closes.
  const onFocusIn = (e: FocusEvent) => {
    let kb = false;
    try {
      kb = (e.target as Element).matches(':focus-visible');
    } catch {
      /* selector unsupported */
    }
    if (kb) {
      clearTimers();
      setVisible(true);
    }
  };
  const onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Element | null;
    if (to && (triggerRef.current?.contains(to) || to.closest?.('.floating-panel'))) return;
    setVisible(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && visible) setVisible(false);
  };
  const onClick = (e: MouseEvent) => {
    if (mode === 'hover') {
      // Hover has no touch equivalent: a tap toggles (auto-hides after 3s). Taps on a live
      // control are left to that control.
      const type = (e as PointerEvent).pointerType;
      if (!type || type === 'mouse' || !content) return;
      if ((e.target as Element).closest('button:not(:disabled),a[href],input,select,[role=button]'))
        return;
      clearTimers();
      setVisible((v) => !v);
      hideTimer.current = window.setTimeout(() => setVisible(false), 3000);
      return;
    }
    // Often embedded in a clickable row: the trigger must not also activate the row below it.
    e.stopPropagation();
    clearTimers();
    setVisible((v) => !v);
  };

  // `maxWidth` asks to wrap AT that width; 'auto' means nowrap, except interactive panels (links,
  // sentences), which wrap at a default width.
  const panelClassName = cn(
    'floating-panel',
    flush && 'floating-flush',
    tooltipMode &&
      cn(
        'rounded-xs font-medium',
        interactive
          ? cn('pointer-events-auto whitespace-normal', maxWidth === 'auto' && 'max-w-72')
          : cn(
              'pointer-events-none',
              maxWidth === 'auto' ? 'whitespace-nowrap' : 'whitespace-normal',
            ),
      ),
    !tooltipMode && 'pointer-events-auto',
  );

  return (
    <span
      ref={triggerRef}
      className={cn(asChild ? 'block w-full' : 'inline-block', wrapClass)}
      onPointerEnter={hovers ? onEnter : undefined}
      onPointerLeave={hovers ? onLeave : undefined}
      // A pointer that vanishes (finger lifted, stylus away) fires cancel and no leave.
      onPointerCancel={hovers ? onLeave : undefined}
      onClick={onClick}
      onFocusIn={hovers ? onFocusIn : undefined}
      onFocusOut={hovers ? onFocusOut : undefined}
      onKeyDown={hovers ? onKeyDown : undefined}
    >
      {typeof children === 'function' ? children(visible) : children}
      {visible && content && (
        <Portal
          innerRef={setPanel}
          className={panelClassName}
          style={{
            left: placed.left,
            top: placed.top,
            maxHeight: placed.maxHeight,
            overflowY: placed.maxHeight ? 'auto' : undefined,
            // Never wider than the screen, whatever the caller asked for.
            maxWidth:
              maxWidth === 'auto' ? 'calc(100vw - 1rem)' : `min(${maxWidth}, calc(100vw - 1rem))`,
          }}
        >
          {arrow && <div style={getArrowStyles(placed.side, true)} />}
          <div
            onMouseEnter={interactive ? () => clearTimeout(hideTimer.current) : undefined}
            onMouseLeave={interactive ? scheduleHide : undefined}
          >
            {content}
          </div>
        </Portal>
      )}
    </span>
  );
}

/** Terse label on hover: one line, no wrap unless a `maxWidth` asks for one. */
export function Tooltip({
  className,
  wrapClass,
  ...props
}: Omit<FloatingPanelProps, 'mode' | 'tooltipMode'> & {
  /** Lands on the trigger wrapper. */
  className?: string;
}) {
  return <FloatingPanel tooltipMode wrapClass={cn(wrapClass, className)} {...props} />;
}

/** Rich panel: hover on desktop, click on mobile UAs. */
export function Popover(props: Omit<FloatingPanelProps, 'mode' | 'tooltipMode'>) {
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return <FloatingPanel mode={mobile ? 'click' : 'hover'} {...props} />;
}
