import { useBack } from '../lib/backStack';
import { useEffect, useRef } from 'preact/hooks';

/**
 * While `open`: a pointerdown outside `inside`, or Escape, calls `onClose(event)`; Android Back
 * closes it too (back stack). `capture` puts both listeners ahead of anything that stops
 * propagation below them (chart, drawing surfaces).
 */
export function useDismiss(
  open: boolean,
  onClose: (e?: Event) => void,
  inside: (target: Node) => boolean,
  capture = true,
) {
  const close = useRef(onClose);
  const isInside = useRef(inside);
  close.current = onClose;
  isInside.current = inside;
  useBack(open, () => close.current());
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (!isInside.current(e.target as Node)) close.current(e);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current(e);
    };
    document.addEventListener('pointerdown', down, capture);
    document.addEventListener('keydown', key, capture);
    return () => {
      document.removeEventListener('pointerdown', down, capture);
      document.removeEventListener('keydown', key, capture);
    };
  }, [open, capture]);
}
