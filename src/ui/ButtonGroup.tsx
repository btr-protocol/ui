import { type ClassValue, cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
import type { HTMLAttributes } from 'preact/compat';

export interface ButtonGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  /** Names the group for assistive tech (required: a toolbar of icons has no other label). */
  'aria-label': string;
  /** Break into rows when the controls cannot fit (toolbars on a phone) instead of overflowing. */
  wrap?: boolean;
  className?: ClassValue;
  children?: ComponentChildren;
}

/** 2+ controls side by side as ONE joined group (styles/button-group.css): buttons, links and
 *  dropdown triggers as direct children. Render a child conditionally rather than hiding it with
 *  CSS: the first and last child own the rounded corners (`hidden` attribute children are safe). */
export function ButtonGroup({ className, wrap, ...props }: ButtonGroupProps) {
  return <div role="group" className={cn('btn-group', wrap && 'btn-group-wrap', className)} {...props} />;
}
