import type { ComponentChildren } from 'preact';
import { cn } from '../lib/cn';

export interface AuthShellProps {
  /** Lockup / logo at the top of the card. */
  brand: ComponentChildren;
  /** One line of context under the brand. */
  hint?: ComponentChildren;
  /** The action(s): Connect / Sign in, status and errors. */
  children: ComponentChildren;
  /** Subtle control in the page corner (theme toggle). */
  corner?: ComponentChildren;
  className?: string;
}

/** The sign-in / gate page: no header, nav or footer, one small centred card on the page background. */
export function AuthShell({ brand, hint, children, corner, className }: AuthShellProps) {
  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center bg-bg-0 px-4 py-10 pb-[max(2.5rem,var(--sab))] pt-[max(2.5rem,var(--sat))]">
      {corner && <div className="absolute right-3 top-[max(0.75rem,var(--sat))]">{corner}</div>}
      <div
        className={cn(
          'flex w-full max-w-sm flex-col items-center gap-6 rounded-lg border border-border bg-bg-1 px-6 py-10 text-center',
          className,
        )}
      >
        {brand}
        {hint && <p className="text-sm text-fg-2">{hint}</p>}
        {children}
      </div>
    </main>
  );
}
