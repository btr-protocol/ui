import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';
import { Icon } from './Icon';

export interface PriceWithWarningProps {
  /** The dynamic-width figure. */
  children: ComponentChildren;
  /** Show the warning icon (stale, indicative, ...). The slot stays reserved either way. */
  warn?: boolean;
  /** Spoken reason; also the icon's native tooltip. Required whenever `warn` is set. */
  label?: string;
  /** Which box edge the icon slot is pinned to: `start` (icon before the figure) or `end` (after it). Pick the edge the parent keeps fixed (right-aligned column: `end`). */
  anchor?: 'start' | 'end';
  className?: string;
}

/**
 * A price with a warning icon that never moves. The icon sits in a fixed slot (1.25em wide, always
 * reserved, empty when not warning) pinned to one edge of the box (`anchor`); the figure takes the rest, so a price
 * that grows or shrinks (tabular-nums) never shifts the icon. Icon is 1.1em
 * (>= 1em) so it scales with the price font.
 */
export function PriceWithWarning({ children, warn = false, label, anchor = 'start', className }: PriceWithWarningProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', anchor === 'end' && 'flex-row-reverse', className)}>
      <span className="inline-flex h-[1.1em] w-[1.25em] shrink-0 items-center justify-center" aria-hidden={warn ? undefined : true}>
        {warn && (
          <Icon
            name="warning"
            role="img"
            aria-label={label}
            style={{ width: '1.1em', height: '1.1em', color: 'var(--fg-warning)' }}
          />
        )}
      </span>
      <span>{children}</span>
    </span>
  );
}
