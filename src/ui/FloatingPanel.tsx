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
 * The one popover engine behind Tooltip, Popover and InfoTip: trigger wrapper, portaled panel,
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
  // Keyboard path of an INTERACTIVE panel that holds something focusable (links, copy buttons): the
  // panel is portaled, so Tab can never reach it from the trigger. Enter / Space on the trigger
  // pins it and, on the key's RELEASE (so the key-up cannot activate what it lands on), moves focus
  // in; Escape closes it and hands focus back. A text-only panel keeps the plain toggle.
  //  pending: 'down' = key pressed, waiting for its release; 'up' = released, waiting for the panel.
  //  swallow: eats the click that Enter / Space would otherwise add on top of the handled key.
  //  kbIntent: Enter / Space went down on a CLOSED box, which takes the native click path
  //    untouched; the click that opens it then moves focus in if there is anything to focus.
  //  quiet: the hand-back focus must not re-open the box; held only across that one focus() call.
  //  owned: the box is pinned (clicked / keyboard-opened) or focus-opened: it owns Escape. A box
  //    that only a hover opened does not, and Escape goes through to whatever sits behind it.
  // The transient flags die with the gesture: trigger focusout, window blur, the next pointerdown
  // and unmount all clear them, so a keyup that never arrives cannot eat a later real click.
  const pending = useRef<'down' | 'up' | null>(null);
  const swallow = useRef(false);
  const kbIntent = useRef(false);
  const quiet = useRef(false);
  const owned = useRef(false);
  const disarmRef = useRef<(() => void) | null>(null);
  const disarm = () => disarmRef.current?.();
  const reset = () => {
    swallow.current = false;
    pending.current = null;
    kbIntent.current = false;
    disarm();
  };
  const arm = () => {
    if (disarmRef.current) return;
    const stop = () => reset();
    window.addEventListener('blur', stop);
    document.addEventListener('pointerdown', stop, true);
    disarmRef.current = () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('pointerdown', stop, true);
      disarmRef.current = null;
    };
  };
  useEffect(() => reset, []);

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
  const inBox = (t: Node) => !!triggerRef.current?.contains(t) || !!(t as Element).closest?.('.floating-panel');
  useDismiss(
    visible && (mode !== 'hover' || interactive),
    () => setVisible(false),
    inBox,
  );

  // Escape belongs to the open box first. A `window` capture listener runs before every `document`
  // capture listener (the modal's `useDismiss` among them), so the box consumes the Escape it
  // handles and the modal behind it stays open; with no box open this never registers and Escape
  // reaches the modal as before. Only a box that owns Escape consumes it (pinned, keyboard-opened,
  // or with focus inside); a hover-opened, unfocused one lets it through, and its own dismiss
  // closes it along with the modal. Focus goes back to the trigger only if it was inside the box.
  useEffect(() => {
    if (!visible) owned.current = false;
    if (!visible || !(mode !== 'hover' || interactive)) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const at = document.activeElement;
      const inPanel = !!at && !!panel?.contains(at);
      if (!owned.current && !inPanel) return;
      e.stopImmediatePropagation();
      const inside = inPanel || (!!at && !!triggerRef.current?.contains(at));
      setVisible(false);
      if (inside) handBack();
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [visible, mode, interactive, panel]);

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
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    let kb = false;
    try {
      kb = (e.target as Element).matches(':focus-visible');
    } catch {
      /* selector unsupported */
    }
    if (kb) {
      clearTimers();
      owned.current = true;
      setVisible(true);
    }
  };
  const onFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Element | null;
    if (to && inBox(to)) return;
    reset();
    setVisible(false);
  };
  const focusable = (el: HTMLElement) =>
    el.querySelector<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]');
  const handBack = () => {
    const el = triggerRef.current?.querySelector<HTMLElement>('button,[tabindex]');
    if (!el) return;
    quiet.current = true;
    el.focus(); // focusin fires synchronously, inside this call
    quiet.current = false;
  };
  const isKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && visible) setVisible(false);
    if (!interactive || !content || !isKey(e)) return;
    // Closed: the pre-existing path, untouched (native click toggles it open). The click that
    // opens it moves focus in when the body has something to focus.
    if (!visible || !panel) {
      kbIntent.current = true;
      arm();
      return;
    }
    // Open and text-only: nothing to move into, so Enter / Space keep their click (the toggle).
    if (!focusable(panel)) return;
    e.preventDefault();
    e.stopPropagation();
    clearTimers();
    owned.current = true;
    swallow.current = true;
    pending.current = 'down';
    arm();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (!interactive || !isKey(e)) return;
    // Enter / Space's own click (closed path) arrives inside this task: let it, then stop.
    if (kbIntent.current)
      setTimeout(() => {
        kbIntent.current = false;
        if (!pending.current) disarm();
      }, 0);
    if (!swallow.current) return;
    e.preventDefault();
    e.stopPropagation();
    // The click some browsers add after Space's release arrives in this task: eat it, then stop.
    setTimeout(() => {
      swallow.current = false;
      if (!pending.current) disarm();
    }, 0);
    if (pending.current !== 'down') return;
    const found = panel && focusable(panel);
    pending.current = panel ? null : 'up';
    found?.focus();
  };
  const onPanelFocusOut = (e: FocusEvent) => {
    const to = e.relatedTarget as Element | null;
    if (to && inBox(to)) return;
    setVisible(false);
  };
  useEffect(() => {
    if (!panel || !pending.current) return;
    const found = focusable(panel);
    // No focusable content: the box simply opened. Otherwise focus follows the key's release.
    if (!found || pending.current === 'up') {
      pending.current = null;
      found?.focus();
      if (!swallow.current && !kbIntent.current) disarm();
    }
  }, [panel]);
  const onClick = (e: MouseEvent) => {
    if (swallow.current) {
      e.stopPropagation();
      return;
    }
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
    owned.current = !visible;
    // A keyboard open of a closed box: focus follows into it once it is there.
    if (!visible && kbIntent.current && interactive) pending.current = 'up';
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
      onKeyUp={hovers ? onKeyUp : undefined}
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
            onFocusOut={interactive ? onPanelFocusOut : undefined}
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
  /** Lands on the trigger wrapper: what `ButtonGroup` clones onto a child, so a tooltipped button
   *  can sit in a group and still take its divider and end rounding. */
  className?: string;
}) {
  return <FloatingPanel tooltipMode wrapClass={cn(wrapClass, className)} {...props} />;
}

/** Rich panel: hover on desktop, click on mobile UAs. */
export function Popover(props: Omit<FloatingPanelProps, 'mode' | 'tooltipMode'>) {
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return <FloatingPanel mode={mobile ? 'click' : 'hover'} {...props} />;
}
