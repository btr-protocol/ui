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

/** Stands where a figure will be: `ch` (4-12, tabular figures) reserves its width and `.vp` takes one line box of the slot's own font
 *  size and line height (`1lh`), so the swap to the value shifts neither width nor height, from a table cell to a hero price. */
export function ValuePlaceholder({ ch = 6, className }: { ch?: Ch; className?: string }) {
  return <span aria-hidden="true" className={cn('sk vp rounded-md tabular-nums', `ch-${ch}`, className)} />;
}
export type Ch = 4 | 5 | 6 | 7 | 8 | 10 | 12;

/** A 2px sweep along the top edge of a `relative` parent: a refresh in the background while the old value stays. */
export function Hairline({ active = true }: { active?: boolean }) {
  return active ? <span aria-hidden="true" className="hairline" /> : null;
}

/** THE section loader: while `busy`, the region keeps its layout but its content is hidden under one sweeping block (pure CSS, `.loader`),
 *  so tiles, panels and tables that load together show no number, dash or word. `aria-busy` on the region and ONE visually hidden
 *  `role="status"` that stays mounted OUTSIDE it (a live region must exist before its text changes). `error` (a short line) is the section's
 *  ONE `role="alert"`: its cells render the error mark but never their own alert. Content that has nothing to hold (a depth pane before its
 *  first answer) renders a bare `<Skeleton lines={n} />` instead of a Loader, so no hidden children sit under the sweep. A held value that
 *  refreshes gets `className={refreshing(busy)}` (a CSS hairline), never a Loader. */
export function Loader({ busy, label = 'Loading', error, className, children }: { busy: boolean; label?: string; error?: string; className?: string; children?: ComponentChildren }) {
  return (
    <>
      <span role="status" className="sr-only">{busy && !error ? label : ''}</span>
      {error && <span role="alert" className="sr-only">{error}</span>}
      <div aria-busy={busy} className={cn('loader', className)}>
        <BusyContext.Provider value={busy}>{children}</BusyContext.Provider>
      </div>
    </>
  );
}

/** Class for a background refresh over a value that stays visible: a 2px hairline sweeps its top edge (CSS only, no node). */
export const refreshing = (busy: boolean): string | undefined => (busy ? 'refreshing' : undefined);
