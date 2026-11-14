import { useEffect, useState } from 'preact/hooks';

/** Live `matchMedia(query).matches`. False during SSR/tests (no `matchMedia`). */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = matchMedia(query);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return on;
}
