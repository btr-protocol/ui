import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';

/** A bar pinned above the fixed footer / phone tab bar (`--chrome-b` already carries the inset),
 *  for the one action or status a long page must never scroll away from. Put it LAST in the
 *  page: sticky is bounded by its parent. */
export function StickyActionBar({
  children,
  className,
  role,
}: { children: ComponentChildren; className?: string; role?: 'status' | 'alert' }) {
  return (
    <div
      role={role}
      className={cn(
        'sticky bottom-[var(--chrome-b)] z-10 mt-auto flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-1 px-3 py-2 text-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}
