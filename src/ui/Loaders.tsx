import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';

/* CSS-only loaders: keyframes and tokens live in styles/index.css (`--dur-sweep`, `--ease-linear`), compositor properties only
   (transform / opacity). One visual language for data: a sweep. Everything here is aria-hidden; `Busy` announces once. */

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

/** Stands where a figure will be: reserves `ch` characters of tabular figures, so the value swap does not move the layout. */
export function ValuePlaceholder({ ch = 6, className }: { ch?: number; className?: string }) {
  return <span aria-hidden="true" style={{ minWidth: `${ch}ch` }} className={cn('sk inline-block h-3.5 rounded-md align-middle tabular-nums', className)} />;
}

/** A 2px sweep along the top edge of a `relative` parent: a refresh in the background while the old value stays. */
export function Hairline({ active = true }: { active?: boolean }) {
  return active ? <span aria-hidden="true" className="hairline" /> : null;
}

/** A region that is loading: `aria-busy`, and ONE visually hidden `role="status"` text. Placeholders inside stay aria-hidden. */
export function Busy({ busy, label = 'Loading', className, children }: { busy: boolean; label?: string; className?: string; children?: ComponentChildren }) {
  return (
    <div aria-busy={busy} className={className}>
      {busy && <span role="status" className="sr-only">{label}</span>}
      {children}
    </div>
  );
}
