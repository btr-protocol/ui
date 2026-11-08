import type { ComponentChildren } from 'preact';
import { StickyActionBar } from './StickyActionBar';

/** The draft batch, pinned above the footer / tab bar at every width: a summary on the left (count, chains), the primary action and an overflow menu on the right.
 *  Hidden by the caller when the batch is empty. */
export function BatchBar({ summary, primary, menu, className }: { summary: ComponentChildren; primary: ComponentChildren; menu?: ComponentChildren; className?: string }) {
  return (
    <StickyActionBar role="status" className={className ? `flex-wrap ${className}` : 'flex-wrap'}>
      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-2">{summary}</span>
      <span className="flex items-center gap-2">
        {primary}
        {menu}
      </span>
    </StickyActionBar>
  );
}
