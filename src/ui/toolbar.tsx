import { createContext } from 'preact';

/** One toolbar cell (chart toolbar, depth toolbar, table/panel header): h-8, text-xs, no inner box. */
export const TOOLBAR_CELL = 'toolbar-btn gap-1 text-xs whitespace-nowrap';

/** True inside a HeaderBar's control row: SelectModal, SegmentedControl and InfoBox render as flush
 *  toolbar cells there instead of boxed buttons, so every header reads like the chart toolbar. */
export const InHeader = createContext(false);
