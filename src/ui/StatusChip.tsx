import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';
import { Icon, type IconName } from './Icon';

export type StatusTone = 'success' | 'warning' | 'danger';
const TONE: Record<StatusTone, { cls: string; icon: IconName }> = {
  success: { cls: 'bg-bg-green text-success', icon: 'check-circle' },
  warning: { cls: 'bg-bg-primary text-warning', icon: 'warning' },
  danger: { cls: 'bg-bg-red text-red', icon: 'x-circle' },
};

/** ONE verdict chip for a whole object. Green (`success`) must be earned by every check passing; an unknown is `warning`, never green. */
export function StatusChip({ tone, children, className }: { tone: StatusTone; children: ComponentChildren; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-medium', TONE[tone].cls, className)}>
      <Icon name={TONE[tone].icon} className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

export interface StatusItem {
  id: string;
  tone: StatusTone;
  text: ComponentChildren;
  /** Trailing control (a re-run button). */
  action?: ComponentChildren;
}

/** The checks behind a StatusChip: icon + sentence per row, tone-coloured icon, wraps on phones. */
export function StatusList({ items, className }: { items: readonly StatusItem[]; className?: string }) {
  return (
    <ul className={cn('space-y-1.5', className)}>
      {items.map((it) => (
        <li key={it.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Icon name={TONE[it.tone].icon} className={cn('h-4 w-4 shrink-0', it.tone === 'success' ? 'text-success' : it.tone === 'warning' ? 'text-warning' : 'text-red')} />
          <span className="min-w-0 flex-1 text-fg-1">{it.text}</span>
          {it.action}
        </li>
      ))}
    </ul>
  );
}
