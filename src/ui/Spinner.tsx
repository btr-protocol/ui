import { cn } from '../lib/cn';

/** A ring with a turning arc: a user-initiated pending action (a click that waits), and `DataSpinner` for a chart or data table with
 *  nothing to show yet; a value in a cell uses the sweep (`ValuePlaceholder`). CSS only (`.spinner`, styles/loaders.css); reduced motion
 *  slows it to a 2.4 s turn. */
export function Spinner({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  return <span aria-hidden="true" className={cn('spinner animate-spin', size === 'md' && 'spinner-md', className)} />;
}

/** A chart or data table with nothing to show yet: one centred md Spinner and its ONE `role="status"`. It mounts WITH the load, so the
 *  label rides `aria-label` too: a reader names the region on mount even where the inserted live text is not announced. */
export function DataSpinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className={cn('flex h-full w-full items-center justify-center', className)}>
      <Spinner size="md" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
