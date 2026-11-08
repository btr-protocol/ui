// ChartShell: the one chart frame. Family contract shared with Table/Panel - `loading` +
// `loadingTitle`, empty as `empty` + `emptyMessage`/`emptyTitle`. `title` is the watermark;
// the header bar is ChartHeader (same scale as PanelTitle).
import { PageState } from '../ui/Feedback';
import { cn } from '../lib/cn';
import type { ComponentChildren, JSX } from 'preact';
import { useRef } from 'preact/hooks';

interface ChartShellProps {
  title?: string;
  watermarkStyle?: JSX.CSSProperties;
  watermarkBoxStyle?: JSX.CSSProperties;
  loading?: boolean;
  loadingTitle?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  height?: number;
  className?: string;
  children: ComponentChildren;
}

/** Size against the actual chart width, reserving the axis and horizontal padding. */
const watermarkSize = (title: string) =>
  `clamp(0.625rem, calc((100cqw - 5.25rem) / ${0.6 * Math.max(title.length, 1)}), 3.75rem)`;

export function ChartHeader({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn('px-3 pt-1.5 pb-0.5 shrink-0', className)}>
      <h3 className="text-sm font-semibold text-fg-0 truncate">{title}</h3>
    </div>
  );
}

export function ChartShell({
  title,
  watermarkStyle,
  watermarkBoxStyle,
  loading = false,
  loadingTitle = 'Loading chart',
  empty = false,
  emptyTitle,
  emptyMessage = 'No data in range',
  height,
  className,
  children,
}: ChartShellProps) {
  const gesture = useRef<{ x: number; y: number; page?: boolean } | null>(null);
  return (
    <div
      className={cn('relative min-h-0 h-full touch-pan-y', className)}
      style={{
        containerType: 'inline-size',
        ...(height ? { height: `min(${height}px, calc(100vw - 2rem), 85vh)` } : {}),
      }}
      onTouchStartCapture={(e) => {
        const t = e.touches[0];
        gesture.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchMoveCapture={(e) => {
        const start = gesture.current;
        if (!start || e.touches.length !== 1) return;
        const dx = Math.abs(e.touches[0].clientX - start.x);
        const dy = Math.abs(e.touches[0].clientY - start.y);
        if (dx + dy < 5) return;
        // Match TDLC's direction threshold, but keep vertical swipes native even after its
        // long-press crosshair takes over. Its root touchmove listener must not cancel them.
        start.page ??= dy >= dx * 0.5;
        if (start.page) e.stopPropagation();
      }}
    >
      {children}
      {title && (
        <div
          // Hidden on phones: the title is already the legend heading there, and the watermark ran under it.
          className="absolute inset-0 z-0 flex max-sm:hidden items-center justify-center pointer-events-none"
          style={watermarkBoxStyle}
        >
          <div
            className="font-title font-bold text-fg-3 opacity-10 whitespace-nowrap overflow-hidden px-4 max-w-full"
            style={watermarkStyle ?? { fontSize: watermarkSize(title) }}
          >
            {title}
          </div>
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-bg-0/80">
          <PageState kind="loading" title={loadingTitle} />
        </div>
      )}
      {empty && !loading && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center">
          {emptyTitle ? (
            <PageState kind="empty" title={emptyTitle} />
          ) : (
            <PageState kind="empty" message={emptyMessage} />
          )}
        </div>
      )}
    </div>
  );
}
