// Canonical Page header - uniform title + subtitle across pages.

import type { ComponentChildren } from 'preact';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ComponentChildren;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-fg-0">{title}</h1>
        {subtitle && <p className="text-fg-2 text-sm mt-1">{subtitle}</p>}
      </div>
      {/* Actions wrap: a chain picker plus a window select exceeds 320px on their own. */}
      {actions && <div className="flex items-center flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
