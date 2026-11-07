/**
 * Divider - Simple dividing line component
 * Replaces 73 instances of <div className="border-t border-border" />
 */
import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  /** Optional label centred ON the line: the rule breaks around it, section-title style. */
  label?: ComponentChildren;
}

export function Divider({ orientation = 'horizontal', className = '', label }: DividerProps) {
  if (orientation === 'vertical') {
    return <div className={cn('border-r border-border', className)} style={{ height: '100%' }} />;
  }

  if (label != null) {
    return (
      <div className={cn('flex items-center gap-2 select-none', className)} role="separator">
        <div className="min-w-0 flex-1 border-t border-border" />
        <span className="font-title text-2xs uppercase tracking-widest text-fg-3 opacity-50">
          {label}
        </span>
        <div className="min-w-0 flex-1 border-t border-border" />
      </div>
    );
  }

  return <div className={cn('border-t border-border', className)} />;
}
