// The one scope/timeframe row under a page header: tabs left, scope selects right, wraps below
// sm. `sticky` pins it under the chrome on phones; its bleed reads the same --page-x as PageShell.
import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';

export function PageToolbar({
  tabs,
  scope,
  sticky = false,
  className,
}: {
  tabs?: ComponentChildren;
  scope?: ComponentChildren;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2',
        tabs ? 'sm:justify-between' : 'sm:justify-end',
        sticky &&
          'sticky top-0 z-sticky -mx-[var(--page-x)] bg-bg-0 px-[var(--page-x)] py-2 sm:static sm:mx-0 sm:bg-transparent sm:p-0',
        className,
      )}
    >
      {tabs}
      {scope && <div className="flex flex-wrap items-center gap-2">{scope}</div>}
    </div>
  );
}
