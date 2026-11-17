import { useEffect, useRef, useState } from 'preact/hooks';
import { LOADING_DEADLINE_MS } from './cell';

/** When `active` began (epoch ms): kept across renders, reset when it ends, so a NEW request starts a NEW wait. Never 0 while active.
 *  Pass the result as `since` to `toCell`. A ref, no state: it adds no render. */
export function useSince(active: boolean): number {
  const t = useRef<number>();
  if (active) t.current ??= Date.now();
  else t.current = undefined;
  return t.current ?? Date.now();
}

/** ONE timer per component or section (never per cell): schedules a single re-render at the earliest still-pending deadline among the `since` values
 *  its cells use, so a stuck load turns `unavailable('timeout')` without waiting for a poll. Call it once wherever `toCell({ loading, since })` is rendered.
 *  Pass `undefined` for a cell that is not loading (or is `measuring`). Cleared on unmount; a changed `since` (new request) re-arms it. `Figure` stays stateless. */
export function useLoadingDeadline(sinces: ReadonlyArray<number | undefined> | number | undefined, deadlineMs: number = LOADING_DEADLINE_MS): void {
  const [, tick] = useState(0);
  const now = Date.now();
  const list = Array.isArray(sinces) ? sinces : [sinces as number | undefined];
  let next: number | undefined;
  for (const s of list) if (s !== undefined && s + deadlineMs > now && (next === undefined || s < next)) next = s;
  useEffect(() => {
    if (next === undefined) return;
    const id = setTimeout(() => tick((n) => n + 1), Math.max(0, next + deadlineMs - Date.now()) + 1);
    return () => clearTimeout(id);
  }, [next, deadlineMs]);
}
