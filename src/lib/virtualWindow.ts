/**
 * Window arithmetic for the virtualized metrics tables.
 *
 * Pure and UI-free so the maths is testable without a DOM: given how far a scroll
 * container is scrolled and a FIXED row height, which slice of rows must render,
 * and how tall the top/bottom spacer rows must be so the scrollbar tells the truth.
 */

export interface WindowRange {
  /** First visible row index (overscan included). */
  start: number;
  /** One past the last visible row index. */
  end: number;
  /** Spacer height above the window, px. */
  padTop: number;
  /** Spacer height below the window, px. */
  padBottom: number;
}

/**
 * Visible slice for a scroll offset. Overscans by `overscan` rows on both sides so
 * fast scrolling lands on already-painted rows instead of blanks. When a filter or
 * sort shrinks the list under the current offset, `start` clamps so the window
 * always fills the viewport (or the whole list) rather than showing nothing.
 */
export function virtualWindow(
  scrollTop: number,
  viewportH: number,
  total: number,
  rowH: number,
  overscan = 8,
): WindowRange {
  const visible = Math.max(1, Math.ceil(viewportH / rowH));
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowH) - overscan);
  const start = Math.min(first, Math.max(0, total - visible));
  const end = Math.min(total, first + visible + overscan * 2);
  return {
    start,
    end: Math.max(start, end),
    padTop: start * rowH,
    padBottom: Math.max(0, (total - end) * rowH),
  };
}
