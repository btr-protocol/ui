// Canonical Page header: title + subtitle left, a controls slot right on the same line (front pools page:
// network / currency / timeframe dropdowns). Below sm the controls drop under the title.
// A child page (a record of a list) keeps the SAME header: its parents are breadcrumb links inside the one h1, so the title
// never moves between a list and its detail ("Pending › #12"), and there is no separate "Back to …" link.

import type { ComponentChildren, JSX } from 'preact';

/** One parent of the page in the breadcrumb title: a link (`onClick` may route in-app; modified clicks keep the href). */
export interface Crumb {
  label: string;
  href: string;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLAnchorElement>) => void;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Parents of this page, outermost first: rendered as links before the title, in the same h1. */
  crumbs?: readonly Crumb[];
  /** Right-aligned controls (selects, toggles). */
  controls?: ComponentChildren;
  /** @deprecated alias of `controls`. */
  actions?: ComponentChildren;
}

export function PageHeader({ title, subtitle, crumbs, controls, actions }: PageHeaderProps) {
  const right = controls ?? actions;
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-3xl font-semibold text-fg-0">
          {crumbs?.map((c) => (
            <span key={c.href}>
              <a href={c.href} onClick={c.onClick} className="rounded-sm text-fg-2 transition-colors hover:text-fg-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{c.label}</a>
              <span aria-hidden="true" className="mx-2 text-fg-3">›</span>
            </span>
          ))}
          {crumbs?.length ? <span aria-current="page">{title}</span> : title}
        </h1>
        {subtitle && <p className="text-fg-2 text-sm mt-1">{subtitle}</p>}
      </div>
      {/* Controls wrap: a chain picker plus a window select exceeds 320px on their own. */}
      {right && <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{right}</div>}
    </header>
  );
}
