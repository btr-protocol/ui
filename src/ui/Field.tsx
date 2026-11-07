import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';

export interface FieldProps {
  /** Label above the control; `htmlFor` ties it to the control's id. */
  label?: ComponentChildren;
  htmlFor?: string;
  /** Muted helper line under the control; replaced by `error` when one is set. */
  hint?: ComponentChildren;
  /** Message right under the control, in the error colour. */
  error?: ComponentChildren;
  /** Tailwind max-width token, e.g. `md` -> `max-w-md`, or any `max-w-*` class. */
  maxW?: string;
  className?: string;
  children: ComponentChildren;
}

/** Labelled form field: the front's AddressField rhythm (`space-y-1`, `text-xs text-fg-3` label,
 *  `text-xs text-red` message) as a wrapper for any control. */
export function Field({ label, htmlFor, hint, error, maxW, className, children }: FieldProps) {
  const id = htmlFor ? `${htmlFor}-msg` : undefined;
  return (
    <div className={cn('min-w-0 w-full space-y-1', maxW && (maxW.startsWith('max-w') ? maxW : `max-w-${maxW}`), className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs text-fg-3">
          {label}
        </label>
      )}
      {children}
      {(error || hint) && (
        <div id={id} aria-live="polite" className={cn('text-xs', error ? 'text-red' : 'text-fg-3')}>
          {error || hint}
        </div>
      )}
    </div>
  );
}
