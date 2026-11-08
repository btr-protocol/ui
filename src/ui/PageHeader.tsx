// Canonical Page header: title + subtitle left, a controls slot right on the same line (front pools page:
// network / currency / timeframe dropdowns). Below sm the controls drop under the title.

import type { ComponentChildren } from 'preact';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned controls (selects, toggles). */
  controls?: ComponentChildren;
  /** @deprecated alias of `controls`. */
  actions?: ComponentChildren;
}

export function PageHeader({ title, subtitle, controls, actions }: PageHeaderProps) {
  const right = controls ?? actions;
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-fg-0">{title}</h1>
        {subtitle && <p className="text-fg-2 text-sm mt-1">{subtitle}</p>}
      </div>
      {/* Controls wrap: a chain picker plus a window select exceeds 320px on their own. */}
      {right && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{right}</div>}
    </header>
  );
}
