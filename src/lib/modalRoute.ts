import { useEffect, useState } from 'preact/hooks';

/** Dispatched after the kit changes the URL itself, so a router that only listens to `popstate` can re-read it. */
export const ROUTE_EVENT = 'btr:route';
const PARAM = 'modal';

const named = (name: string) =>
  history.state?.modal === name || new URLSearchParams(location.search).get(PARAM) === name;

/**
 * A modal whose open state lives in the browser history: opening pushes an entry (`?modal=<name>`),
 * Back closes it, Forward reopens it, and a link carrying `?modal=<name>` opens it on load.
 * Closing by Esc / close button pops the entry we pushed (`history.back()`); a modal opened by a deep link
 * has no entry of ours behind it, so closing replaces the URL instead. Use one `name` per modal.
 */
export function useModalRoute(name: string): [open: boolean, setOpen: (open: boolean) => void] {
  const [open, set] = useState(() => typeof window !== 'undefined' && named(name));
  useEffect(() => {
    const sync = () => set(named(name));
    sync();
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, [name]);
  const setOpen = (next: boolean) => {
    if (next === named(name)) return set(next);
    const url = new URL(location.href);
    if (next) {
      url.searchParams.set(PARAM, name);
      history.pushState({ ...history.state, idx: (history.state?.idx ?? 0) + 1, modal: name }, '', url);
      dispatchEvent(new Event(ROUTE_EVENT));
      return set(true);
    }
    if (history.state?.modal === name) return history.back(); // our entry: popstate closes it
    url.searchParams.delete(PARAM); // deep link: nothing of ours behind it
    history.replaceState({ ...history.state, modal: undefined }, '', url);
    dispatchEvent(new Event(ROUTE_EVENT));
    set(false);
  };
  return [open, setOpen];
}

/** `useState(false)` for a modal, or `useModalRoute(routeKey)` when it should live in the history. */
export function useOpen(routeKey?: string): [boolean, (open: boolean) => void] {
  const local = useState(false);
  const routed = useModalRoute(routeKey ?? '\0');
  return routeKey ? routed : local;
}
