import { useEffect, useRef } from 'preact/hooks';

/** Open overlays, topmost last. Escape and Android Back close the top one; no history sentinels. */
const stack: Array<() => void> = [];

/** Register an open overlay. Returns its unregister. */
export function pushBack(close: () => void): () => void {
  stack.push(close);
  return () => {
    const i = stack.lastIndexOf(close);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Closes the topmost overlay (it unregisters itself when it unmounts). False when none is open. */
export function popBack(): boolean {
  stack[stack.length - 1]?.();
  return stack.length > 0;
}

/** Registers `close` while `open`. */
export function useBack(open: boolean, close: () => void): void {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => (open ? pushBack(() => ref.current()) : undefined), [open]);
}
