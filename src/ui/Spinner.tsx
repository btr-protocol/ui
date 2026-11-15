import { cn } from '../lib/cn';

/** A ring with a turning arc. ONLY for a user-initiated pending action (a click that waits); data uses the sweep (`Skeleton`,
 *  `ValuePlaceholder`). CSS only (`.spinner`, styles/index.css); reduced motion slows it to a 2.4 s turn. */
export function Spinner({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  return <span aria-hidden="true" className={cn('spinner animate-spin', size === 'md' && 'spinner-md', className)} />;
}
