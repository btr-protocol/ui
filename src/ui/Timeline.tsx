import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';
import { Icon, type IconName } from './Icon';

export interface TimelineItem {
  id: string;
  /** Registered Icon name, or a node. */
  icon?: IconName | ComponentChildren;
  /** The sentence ("Alice signed #42"). */
  title: ComponentChildren;
  /** Secondary line: time, chain, actor. */
  meta?: ComponentChildren;
  /** Trailing link (explorer, proposal). Renders an external-link anchor with `linkLabel`. */
  href?: string;
  linkLabel?: string;
  /** Day (or any) heading: consecutive items with the same value share one heading. */
  group?: string;
}

export interface TimelineProps {
  items: readonly TimelineItem[];
  /** Shown when `items` is empty. */
  empty?: ComponentChildren;
  className?: string;
}

/** Activity list: icon, sentence, meta, trailing link, optional day headings. Rows are 44px+ on touch. */
export function Timeline({ items, empty, className }: TimelineProps) {
  if (items.length === 0) return empty ? <div className={className}>{empty}</div> : null;
  return (
    <ol className={cn('divide-y divide-border', className)}>
      {items.map((it, i) => (
        <li key={it.id} className="list-none">
          {it.group && it.group !== items[i - 1]?.group && (
            <h3 className="bg-bg-3 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fg-1">{it.group}</h3>
          )}
          <div className="flex min-h-[var(--ctl-l)] items-start gap-3 px-3 py-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-bg-2 text-fg-2">
              {typeof it.icon === 'string' ? <Icon name={it.icon as IconName} className="h-3.5 w-3.5" /> : it.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm text-fg-0">{it.title}</div>
              {it.meta && <div className="text-xs text-fg-2">{it.meta}</div>}
            </div>
            {it.href && (
              <a
                href={it.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={it.linkLabel ?? 'Open'}
                className="tap-min -m-2 inline-flex shrink-0 items-center justify-center rounded-sm p-2 text-fg-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name="external-link" className="h-4 w-4" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
