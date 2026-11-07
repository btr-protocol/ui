import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';

/** A box nested inside a Panel (preview, recap, code block). `surface` lowers the radius one
 *  level, so it never carries a hard-coded `rounded-[..]`. */
export function Inset({ children, className, ...rest }: { children: ComponentChildren; className?: string; id?: string; 'aria-live'?: 'polite' | 'assertive' }) {
  return (
    <div className={cn('surface rounded-lg border border-border bg-bg-2 p-4', className)} {...rest}>
      {children}
    </div>
  );
}
