import { useEffect, useState } from 'preact/hooks';

/** Dispatched after the kit changes the URL itself, so a router that only listens to `popstate` can re-read it. */
export const ROUTE_EVENT = 'btr:route';
const PARAM = 'modal';

/** The modal whose `history.back()` is in flight: a second close in the same tick (a select's own onSelect close + the modal's onClose)
 *  must not pop a second entry and walk off the page. Cleared by the popstate that back produces (and on open). */
let closing: string | null = null;
/** Work to run once that close has landed (a pick's onChange): run before it, its URL change is undone by the back's popstate. */
let afterClose: (() => void) | null = null;
const flushAfter = () => { const f = afterClose; afterClose = null; f?.(); };

const named = (name: string) =>
  history.state?.modal === name || new URLSearchParams(location.search).get(PARAM) === name;

/**
 * A modal whose open state lives in the browser history: opening pushes an entry (`?modal=<name>`),
 * Back closes it, Forward reopens it, and a link carrying `?modal=<name>` opens it on load.
 * Closing by Esc / close button pops the entry we pushed (`history.back()`); a modal opened by a deep link
 * has no entry of ours behind it, so closing replaces the URL instead. Use one `name` per modal.
 */
export function useModalRoute(name: string): [open: boolean, setOpen: (open: boolean, after?: () => void) => void] {
  const [open, set] = useState(() => typeof window !== 'undefined' && named(name));
  useEffect(() => {
    // only the closing modal's own listener clears the flag: every routed modal listens to popstate, and the first one to run must not
    // swallow another's close (its pending pick would be lost)
    const sync = () => { const mine = closing === name; if (mine) closing = null; set(named(name)); if (mine) flushAfter(); };
    sync();
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, [name]);
  /** `after` runs once the modal is closed AND its history entry is gone: a selection that writes the URL (`?by=chain`) must land on the
   *  entry the modal returns to, never on the modal's own entry that the pending `history.back()` is about to drop. */
  const setOpen = (next: boolean, after?: () => void) => {
    if (next === named(name)) { set(next); if (!next && after) { if (closing === name) afterClose = after; else after(); } return; }
    const url = new URL(location.href);
    if (next) {
      closing = null;
      url.searchParams.set(PARAM, name);
      history.pushState({ ...history.state, idx: (history.state?.idx ?? 0) + 1, modal: name }, '', url);
      dispatchEvent(new Event(ROUTE_EVENT));
      return set(true);
    }
    if (history.state?.modal === name) {
      if (after) afterClose = after;
      if (closing === name) return; // already closing
      closing = name;
      // a back whose popstate never reached us: deliver only once the modal's entry is really gone. While the history still says this modal, a URL
      // write would land on the very entry the back is dropping, so nothing is flushed (the popstate, when it comes, delivers it).
      setTimeout(() => { if (closing === name && history.state?.modal !== name) { closing = null; flushAfter(); } }, 400);
      return history.back(); // our entry: popstate closes it
    }
    url.searchParams.delete(PARAM); // deep link: nothing of ours behind it
    history.replaceState({ ...history.state, modal: undefined }, '', url);
    dispatchEvent(new Event(ROUTE_EVENT));
    set(false);
    after?.();
  };
  return [open, setOpen];
}

/** `useState(false)` for a modal, or `useModalRoute(routeKey)` when it should live in the history. */
export function useOpen(routeKey?: string): [boolean, (open: boolean, after?: () => void) => void] {
  const [lo, setLo] = useState(false);
  const routed = useModalRoute(routeKey ?? '\0');
  return routeKey ? routed : [lo, (o: boolean, after?: () => void) => { setLo(o); after?.(); }];
}
