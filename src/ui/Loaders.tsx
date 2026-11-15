import { type ComponentChildren, createContext } from 'preact';
import { useContext, useState } from 'preact/hooks';
import { cn } from '../lib/cn';

/* CSS-only loaders: keyframes and tokens live in styles/index.css (`--dur-sweep`, `--ease-linear`), compositor properties only
   (transform / opacity). One visual language for data: a sweep. Everything here is aria-hidden; `Busy` announces once. */

/** True inside a `Busy`: its ONE status announces the loading, so a Figure there stays silent. */
export const BusyContext = createContext(false);
export const useInBusy = () => useContext(BusyContext);

/** The shared sweep clock: a negative delay of (now mod period), computed ONCE per element, puts every sweep on the same phase. */
export function useSweepPhase(): { '--sk-phase': string } {
  return useState(() => ({ '--sk-phase': `-${Math.round(performance.now() % 1400)}ms` }))[0];
}

/** A block placeholder. `lines` > 1 stacks text-line blocks (the last one shorter). Size it with `className` (`h-24 w-full`). */
export function Skeleton({ className, lines = 1 }: { className?: string; lines?: number }) {
  const phase = useSweepPhase();
  if (lines <= 1) return <span aria-hidden="true" style={phase} className={cn('sk block h-3.5 w-full rounded-md', className)} />;
  return (
    <span aria-hidden="true" className="flex w-full flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={phase} className={cn('sk block h-3.5 rounded-md', i === lines - 1 ? 'w-2/3' : 'w-full', className)} />
      ))}
    </span>
  );
}

/** Stands where a figure will be: reserves `ch` characters of tabular figures, so the value swap does not move the layout. */
export function ValuePlaceholder({ ch = 6, className }: { ch?: number; className?: string }) {
  const phase = useSweepPhase();
  return <span aria-hidden="true" style={{ minWidth: `${ch}ch`, ...phase }} className={cn('sk inline-block h-3.5 rounded-md align-middle tabular-nums', className)} />;
}

/** A 2px sweep along the top edge of a `relative` parent: a refresh in the background while the old value stays. */
export function Hairline({ active = true }: { active?: boolean }) {
  const phase = useSweepPhase();
  return active ? <span aria-hidden="true" style={phase} className="hairline" /> : null;
}

/** A region that is loading: `aria-busy` on the region, and ONE visually hidden `role="status"` that stays mounted OUTSIDE it (a live
 *  region must exist before its text changes) and only changes its text. Placeholders inside stay aria-hidden and silent. */
export function Busy({ busy, label = 'Loading', className, children }: { busy: boolean; label?: string; className?: string; children?: ComponentChildren }) {
  return (
    <>
      <span role="status" className="sr-only">{busy ? label : ''}</span>
      <div aria-busy={busy} className={className}>
        <BusyContext.Provider value={true}>{children}</BusyContext.Provider>
      </div>
    </>
  );
}
