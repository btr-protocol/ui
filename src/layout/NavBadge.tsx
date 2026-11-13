import { cn } from '../lib/cn';

export const NAV_BADGE_CAP = 99;

export interface NavBadgeProps {
  count?: number;
  /** Spoken sentence for the count; defaults to "N pending". */
  label?: string;
  /** In-flow pill after a label (Header); otherwise a corner dot on its `relative` parent (TabBar). */
  inline?: boolean;
}

/** Count pill for a nav entry. Renders nothing at 0 / undefined; the number is visual only
 *  (`aria-hidden`), the sentence is read instead of it. */
export function NavBadge({ count, label, inline }: NavBadgeProps) {
  if (!count || count < 1) return null;
  const text = count > NAV_BADGE_CAP ? `${NAV_BADGE_CAP}+` : String(count);
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold leading-none text-black',
          inline ? 'ml-1.5' : 'absolute -right-2 -top-1 z-raised ring-1 ring-bg-1',
        )}
      >
        {text}
      </span>
      <span className="sr-only">{`, ${label ?? `${count} pending`}`}</span>
    </>
  );
}
