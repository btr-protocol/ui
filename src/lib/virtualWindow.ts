/**
 * Window arithmetic for the virtualized metrics tables.
 *
 * Pure and UI-free so the maths is testable without a DOM: rows have per-item heights
 * (a day separator is shorter than a data row), so the table hands over their prefix
 * sums; given how far a scroll container is scrolled, which slice of items must render
 * and how tall the top/bottom spacer rows must be so the scrollbar tells the truth.
 */

export interface WindowRange {
  /** First visible item index (overscan included). */
  start: number;
  /** One past the last visible item index. */
  end: number;
  /** Spacer height above the window, px. */
  padTop: number;
  /** Spacer height below the window, px. */
  padBottom: number;
}

/** Prefix sums of item heights: `offsets[i]` is the top edge of item i, `offsets[n]` the content height. */
export function itemOffsets(heights: readonly number[]): Float64Array {
  const offsets = new Float64Array(heights.length + 1);
  for (let i = 0; i < heights.length; i++) offsets[i + 1] = offsets[i]! + heights[i]!;
  return offsets;
}

/** Index of the first item whose bottom edge is past `y` (`n` when `y` is at or past the end). */
export function itemAt(offsets: ArrayLike<number>, y: number): number {
  const n = offsets.length - 1;
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid + 1]! > y) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** The published fixed-row-height window (pre-prefix API): kept verbatim for compatibility. */
function fixedWindow(
  scrollTop: number,
  viewportH: number,
  total: number,
  rowH: number,
  overscan: number,
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

/**
 * Visible slice for a scroll offset. Overscans by `overscan` items on both sides so fast
 * scrolling lands on already-painted rows instead of blanks. When a filter or sort shrinks
 * the list under the current offset, the window pulls back to the last viewportful so it
 * always fills the viewport (or the whole list) rather than showing nothing.
 *
 * Two shapes: the current one takes prefix `offsets`; the published fixed-height one takes
 * `total` rows and a uniform `rowH`. The numeric third argument selects the old math so
 * existing consumers do not silently compute NaN.
 */
export function virtualWindow(
  scrollTop: number,
  viewportH: number,
  total: number,
  rowH: number,
  overscan?: number,
): WindowRange;
export function virtualWindow(
  scrollTop: number,
  viewportH: number,
  offsets: ArrayLike<number>,
  overscan?: number,
): WindowRange;
export function virtualWindow(
  scrollTop: number,
  viewportH: number,
  arg3: number | ArrayLike<number>,
  arg4?: number,
  arg5?: number,
): WindowRange {
  if (typeof arg3 === 'number') {
    return fixedWindow(scrollTop, viewportH, arg3, arg4 ?? 32, arg5 ?? 8);
  }
  const offsets = arg3;
  const overscan = arg4 ?? 8;
  const n = offsets.length - 1;
  if (n === 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };
  const top = Math.max(0, Math.min(scrollTop, offsets[n]!));
  const first = itemAt(offsets, top);
  const last = itemAt(offsets, top + Math.max(0, viewportH) - 1);
  let start = Math.max(0, first - overscan);
  const end = Math.min(n, last + 1 + overscan);
  if (end === n) {
    let s = n;
    let h = 0;
    while (s > 0 && h < viewportH) {
      h += offsets[s]! - offsets[s - 1]!;
      s--;
    }
    start = Math.min(start, s);
  }
  return {
    start,
    end: Math.max(start, end),
    padTop: offsets[start]!,
    padBottom: offsets[n]! - offsets[end]!,
  };
}
