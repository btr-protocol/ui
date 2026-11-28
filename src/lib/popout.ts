/** One headless popup, the same chrome-less window the price chart opens in.
 *
 * The URL is opened synchronously in the click handler (a popup opened after an await is blocked),
 * and the caller's `<a href>` stays the fallback: if the window is refused the browser follows the
 * anchor instead. Re-opening a name reloads it with the current query, so a popup never shows a
 * stale table after a filter change.
 */

/** `popup=yes` without menubar/toolbar/location/status: the chart expand's feature string. */
export const POPUP_FEATURES =
  'popup=yes,width=1200,height=800,left=100,top=100,menubar=no,toolbar=no,location=no,status=no';

/** Open `url` in the named popup, reloading a window of that name, or null when refused/SSR. */
export function openPopout(url: string, name: string): Window | null {
  if (typeof window === 'undefined') return null;
  // Open blank, then navigate: one load, and a named window that already exists is pointed at the
  // caller's current URL instead of keeping its old one.
  const popup = window.open('', name, POPUP_FEATURES);
  if (!popup) return null;
  try {
    popup.location.href = url;
  } catch {
    popup.location.replace(url);
  }
  try {
    popup.focus();
  } catch {
    // A closed or browser-managed window: the caller's anchor remains the fallback.
  }
  return popup;
}
