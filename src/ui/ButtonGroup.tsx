import { type ClassValue, cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';
import type { HTMLAttributes } from 'preact/compat';

export interface ButtonGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  className?: ClassValue;
  children?: ComponentChildren;
}

/** 2+ controls side by side as ONE joined group (styles/button-group.css): buttons, links and
 *  dropdown triggers as direct children. Name the group with `aria-label` when its purpose is not
 *  obvious from the buttons. */
export function ButtonGroup({ className, ...props }: ButtonGroupProps) {
  return <div role="group" className={cn('btn-group', className)} {...props} />;
}
