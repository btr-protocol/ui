import { type ComponentChildren, createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { cn } from '../lib/cn';

/* CSS-only loaders: ONE shared keyframe (styles/loaders.css), compositor properties only (transform / opacity), no JS timers, no state,
   no per-instance style. Two shapes of ONE sweep: `Loader` (a whole section whose values load together) and `Skeleton` /
   `ValuePlaceholder` (a cell inside a table). Everything here is aria-hidden except `Loader`'s one status. */

/** True inside a busy `Loader`: its ONE status announces the loading, so a Figure there stays silent. */
export const BusyContext = createContext(false);
export const useInBusy = () => useContext(BusyContext);

/** A block placeholder. `lines` > 1 stacks text-line blocks (the last one shorter). Size it with `className` (`h-24 w-full`). */
export function Skeleton({ className, lines = 1 }: { className?: string; lines?: number }) {
  if (lines <= 1) return <span aria-hidden="true" className={cn('sk block h-3.5 w-full rounded-md', className)} />;
  return (
    <span aria-hidden="true" className="flex w-full flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={cn('sk block h-3.5 rounded-md', i === lines - 1 ? 'w-2/3' : 'w-full', className)} />
      ))}
    </span>
  );
}

/** Stands where a figure will be, inside a table cell: `ch` (4-12, tabular figures) reserves its width, so the swap to the value does not shift the layout. */
export function ValuePlaceholder({ ch = 6, className }: { ch?: Ch; className?: string }) {
  return <span aria-hidden="true" className={cn('sk inline-block h-3.5 rounded-md align-middle tabular-nums', `ch-${ch}`, className)} />;
}
export type Ch = 4 | 5 | 6 | 7 | 8 | 10 | 12;

/** A 2px sweep along the top edge of a `relative` parent: a refresh in the background while the old value stays. */
export function Hairline({ active = true }: { active?: boolean }) {
  return active ? <span aria-hidden="true" className="hairline" /> : null;
}

/** THE section loader: while `busy`, the region keeps its layout but its content is hidden under one sweeping block (pure CSS, `.loader`),
 *  so tiles, panels and tables that load together show no number, dash or word. `aria-busy` on the region and ONE visually hidden
 *  `role="status"` that stays mounted OUTSIDE it (a live region must exist before its text changes). */
export function Loader({ busy, label = 'Loading', className, children }: { busy: boolean; label?: string; className?: string; children?: ComponentChildren }) {
  return (
    <>
      <span role="status" className="sr-only">{busy ? label : ''}</span>
      <div aria-busy={busy} className={cn('loader', className)}>
        <BusyContext.Provider value={busy}>{children}</BusyContext.Provider>
      </div>
    </>
  );
}
