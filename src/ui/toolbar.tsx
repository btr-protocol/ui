import { type ComponentChildren, createContext } from 'preact';
import { cn } from '../lib/cn';

/** One toolbar cell (chart toolbar, depth toolbar, table/panel header): h-8, text-xs, no inner box. */
export const TOOLBAR_CELL = 'toolbar-btn gap-1 text-xs whitespace-nowrap';

/** True inside a HeaderBar's control row: SelectModal, SegmentedControl and InfoBox render as flush
 *  toolbar cells there instead of boxed buttons, so every header reads like the chart toolbar. */
export const InHeader = createContext(false);

/** A read-only header/toolbar cell (age, row count, link): the TOOLBAR_CELL box without the hover. */
export function HeaderText({ className, title, children }: { className?: string; title?: string; children?: ComponentChildren }) {
  return <span title={title} className={cn(TOOLBAR_CELL, 'cursor-default hover:!bg-transparent text-fg-3', className)}>{children}</span>;
}
