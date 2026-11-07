import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * A pinned header and the rows that scroll under it, as two SIBLINGS: the only structure in
 * which the scrollbar spans the rows alone.
 *
 * `position: sticky` inside the scroller draws the same picture until you look at the scrollbar:
 * the header is then part of the scrolling element, so the track runs the full height of the
 * panel, past the identity row and the column labels, and the list appears to start above its
 * own headings.
 *
 * The header pays for the fix in alignment: outside the scroller it is as wide as the panel,
 * while the rows are narrower by the scrollbar, so every right-aligned label would sit past its
 * own column. It pads itself by the MEASURED scrollbar width instead, the trick `Table`'s
 * virtual body already uses for its detached `<thead>`. On overlay-scrollbar platforms (macOS)
 * that measures 0 and nothing moves; a classic scrollbar measures ~15px and the header follows
 * it. A panel that would rather reserve the track permanently than have its rows reflow when
 * they stop overflowing passes `[scrollbar-gutter:stable]` in `scrollClassName`; the measurement
 * then reports the reserved width and the header matches it either way.
 *
 * A real `<thead>` is NOT this component: a table header cannot leave its own `<table>` without
 * losing column alignment, and `position: sticky` on its `<th>` is the correct fix there. Nor is
 * a run of per-group headings (the notification day dividers), where many headers each pin over
 * their own stretch of rows and no single one sits above the list.
 */
export function ScrollPane({
  header,
  headerClassName,
  children,
  className,
  scrollClassName,
}: {
  /** Drawn above the scroller, never inside it. */
  header?: ComponentChildren;
  /** Classes for the header's own wrapper. Give it the surface colour behind the panel, or the
   *  reserved scrollbar gutter shows as a notch at its right edge. */
  headerClassName?: string;
  children: ComponentChildren;
  className?: string;
  scrollClassName?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [gutter, setGutter] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const sync = () => setGutter(el.offsetWidth - el.clientWidth);
    sync();
    // Observed, not measured once: the width changes with page zoom and with a resize that adds
    // or removes the bar, and the first paint can precede the fonts that decide whether it does.
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {header ? (
        <div className={cn('shrink-0', headerClassName)} style={{ paddingRight: gutter }}>
          {header}
        </div>
      ) : null}
      <div ref={scrollRef} className={cn('min-h-0 flex-1 overflow-y-auto', scrollClassName)}>
        {children}
      </div>
    </div>
  );
}
