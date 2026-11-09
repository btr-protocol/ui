import { type Crumb, PageHeader } from '../ui/PageHeader';
import { cn } from '../lib/cn';
import type { ComponentChildren } from 'preact';

interface PageShellProps {
  title?: string;
  subtitle?: string;
  /** Parents of this page: breadcrumb links before the title, in the same header (see PageHeader). */
  crumbs?: readonly Crumb[];
  /** Right-aligned header controls. */
  controls?: ComponentChildren;
  /** @deprecated alias of `controls`. */
  actions?: ComponentChildren;
  children: ComponentChildren;
  className?: string;
  /** page = padded column (default) · fill = full-bleed flex column · bare = no DOM. */
  variant?: 'page' | 'fill' | 'bare';
}

export function PageShell({
  title,
  subtitle,
  crumbs,
  controls,
  actions,
  children,
  className,
  variant = 'page',
}: PageShellProps) {
  if (variant === 'bare') return <>{children}</>;
  if (variant === 'fill') {
    return (
      <div className={cn('w-full flex-1 min-h-0 h-full flex flex-col', className)}>
        {title && <PageHeader title={title} subtitle={subtitle} crumbs={crumbs} controls={controls ?? actions} />}
        {children}
      </div>
    );
  }
  return (
    <section className={cn('w-full px-[var(--page-x)] py-6 space-y-6', className)}>
      {title && <PageHeader title={title} subtitle={subtitle} crumbs={crumbs} controls={controls ?? actions} />}
      {children}
    </section>
  );
}
